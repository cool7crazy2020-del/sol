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
    return res.status(200).json({ payment_status: session.payment_status, status: session.status });
  } catch (error) {
    console.error('SOL payment verification error:', error.message);
    return res.status(500).json({ error: 'Could not verify payment yet.' });
  }
};
