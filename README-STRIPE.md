# SOL Stripe Checkout setup

The storefront uses Stripe-hosted Checkout. The browser never receives the Stripe secret key, and the server calculates prices from published rows in Supabase rather than trusting prices sent by the browser.

## Vercel environment variables

Add these to the SOL Vercel project (Production, Preview, and Development as appropriate):

- `STRIPE_SECRET_KEY`: secret key from the Stripe account owned/managed by the parent or legal guardian.
- `STRIPE_SHIPPING_RATE_ID`: a shipping rate created in Stripe (for example, the store's actual shipping price). Do not guess a shipping price.
- `SUPABASE_URL`: `https://ltwtdfztusajgmigbyrb.supabase.co`
- `SUPABASE_ANON_KEY`: the Supabase publishable/anon key. This is not a service-role key.
- `SOL_SITE_URL`: `https://shopsol.vercel.app`

After adding variables, redeploy the project.

## Stripe Dashboard

1. Start in Test/Sandbox mode.
2. Create the shipping rate that matches SOL's actual shipping policy.
3. Add a webhook endpoint at `https://shopsol.vercel.app/api/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
4. Put the endpoint's signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`.
5. Complete a test checkout before switching to live mode.

## Important

- Automatic tax is intentionally not enabled in code. The store owner should confirm sales-tax registration and configure tax collection with their adult account owner before enabling it.
- The current checkout only allows US shipping addresses.
- A completed Stripe payment is verified server-side before the browser clears its cart.
- The webhook/order database is not installed by this initial checkout integration yet. Do not treat a successful redirect as a complete fulfillment workflow until the webhook and order table are added.
- Never put `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or a Supabase service-role key in frontend files or chat.
