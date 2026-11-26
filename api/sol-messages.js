// SOL customer messaging. Customers may submit only their own messages;
// only authenticated users listed in sol_admins may read the inbox.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function authenticate(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + match[1] }
  });
  if (!response.ok) return null;
  return response.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'SOL messaging is not configured.' });
  }
  try {
    const user = await authenticate(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    };
    if (req.method === 'POST') {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!message) return res.status(400).json({ error: 'Write a message first.' });
      if (message.length > 3000) return res.status(400).json({ error: 'Messages must be 3,000 characters or fewer.' });
      const response = await fetch(SUPABASE_URL + '/rest/v1/sol_customer_messages', {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ customer_id: user.id, customer_email: user.email || null, message })
      });
      if (!response.ok) {
        console.error('SOL message insert failed:', response.status, await response.text());
        return res.status(500).json({ error: 'Could not send your message right now.' });
      }
      return res.status(201).json({ ok: true });
    }
    const adminCheck = await fetch(SUPABASE_URL + '/rest/v1/sol_admins?select=user_id&user_id=eq.' + encodeURIComponent(user.id) + '&limit=1', { headers });
    if (!adminCheck.ok) return res.status(500).json({ error: 'Could not verify SOL admin access.' });
    const admins = await adminCheck.json();
    if (!Array.isArray(admins) || !admins.length) return res.status(403).json({ error: 'Only SOL admins can view customer messages.' });
    const messagesResponse = await fetch(SUPABASE_URL + '/rest/v1/sol_customer_messages?select=id,customer_email,message,created_at&order=created_at.desc&limit=100', { headers });
    if (!messagesResponse.ok) {
      console.error('SOL inbox query failed:', messagesResponse.status);
      return res.status(500).json({ error: 'Could not load customer messages.' });
    }
    return res.status(200).json({ messages: await messagesResponse.json() });
  } catch (error) {
    console.error('SOL messaging error:', error.message);
    return res.status(500).json({ error: 'SOL messaging is temporarily unavailable.' });
  }
};
