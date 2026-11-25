// SOL: create a Stripe Embedded Checkout Session using only server-verified published products.
const SITE_URL = process.env.SOL_SITE_URL || 'https://shopsol.vercel.app';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_PUBLISHABLE_KEY = (process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const required = {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: SUPABASE_KEY,
    STRIPE_SECRET_KEY: STRIPE_KEY,
    STRIPE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY
  };
  const missing = Object.entries(required).filter(([, value]) => !value || !String(value).trim()).map(([name]) => name);
  if (missing.length) {
    console.error('SOL checkout missing environment variables:', missing.join(', '));
    return res.status(503).json({
      error: 'Checkout configuration is incomplete.',
      missing
    });
  }
  try {
    const authorization = String(req.headers.authorization || '');
    const accessToken = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
    if (!accessToken) return res.status(401).json({ error: 'Sign in with the SOL admin account to test checkout.' });
    const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + accessToken }
    });
    if (!userResponse.ok) return res.status(401).json({ error: 'Your session is invalid. Sign in again.' });
    const user = await userResponse.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Your session is invalid. Sign in again.' });
    const adminUrl = new URL(SUPABASE_URL + '/rest/v1/sol_admins');
    adminUrl.searchParams.set('select', 'user_id');
    adminUrl.searchParams.set('user_id', 'eq.' + user.id);
    adminUrl.searchParams.set('limit', '1');
    const adminResponse = await fetch(adminUrl, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
    });
    if (!adminResponse.ok) throw new Error('Could not verify SOL admin access.');
    const adminRows = await adminResponse.json();
    if (!Array.isArray(adminRows) || !adminRows.length) {
      return res.status(403).json({ error: 'Drop day is coming soon. Checkout is currently admin-only.' });
    }
    const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
    const liveMode = STRIPE_KEY.startsWith('sk_live_');
    const publishableLiveMode = STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_');
    if (liveMode !== publishableLiveMode) {
      console.error('SOL Stripe key mode mismatch diagnostics:', JSON.stringify({ secretPresent: Boolean(STRIPE_KEY), publishablePresent: Boolean(STRIPE_PUBLISHABLE_KEY), secretPrefix: STRIPE_KEY.slice(0, 7), publishablePrefix: STRIPE_PUBLISHABLE_KEY.slice(0, 7), secretLength: STRIPE_KEY.length, publishableLength: STRIPE_PUBLISHABLE_KEY.length, secretLive: liveMode, publishableLive: publishableLiveMode }));
      return res.status(503).json({ error: 'Checkout payment configuration is inconsistent.' });
    }
    // Never allow production live credentials to create real charges from preview deployments.
    if (liveMode && requestHost !== 'shopsol.vercel.app') {
      return res.status(403).json({ error: 'Live checkout is only available on the official SOL store.' });
    }
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
    const catalogResponse = await fetch(query, { headers: { apikey: SUPABASE_KEY } });
    if (!catalogResponse.ok) throw new Error('Could not verify SOL products.');
    const catalog = await catalogResponse.json();
    const byId = new Map(catalog.map(row => [String(row.id), row]));
    if (ids.some(id => !byId.has(id))) return res.status(400).json({ error: 'A product in your bag is no longer available. Refresh the store and try again.' });

    const qualifiesForDiscount = items.length >= 2;
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('ui_mode', 'embedded_page');
    form.set('branding_settings[background_color]', '#F4F1EA');
    form.set('branding_settings[button_color]', '#171717');
    form.set('branding_settings[border_style]', 'rounded');
    form.set('branding_settings[font_family]', 'inter');
    form.set('branding_settings[display_name]', 'SOL');
    const returnHost = /^(?:[a-z0-9-]+\.)*vercel\.app$/.test(requestHost) || requestHost === 'shopsol.vercel.app'
      ? requestHost
      : new URL(SITE_URL).host;
    form.set('return_url', 'https://' + returnHost + '/?payment=success&session_id={CHECKOUT_SESSION_ID}');
    form.set('billing_address_collection', 'required');
    form.set('shipping_address_collection[allowed_countries][0]', 'US');
    form.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    form.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '300');
    form.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
    form.set('shipping_options[0][shipping_rate_data][display_name]', 'Shipping');
    form.set('phone_number_collection[enabled]', 'true');
    form.set('allow_promotion_codes', 'true');
    form.set('metadata[store]', 'SOL');
    form.set('metadata[discount]', qualifiesForDiscount ? '10% (2+ items)' : 'none');
    items.forEach((item, i) => {
      const product = byId.get(item.id);
      const price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0 || price > 10000) throw new Error('A product has an invalid price.');
      const base = 'line_items[' + i + ']';
      form.set(base + '[quantity]', '1');
      form.set(base + '[price_data][currency]', 'usd');
      const finalUnitAmount = Math.round(price * 100 * (qualifiesForDiscount ? 0.90 : 1));
      form.set(base + '[price_data][unit_amount]', String(finalUnitAmount));
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
      const stripeError = session && session.error ? session.error : {};
      console.error('SOL_STRIPE_API_ERROR_DETAILS', JSON.stringify({ type: stripeError.type || null, code: stripeError.code || null, param: stripeError.param || null, message: stripeError.message || null, requestId: stripeResponse.headers.get('request-id') || null }));
      return res.status(502).json({ error: 'Stripe could not start checkout. Please try again.' });
    }
    return res.status(200).json({ clientSecret: session.client_secret, publishableKey: STRIPE_PUBLISHABLE_KEY });
  } catch (error) {
    console.error('SOL checkout setup error:', error.message);
    return res.status(500).json({ error: 'Unable to prepare checkout right now.' });
  }
};
