// SOL one-time early-access codes. Raw codes are shown to admins once; only SHA-256 hashes are stored.
const crypto = require('crypto');
const URL = process.env.SUPABASE_URL;
const PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' });
async function userFrom(req) {
  const token = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const r = await fetch(URL + '/auth/v1/user', { headers: { apikey: PUBLIC_KEY, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  return r.json();
}
async function isAdmin(user) {
  const u = new URLSearchParams({ select: 'user_id', user_id: 'eq.' + user.id, limit: '1' });
  const r = await fetch(URL + '/rest/v1/sol_admins?' + u, { headers: headers() });
  if (!r.ok) throw new Error('Could not verify SOL admin access.');
  return (await r.json()).length > 0;
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function makeCode() {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
  return 'SOL-' + raw.slice(0, 6) + '-' + raw.slice(6);
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!URL || !PUBLIC_KEY || !SERVICE_KEY) return res.status(503).json({ error: 'Early access is not configured.' });
  try {
    const user = await userFrom(req);
    if (!user?.id) return res.status(401).json({ error: 'Sign in to use SOL early access.' });
    if (req.method === 'GET') {
      if (await isAdmin(user)) {
        const q = new URLSearchParams({ select: 'id,created_at,expires_at,redeemed_at,redeemed_by,revoked_at', order: 'created_at.desc', limit: '100' });
        const r = await fetch(URL + '/rest/v1/sol_early_access_codes?' + q, { headers: headers() });
        if (!r.ok) throw new Error('Could not load early-access codes.');
        return res.status(200).json({ admin: true, codes: await r.json() });
      }
      const q = new URLSearchParams({ select: 'id,expires_at,revoked_at', redeemed_by: 'eq.' + user.id, revoked_at: 'is.null', limit: '1' });
      const r = await fetch(URL + '/rest/v1/sol_early_access_codes?' + q, { headers: headers() });
      if (!r.ok) throw new Error('Could not verify early-access status.');
      const rows = await r.json();
      const active = rows.some(row => !row.expires_at || new Date(row.expires_at).getTime() > Date.now());
      return res.status(200).json({ admin: false, hasAccess: active });
    }
    const action = String(req.body?.action || '');
    if (action === 'redeem') {
      const code = String(req.body?.code || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!/^SOL-[A-F0-9]{6}-[A-F0-9]{6}$/.test(code)) return res.status(400).json({ error: 'Enter a valid SOL access code.' });
      const q = new URLSearchParams({ select: 'id,expires_at,revoked_at,redeemed_by', code_hash: 'eq.' + hash(code), limit: '1' });
      const found = await fetch(URL + '/rest/v1/sol_early_access_codes?' + q, { headers: headers() });
      if (!found.ok) throw new Error('Could not verify that code.');
      const rows = await found.json(), row = rows[0];
      if (!row || row.revoked_at || row.redeemed_by || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())) {
        return res.status(400).json({ error: 'That code is invalid, expired, or has already been used.' });
      }
      const update = new URLSearchParams({ id: 'eq.' + row.id, redeemed_by: 'is.null', revoked_at: 'is.null' });
      const saved = await fetch(URL + '/rest/v1/sol_early_access_codes?' + update, {
        method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify({ redeemed_by: user.id, redeemed_at: new Date().toISOString() })
      });
      if (!saved.ok) throw new Error('Could not redeem that code.');
      if (!(await saved.json()).length) return res.status(409).json({ error: 'That code was just used. Ask SOL for another one.' });
      return res.status(200).json({ ok: true, hasAccess: true });
    }
    if (!(await isAdmin(user))) return res.status(403).json({ error: 'Only SOL admins can manage access codes.' });
    if (action === 'create') {
      const count = Math.max(1, Math.min(50, Number.parseInt(req.body?.count, 10) || 1));
      let expiresAt = null;
      if (req.body?.expiresAt) {
        const parsed = new Date(req.body.expiresAt);
        if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) return res.status(400).json({ error: 'Choose a future expiry date.' });
        expiresAt = parsed.toISOString();
      }
      const codes = Array.from({ length: count }, () => makeCode());
      const rows = codes.map(code => ({ code_hash: hash(code), created_by: user.id, expires_at: expiresAt }));
      const saved = await fetch(URL + '/rest/v1/sol_early_access_codes', {
        method: 'POST', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify(rows)
      });
      if (!saved.ok) { console.error('SOL code creation failed:', saved.status, await saved.text()); throw new Error('Could not create access codes. Run the Supabase migration first.'); }
      return res.status(201).json({ codes, expiresAt });
    }
    if (action === 'revoke') {
      const id = String(req.body?.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid access-code record.' });
      const q = new URLSearchParams({ id: 'eq.' + id, revoked_at: 'is.null' });
      const r = await fetch(URL + '/rest/v1/sol_early_access_codes?' + q, {
        method: 'PATCH', headers: { ...headers(), Prefer: 'return=minimal' },
        body: JSON.stringify({ revoked_at: new Date().toISOString() })
      });
      if (!r.ok) throw new Error('Could not revoke that code.');
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error) {
    console.error('SOL early-access error:', error.message);
    return res.status(500).json({ error: error.message || 'Early access is temporarily unavailable.' });
  }
};
