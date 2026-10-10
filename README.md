# Celik Minda PASTI — Next.js + Supabase + Bayarcash

Mobile-first green/Islamic-themed storefront for Vercel. Product prices are read from Supabase. Checkout creates an order on the server and redirects the customer to Bayarcash.

## Before deploying

1. Create a Supabase project.
2. Run the SQL schema already supplied in the chat. Ensure the six `celik_minda_products` SKUs exist:
   - `CMA-PDF` RM10
   - `CMA-HC` RM15
   - `CMB-PDF` RM10
   - `CMB-HC` RM15
   - `CMAB-PDF` RM18
   - `CMAB-HC` RM20, includes postage
3. In Bayarcash console, get Personal Access Token and API Secret Key under Profile > Integration, and Portal Key under Portal.
4. Copy `.env.example` to `.env.local` and fill in real credentials. Never commit `.env.local`.
   Required server variables: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BAYARCASH_API_TOKEN`, `BAYARCASH_API_SECRET_KEY`, `BAYARCASH_PORTAL_KEY`, `NEXT_PUBLIC_SITE_URL`. The browser key `NEXT_PUBLIC_SUPABASE_ANON_KEY` is included for future client-side Supabase use; server routes use the service-role key.
5. Install and test locally:
   ```bash
   npm install
   npm run dev
   ```
6. Push the folder to a private GitHub repository and import it into Vercel, or upload it to an existing project.
7. Add every environment variable from `.env.example` in Vercel Project Settings > Environment Variables. Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS URL.
8. Keep `BAYARCASH_SANDBOX=true` while testing. Switch to `false` only after a successful sandbox test and the merchant account is enabled for live transactions.
9. Configure Bayarcash callback URL to `https://YOUR-DOMAIN/api/bayarcash/callback` if your portal configuration requires it.
10. Test the callback and payment status using Bayarcash sandbox before accepting real payments.

## Important

- The Supabase `service_role` key and Bayarcash token/secret are server-only environment variables. Never use them in `NEXT_PUBLIC_*` variables or browser code.
- The callback validates the Bayarcash transaction checksum before changing order status.
- The current callback expects the Bayarcash v3 transaction callback to arrive as form data, as described by the SDK. Confirm with the sandbox payload before production.
- Supabase server client initialization is lazy so missing environment variables do not crash `next build`; API routes still return configuration errors until the variables are set.
- The return page is not proof of payment. The verified server-to-server callback updates the order.
- Confirm your Bayarcash account has FPX enabled. The integration currently requests FPX channel 1.
- PDF email delivery uses the configured Google Drive folder links in `lib/email-delivery.ts`; it does not use signed Supabase Storage URLs.
- Add `RESEND_API_KEY` and `EMAIL_FROM` to Vercel Environment Variables to enable automatic email delivery.
- Verify your sender domain in Resend before live sending. Google Drive folder links are shareable and are not protected per customer.
- The callback validates Bayarcash transaction checksum before marking paid and initiating delivery. Confirm callback payload/status behavior in sandbox before production.
- The page uses an illustrative cover mockup made with CSS; replace it with the real product cover and genuine worksheet previews before publishing.
- No credentials are included in this archive.


## Gambar produk
Tiga gambar cover yang dipaparkan dalam laman web ialah gambar yang dibekalkan oleh pemilik dalam perbualan ini:
- `public/images/set-a-6-tahun.jpg`
- `public/images/set-b-5-tahun.jpg`
- `public/images/combo-set-a-b.jpg`

Gambar disimpan secara setempat dalam projek Next.js; tidak memerlukan Supabase Storage atau URL gambar pihak lain.


## Auto e-mel selepas pembayaran
1. Run `supabase/migrations/20261009_email_delivery.sql` in Supabase SQL Editor.
2. In Supabase Storage, create a **private** bucket called `celik-minda-pdfs`. Upload your actual PDFs with exact names `set-a.pdf` and `set-b.pdf` (or change the corresponding environment variables).
3. Create a Resend account, verify your sender domain, and add `RESEND_API_KEY` plus `EMAIL_FROM` in Vercel Environment Variables.
4. Add the PDF path/bucket environment variables listed in `.env.example`.
5. Redeploy. Run a sandbox purchase for each PDF SKU and verify the email arrives. Do not go live until Bayarcash callback verification and Resend sender are confirmed.
6. The email includes secure signed download links, valid for 7 days by default. It does not attach the PDF directly. Hardcopy-only orders are not sent PDFs.


## Notes for the current Supabase setup

- Product queries use the existing columns `age_group`, `price_sen`, and `active` (prices are stored in sen and converted to RM in the app).
- PDF email delivery uses the two Google Drive folder links configured in `lib/email-delivery.ts`; Combo PDF sends both links.
- Bayarcash is implemented in the checkout and callback routes but still requires valid environment variables in Vercel and a real/sandbox end-to-end test. Do not consider payments verified until the callback is tested.
- Google Drive links are folder links. Anyone with access to those links may be able to share them; this is not DRM or per-customer protected delivery.
