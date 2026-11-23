// Return only the signed-in customer's own SOL order history.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const authorization = String(req.headers.authorization || '');
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Order history is not configured.' });
  }
  if (!tokenMatch) return res.status(401).json({ error: 'Please sign in to view your orders.' });
  try {
    const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + tokenMatch[1] }
    });
    if (!userResponse.ok) return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    const user = await userResponse.json();
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Your account does not have an email address.' });
    const query = new URL(SUPABASE_URL + '/rest/v1/sol_orders');
    query.searchParams.set('select', 'id,customer_email,amount_total,currency,payment_status,items,created_at');
    query.searchParams.set('customer_email', 'ilike.' + email);
    query.searchParams.set('order', 'created_at.desc');
    query.searchParams.set('limit', '50');
    const ordersResponse = await fetch(query, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
    });
    if (!ordersResponse.ok) {
      console.error('SOL order history database error:', ordersResponse.status);
      return res.status(500).json({ error: 'Could not load your orders right now.' });
    }
    const orders = await ordersResponse.json();
    return res.status(200).json({ orders });
  } catch (error) {
    console.error('SOL order history error:', error.message);
    return res.status(500).json({ error: 'Could not load your orders right now.' });
  }
};
