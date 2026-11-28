// SOL admin-only order queue for preparing supplier orders. Never submits supplier payments.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Order preparation is not configured.' });
  }
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Sign in to SOL Studio.' });
  try {
    const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + match[1] }
    });
    if (!userResponse.ok) return res.status(401).json({ error: 'Your SOL session expired. Sign in again.' });
    const user = await userResponse.json();
    const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY };
    const adminUrl = new URL(SUPABASE_URL + '/rest/v1/sol_admins');
    adminUrl.searchParams.set('select', 'user_id');
    adminUrl.searchParams.set('user_id', 'eq.' + user.id);
    adminUrl.searchParams.set('limit', '1');
    const adminResponse = await fetch(adminUrl, { headers });
    if (!adminResponse.ok) throw new Error('Could not verify SOL admin access.');
    const admins = await adminResponse.json();
    if (!Array.isArray(admins) || !admins.length) return res.status(403).json({ error: 'Only SOL admins can prepare supplier orders.' });
    const query = new URL(SUPABASE_URL + '/rest/v1/sol_orders');
    query.searchParams.set('select', 'id,customer_email,amount_total,currency,payment_status,shipping_details,items,created_at');
    query.searchParams.set('payment_status', 'eq.paid');
    query.searchParams.set('order', 'created_at.desc');
    query.searchParams.set('limit', '100');
    const ordersResponse = await fetch(query, { headers });
    if (!ordersResponse.ok) {
      console.error('SOL supplier order queue query failed:', ordersResponse.status);
      return res.status(500).json({ error: 'Could not load paid orders.' });
    }
    return res.status(200).json({ orders: await ordersResponse.json() });
  } catch (error) {
    console.error('SOL supplier order queue error:', error.message);
    return res.status(500).json({ error: 'Order preparation is temporarily unavailable.' });
  }
};
