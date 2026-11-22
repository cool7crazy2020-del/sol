# SOL shared publishing setup

This prepares the secure Supabase database for SOL's public product catalog. The storefront frontend is now configured with the browser-safe project URL and publishable key in `supabase-config.js`. The shared catalog will work after the SQL setup and admin membership steps below are completed.

## 1. Create the Supabase project

A parent or guardian should create/manage the Supabase account and project:
https://supabase.com/dashboard

Use the free plan to start. In the project, open **SQL Editor**, paste and run `supabase/schema.sql`.

## 2. Create the SOL admin login

In Supabase, open **Authentication → Users** and create/invite the adult-managed SOL admin account.

Copy that user's UUID. In SQL Editor, run this, replacing the UUID:

```sql
insert into public.sol_admins (user_id)
values ('PASTE-ADMIN-USER-UUID-HERE');
```

Only a user explicitly inserted into `sol_admins` can publish, edit, or delete products. Do not expose a service-role key in the website.

## 3. Get the browser-safe project settings

Open **Project Settings → API** and copy:
- Project URL
- Publishable key (or legacy anon public key)

These two values are intended for browser use with the Row Level Security policies in `schema.sql`. Never share or put the **service_role / secret key** in the website, GitHub, or chat.

## 4. Sign in to SOL Studio

The storefront loads published products from `sol_products`. To manage the catalog, open SOL Studio and enter the email and password for the adult-managed Supabase admin account. The app checks that the signed-in user is listed in `sol_admins` before allowing Studio access.

New products are saved to the shared database. The Hide/Show control unpublishes or republishes a product. Uploaded product images are placed in the `sol-products` Storage bucket. If cloud setup has not been completed, the storefront keeps the local browser catalog and displays a setup warning.

## Publishing behavior planned

- Draft products are visible only to the signed-in SOL admin.
- Published products appear on the public storefront.
- Unpublishing removes them from the public catalog without deleting them.
- Product images live in the public `sol-products` storage bucket; only SOL admins can upload or delete them.

## Important

Do not accept real customer orders or payments until the checkout, order storage, privacy rules, and shipping workflows have been separately implemented and tested.
