# Production Checklist

## Frontend environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ENABLE_PUBLIC_DEMO=false`
- `VITE_ENABLE_DEMO_SEED=false`
- `VITE_DEMO_SEED_SECRET=`

## Supabase required secrets

- `AFRICASTALKING_API_KEY`
- `AFRICASTALKING_USERNAME`
- `APP_URL`
- `APP_VERSION`
- `AT_API_KEY`
- `AT_USERNAME`
- `BOOTSTRAP_SECRET`
- `DEMO_SECRET`
- `ENVIRONMENT`
- `LOVABLE_API_KEY`
- `META_PHONE_NUMBER_ID`
- `META_WHATSAPP_TOKEN`
- `NODE_ENV`
- `PAYSTACK_SECRET_KEY`
- `PHONE_NUMBER_ID`
- `REPORT_FROM_EMAIL`
- `RESEND_API_KEY`
- `RESEND_FROM_DOMAIN`
- `RESEND_FROM_EMAIL`
- `SENDGRID_API_KEY`
- `SITE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `WHATSAPP_ACCESS_TOKEN`

## Payment provider secrets

- `MPESA_CALLBACK_SECRET`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_ENV`
- `MPESA_PASSKEY`
- `MPESA_SHORTCODE`

## Deployment checks

- Run `npm run verify` locally before deploy.
- Confirm all Supabase functions are deployed.
- Confirm auth redirect URLs include your production and local domains.
- Disable demo controls in production unless explicitly needed.
