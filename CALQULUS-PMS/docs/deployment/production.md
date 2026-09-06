# Production Deployment Guide

This document outlines the complete production deployment procedure for CALQULUS RMS.

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing: `npm run test:all`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] ESLint passes: `npm run lint`
- [ ] No security vulnerabilities: `npm audit`

### Build Verification
```bash
# Run full verification
npm run verify
```

### Database Migrations
- [ ] All migrations applied to staging
- [ ] Migration tested on staging
- [ ] Rollback migration prepared

### Monitoring
- [ ] Sentry error tracking verified
- [ ] Grafana dashboards accessible
- [ ] PagerDuty alerts configured

## Deployment Steps

### 1. Create Release Branch

```bash
git checkout main
git pull origin main
git checkout -b release/$(date +%Y%m%d)
git push origin release/$(date +%Y%m%d)
```

### 2. Run Pre-Deployment Checks

```bash
# Start web server for tests
npm run dev &
DEV_PID=$!

# Run smoke tests
sleep 5
curl -f http://localhost:5173 > /dev/null

# Run E2E tests
npm run test:e2e:ci

# Stop dev server
kill $DEV_PID
```

### 3. Deploy to Supabase (if migrations needed)

```bash
# Link Supabase project
npx supabase link --project-ref aelzsqxllkypbzslxyju

# Push migrations
npx supabase db push

# Verify migration
npx supabase db diff
```

### 4. Deploy Edge Functions

```bash
# Deploy all edge functions
npx supabase functions deploy

# Or deploy specific function
npx supabase functions deploy send-tenant-invitation
```

### 5. Deploy to Vercel

```bash
# Deploy to production
npx vercel --prod

# Or use the deployment script
node scripts/deploy-production.mjs
```

### 6. Verify Deployment

```bash
# Health check
curl https://www.calqulus.site/api/health

# Run smoke tests
node scripts/smoke-deploy.mjs
```

## Post-Deployment Verification

### Functional Tests
```bash
# Test authentication
curl -X POST https://www.calqulus.site/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Test payment endpoint
curl -X POST https://www.calqulus.site/api/payments/initiate-mpesa-stk-push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":"test","amount":100}'
```

### Monitoring
1. Check Sentry dashboard for errors
2. Verify Grafana metrics flowing
3. Check payment processing dashboard

## Rollback Procedure

If issues are detected:

### Frontend Rollback (Vercel)

```bash
# List deployments
npx vercel ls

# Rollback to previous
npx vercel rollback [deployment-url]
```

### Database Rollback

```bash
# Rollback last migration
npx supabase db reset --db-url $PRODUCTION_DB_URL

# Or apply specific backup
psql $PRODUCTION_DB_URL -f backups/$(date +%Y%m%d).sql
```

### Edge Functions Rollback

```bash
# Deploy previous version
npx supabase functions deploy --no-verify-jwt
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | `eyJ...` |
| `VITE_SENTRY_DSN` | Sentry error tracking | `https://xxx@sentry.io/xxx` |
| `VITE_MPESA_CONSUMER_KEY` | M-Pesa API key | `xxx` |
| `VITE_MPESA_SHORTCODE` | M-Pesa business shortcode | `123456` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe API key | `pk_live_...` |

## Troubleshooting

### Deployment Stuck
1. Check Vercel dashboard for build logs
2. Verify Supabase project status
3. Check GitHub Actions workflow

### Edge Function Errors
1. Check Supabase Edge Function logs
2. Verify environment variables set
3. Test function locally with `supabase functions serve`

### Database Connection Issues
1. Verify Supabase project is running
2. Check connection string format
3. Verify IP allowlist includes Vercel IPs
