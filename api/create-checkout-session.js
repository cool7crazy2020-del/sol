// SOL: create a Stripe-hosted Checkout Session using only server-verified published products.
const SITE_URL = process.env.SOL_SITE_URL || 'https://shopsol.vercel.app';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SHIPPING_RATE = process.env.STRIPE_SHIPPING_RATE_ID;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY || !STRIPE_KEY || !SHIPPING_RATE) {
    return res.status(503).json({ error: 'Checkout is not fully configured yet. Please try again later.' });
  }
  try {
    const rawItems = Array.isArray(req.body && req.body.items) ? req.body.items : [];
    if (!rawItems.length || rawItems.length > 20) return res.status(400).json({ error: 'Your bag is empty or contains too many items.' });
    const items = rawItems.map(x => ({
      id: String(x.id || '').slice(0, 120),
      size: String(x.size || 'One size').slice(0, 40),
      color: String(x.color || '').slice(0, 40)
    }));
    if (items.some(x => !x.id)) return res.status(400).json({ error: 'One or more cart items are invalid.' });
    const ids = [...new Set(items.map(x => x.id))];
    const query = new URL(SUPABASE_URL + '/rest/v1/sol_products');
    query.searchParams.set('select', 'id,name,price,data');
    query.searchParams.set('is_published', 'eq.true');
    query.searchParams.set('id', 'in.(' + ids.map(x => '"' + x.replace(/["\\]/g, '') + '"').join(',') + ')');
    const catalogResponse = await fetch(query, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
    if (!catalogResponse.ok) throw new Error('Could not verify SOL products.');
    const catalog = await catalogResponse.json();
    const byId = new Map(catalog.map(row => [String(row.id), row]));
    if (ids.some(id => !byId.has(id))) return res.status(400).json({ error: 'A product in your bag is no longer available. Refresh the store and try again.' });

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', SITE_URL + '/?payment=success&session_id={CHECKOUT_SESSION_ID}');
    form.set('cancel_url', SITE_URL + '/?payment=cancelled');
    form.set('billing_address_collection', 'required');
    form.set('shipping_address_collection[allowed_countries][0]', 'US');
    form.set('shipping_options[0][shipping_rate]', SHIPPING_RATE);
    form.set('phone_number_collection[enabled]', 'true');
    form.set('allow_promotion_codes', 'true');
    form.set('metadata[store]', 'SOL');
    items.forEach((item, i) => {
      const product = byId.get(item.id);
      const price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0 || price > 10000) throw new Error('A product has an invalid price.');
      const base = 'line_items[' + i + ']';
      form.set(base + '[quantity]', '1');
      form.set(base + '[price_data][currency]', 'usd');
      form.set(base + '[price_data][unit_amount]', String(Math.round(price * 100)));
      form.set(base + '[price_data][product_data][name]', String(product.name).slice(0, 120));
      const details = [item.size !== 'One size' ? 'Size: ' + item.size : '', item.color ? 'Color: ' + item.color : ''].filter(Boolean).join(' · ');
      if (details) form.set(base + '[price_data][product_data][description]', details);
    });
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + STRIPE_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error('Stripe Checkout creation failed:', session && session.error && session.error.type);
      return res.status(502).json({ error: 'Stripe could not start checkout. Please try again.' });
    }
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('SOL checkout setup error:', error.message);
    return res.status(500).json({ error: 'Unable to prepare checkout right now.' });
  }
};
