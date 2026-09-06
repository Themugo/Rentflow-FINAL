# Staging / production smoke test

This is the smoke procedure that matches the **deployed** CALQULUS PMS app on Vercel (`https://www.calqulus.site`). It does not describe a Netlify host.

## Automated SPA smoke

From a machine that can reach the live origin:

```bash
SMOKE_BASE_URL=https://www.calqulus.site npm run smoke:deploy
```

The script checks:

- HTTP 200 for `/`, `/legal`, `/install`, `/pricing`, `/auth`
- SPA shell (`id="root"`)
- Security headers: `x-content-type-options`, `x-frame-options`, `referrer-policy`, `permissions-policy`, `content-security-policy`
- Referenced JS/CSS assets return 200

This is a **shell** check. It does not log in, take payment, or prove RLS.

## Role smoke (manual, requires real accounts)

Use staging or production test accounts. Do not record passwords in this file.

1. **Manager** — `/auth` → dashboard → property list loads without a raw error dump.
2. **Landlord** — `/landlord/login` → `/landlord/dashboard` → portfolio cards, no tenant names.
3. **Tenant** — `/tenant/login` → `/portal` → balance / bills visible; pay is blocked offline.
4. **Webhost** — `/webhost/login` → `/webhost` → no tenant PII routes.

## What this does not prove

- Database backup restore
- Edge Function `health-check` (currently not deployed; live invoke returns 404)
- M-Pesa / Stripe webhook idempotency against Safaricom/Stripe
- Pending SQL migrations actually applied on the live project
