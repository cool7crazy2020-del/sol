// Verify the payment status of a Checkout Session before the storefront clears its cart.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.STRIPE_SECRET_KEY;
  const id = String(req.query && req.query.session_id || '');
  if (!key || !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: 'Invalid checkout session.' });
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(id), {
      headers: { Authorization: 'Bearer ' + key }
    });
    const session = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'Could not verify payment yet.' });
    if (!session.metadata || session.metadata.store !== 'SOL') return res.status(404).json({ error: 'Checkout session not found.' });
    if (session.payment_status !== 'paid') return res.status(200).json({ payment_status: session.payment_status, status: session.status, items: [] });
    const lineResponse = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(id) + '/line_items?limit=100', {
      headers: { Authorization: 'Bearer ' + key }
    });
    const lineData = await lineResponse.json();
    if (!lineResponse.ok) throw new Error('Could not retrieve purchased items.');
    const items = (lineData.data || []).map(item => ({
      description: item.description || 'SOL item',
      quantity: item.quantity || 1,
      amount_total: item.amount_total || 0,
      currency: item.currency || session.currency || 'usd'
    }));
    return res.status(200).json({ payment_status: session.payment_status, status: session.status, amount_total: session.amount_total || 0, currency: session.currency || 'usd', items });
  } catch (error) {
    console.error('SOL payment verification error:', error.message);
    return res.status(500).json({ error: 'Could not verify payment yet.' });
  }
};
