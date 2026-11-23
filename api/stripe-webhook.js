// Stripe webhook: verify the raw request signature, then save paid SOL orders privately.
const crypto = require('crypto');
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
function validSignature(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(',').map(x => x.split('='));
  const timestamp = parts.find(x => x[0] === 't')?.[1];
  const signatures = parts.filter(x => x[0] === 'v1').map(x => x[1]);
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(timestamp + '.' + raw.toString('utf8')).digest('hex');
  return signatures.some(sig => {
    if (!/^[a-f0-9]{64}$/i.test(sig)) return false;
    const a = Buffer.from(sig, 'hex'), b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  if (!STRIPE_KEY || !WEBHOOK_SECRET || !SUPABASE_URL || !SERVICE_KEY) return res.status(500).send('Webhook is not configured');
  try {
    const raw = await readRawBody(req);
    if (!validSignature(raw, req.headers['stripe-signature'], WEBHOOK_SECRET)) return res.status(400).send('Invalid signature');
    const event = JSON.parse(raw.toString('utf8'));
    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return res.status(200).json({ received: true });
    const session = event.data && event.data.object;
    if (!session || !session.id || !session.metadata || session.metadata.store !== 'SOL') return res.status(200).json({ received: true });
    if (session.payment_status !== 'paid') return res.status(200).json({ received: true });
    const lineResponse = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(session.id) + '/line_items?limit=100', {
      headers: { Authorization: 'Bearer ' + STRIPE_KEY }
    });
    const lineData = await lineResponse.json();
    if (!lineResponse.ok) throw new Error('Unable to retrieve Stripe line items');
    const items = (lineData.data || []).map(item => ({
      description: item.description || '',
      quantity: item.quantity || 1,
      amount_total: item.amount_total || 0,
      currency: item.currency || 'usd'
    }));
    const order = {
      stripe_session_id: session.id,
      customer_email: session.customer_details && session.customer_details.email || session.customer_email || null,
      amount_total: session.amount_total || 0,
      currency: session.currency || 'usd',
      payment_status: session.payment_status,
      shipping_details: session.shipping_details || session.customer_details && session.customer_details.address || {},
      items
    };
    const save = await fetch(SUPABASE_URL + '/rest/v1/sol_orders?on_conflict=stripe_session_id', {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(order)
    });
    if (!save.ok) throw new Error('Unable to save order to SOL database');
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('SOL Stripe webhook error:', error.message);
    return res.status(500).send('Webhook processing failed');
  }
};
module.exports.config = { api: { bodyParser: false } };
