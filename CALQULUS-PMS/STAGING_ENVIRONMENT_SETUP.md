# CALQULUS RMS Staging Environment Setup Guide

## Overview

This guide covers setting up a staging environment for CALQULUS RMS to test changes before deploying to production. Staging environments are essential for:
- Testing new features
- Validating database migrations
- Performance testing
- User acceptance testing
- Regression testing

## Architecture

```
Production:  www.calqulus.site → Supabase Production
Staging:     staging.calqulusrms.com → Supabase Staging
Development: localhost:5173 → Supabase Local/Development
```

## Vercel Staging Setup

### 1. Create Staging Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import the CALQULUS RMS GitHub repository
4. Name it: `calqulusrms-staging`
5. Framework: Vite (auto-detected)

### 2. Configure Staging Environment

#### Environment Variables

Add these to Vercel staging project settings:

```bash
# Supabase Staging
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-staging-anon-key

# Sentry Staging
VITE_SENTRY_DSN=https://your-staging-dsn@sentry.io/project-id
VITE_SENTRY_ENV=staging
VITE_APP_VERSION=staging

# Demo Controls (enable for testing)
VITE_ENABLE_PUBLIC_DEMO=true
VITE_ENABLE_DEMO_SEED=true
VITE_DEMO_SEED_SECRET=your-staging-secret

# Auth Timeout (longer for testing)
VITE_AUTH_TIMEOUT_MS=15000
```

#### Custom Domain

1. Go to Settings → Domains
2. Add domain: `staging.calqulusrms.com`
3. Configure DNS:
   ```
   CNAME staging → cname.vercel-dns.com
   ```

### 3. Configure Branch Deployment

1. Go to Settings → Git
2. Set "Production Branch" to `main`
3. Set "Preview Branch Deployment" to `staging`
4. Enable automatic deployments for `staging` branch

## Supabase Staging Setup

### 1. Create Staging Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Name: `calqulusrms-staging`
4. Database Password: Generate strong password
5. Region: Same as production (for consistency)

### 2. Apply Migrations

#### Option A: Supabase CLI

```bash
# Link to staging project
supabase link --project-ref YOUR_STAGING_PROJECT_ID

# Push all migrations
supabase db push

# Deploy edge functions
supabase functions deploy
```

#### Option B: SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration file in order from `supabase/migrations/`
3. Start with `20230101000000_base_schema.sql`
4. End with latest migration

### 3. Configure Staging Secrets

Go to Supabase Dashboard → Edge Functions → Secrets

Add staging-specific secrets:
```bash
# Email (use staging email service)
RESEND_API_KEY=your-staging-resend-key
RESEND_FROM_DOMAIN=staging.calqulusrms.com
RESEND_FROM_EMAIL=CALQULUS RMS Staging <staging@calqulusrms.com>

# M-Pesa (use sandbox)
MPESA_CONSUMER_KEY=your-test-consumer-key
MPESA_CONSUMER_SECRET=your-test-consumer-secret
MPESA_PASSKEY=your-test-passkey
MPESA_SHORTCODE=174379 (Safaricom test shortcode)
MPESA_CALLBACK_SECRET=your-staging-callback-secret
MPESA_ENV=sandbox

# SMS (use test credentials)
TWILIO_ACCOUNT_SID=your-test-sid
TWILIO_AUTH_TOKEN=your-test-token
TWILIO_FROM_NUMBER=+15550000000

# Site URLs
SITE_URL=https://staging.calqulusrms.com
APP_URL=https://staging.calqulusrms.com

# Demo Secret
DEMO_SECRET=your-staging-demo-secret
BOOTSTRAP_SECRET=your-staging-bootstrap-secret

# Stripe (use test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### 4. Create Storage Buckets

Go to Supabase Dashboard → Storage

Create buckets:
- `maintenance-photos` (Public)
- `tenant-photos` (Public)
- `condition-photos` (Public)
- `documents` (Private)

Enable public access for photo buckets.

### 5. Seed Test Data

#### Option A: Demo Seed

Set environment variables:
```bash
VITE_ENABLE_DEMO_SEED=true
VITE_DEMO_SEED_SECRET=your-secret
```

Visit `/demo-seed?secret=your-secret` to seed data.

#### Option B: Manual Seed

Run SQL in Supabase SQL Editor:

```sql
-- Create test manager
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
  gen_random_uuid(),
  'staging-manager@calqulusrms.com',
  crypt('Test@1234', gen_salt('bf')),
  now()
);

-- Add manager role
INSERT INTO public.user_roles (user_id, role, approval_status)
SELECT id, 'manager', 'approved'
FROM auth.users
WHERE email = 'staging-manager@calqulusrms.com';

-- Create test tenant
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
  gen_random_uuid(),
  'staging-tenant@calqulusrms.com',
  crypt('Test@1234', gen_salt('bf')),
  now()
);

-- Add tenant role
INSERT INTO public.user_roles (user_id, role, approval_status)
SELECT id, 'tenant', 'approved'
FROM auth.users
WHERE email = 'staging-tenant@calqulusrms.com';
```

## Git Workflow

### Branch Strategy

```
main (production)
  ↑
staging (staging environment)
  ↑
feature/* (feature branches)
```

### Development Workflow

1. Create feature branch:
```bash
git checkout -b feature/new-feature
```

2. Make changes and commit:
```bash
git add .
git commit -m "feat: add new feature"
```

3. Push to GitHub:
```bash
git push origin feature/new-feature
```

4. Create pull request to `staging` branch

5. Merge to `staging` → Auto-deploys to staging

6. Test on staging

7. Create pull request from `staging` to `main`

8. Merge to `main` → Auto-deploys to production

### Staging Branch Setup

```bash
# Create staging branch
git checkout -b staging

# Push to GitHub
git push origin staging

# Set as default branch for PRs (optional)
```

## Testing on Staging

### Test Checklist

Before promoting to production:

- [ ] All E2E tests pass
- [ ] Manual testing of new features
- [ ] Database migrations applied successfully
- [ ] Edge functions deployed
- [ ] Email/SMS notifications working
- [ ] Payment flows tested (M-Pesa sandbox)
- [ ] Performance acceptable
- [ ] No errors in Sentry
- [ ] Responsive design verified
- [ ] Cross-browser testing

### Test Accounts

Staging-specific test accounts:
- Manager: staging-manager@calqulusrms.com / Test@1234
- Tenant: staging-tenant@calqulusrms.com / Test@1234
- Webhost: staging-webhost@calqulusrms.com / Test@1234

### Payment Testing

Use M-Pesa sandbox:
- Shortcode: 174379
- Test phone: +2547...
- Test amount: 1-100 KES

## Monitoring Staging

### Sentry Staging Project

Create separate Sentry project for staging:
- DSN: Different from production
- Environment: `staging`
- Alerts: Less aggressive than production

### Vercel Analytics

Enable Vercel Analytics on staging:
- Go to Analytics tab
- Enable for staging project
- Monitor performance metrics

### Supabase Logs

Monitor Supabase logs:
- Database logs
- Edge function logs
- API logs
- Auth logs

## Data Management

### Database Reset

To reset staging database:

```bash
# Option 1: Supabase CLI
supabase db reset

# Option 2: Dashboard
# Go to Settings → Database → Reset Database Password
# This will reset the entire database
```

### Data Refresh

To refresh staging with production data (use with caution):

```bash
# Export production data
supabase db dump --db-url production-url > production-backup.sql

# Import to staging
supabase db reset --db-url staging-url
psql staging-url < production-backup.sql

# Mask sensitive data
UPDATE auth.users SET email = CONCAT('staging-', email);
```

### Data Anonymization

Anonymize production data before importing to staging:

```sql
-- Anonymize emails
UPDATE auth.users 
SET email = CONCAT('staging-', SUBSTRING(email FROM POSITION('@' IN email)));

-- Anonymize phone numbers
UPDATE tenants 
SET phone = CONCAT('+2547', SUBSTRING(phone FROM 4));

-- Reset passwords
UPDATE auth.users
SET encrypted_password = crypt('Test@1234', gen_salt('bf'));
```

## Security Considerations

### Access Control

1. Restrict staging access:
   - Vercel: Team members only
   - Supabase: Team members only
   - Sentry: Team members only

2. Use staging-specific secrets:
   - Never use production secrets
   - Rotate staging secrets regularly

3. Enable authentication:
   - Require authentication for staging
   - Use IP whitelist if needed

### Data Privacy

1. Never use real user data
2. Anonymize any imported data
3. Clear staging data regularly
4. Comply with GDPR even for staging

### Rate Limiting

Configure less aggressive rate limiting for staging:
```typescript
// staging-specific rate limits
const stagingRateLimit = 1000 // vs 100 for production
```

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/staging.yml`:

```yaml
name: Staging Deployment

on:
  push:
    branches: [staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--scope your-team'
          working-directory: ./
```

### Environment Secrets

Add to GitHub Secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Troubleshooting

### Deployment Failures

1. Check Vercel build logs
2. Verify environment variables
3. Check for TypeScript errors
4. Verify Supabase connection

### Database Issues

1. Check migration order
2. Verify RLS policies
3. Check for missing indexes
4. Verify foreign key constraints

### Edge Function Errors

1. Check function logs
2. Verify secrets are set
3. Check for timeout issues
4. Verify function dependencies

### Authentication Issues

1. Check redirect URLs in Supabase
2. Verify JWT tokens
3. Check session configuration
4. Verify RLS policies

## Best Practices

### 1. Keep Staging Clean

- Reset staging database weekly
- Clear old test data
- Remove unused test accounts

### 2. Test Like Production

- Use production-like data volumes
- Test with real user scenarios
- Monitor performance metrics
- Test payment flows

### 3. Document Changes

- Document staging-specific configurations
- Track test data requirements
- Document known issues
- Maintain test account credentials

### 4. Automate Testing

- Run E2E tests on staging
- Automate smoke tests
- Monitor for regressions
- Set up performance budgets

### 5. Monitor Staging

- Set up staging-specific alerts
- Monitor error rates
- Track performance metrics
- Review logs regularly

## Cost Management

### Vercel Costs

- Staging uses less bandwidth than production
- Limit preview deployments
- Use team features for cost optimization

### Supabase Costs

- Use smaller database tier for staging
- Limit edge function invocations
- Monitor storage usage
- Clean up old data regularly

### Sentry Costs

- Use lower sampling rates for staging
- Limit session replay
- Clean up old projects
- Monitor data volume

## Maintenance

### Regular Tasks

**Weekly:**
- Review staging logs
- Check for errors
- Test critical flows
- Clean up test data

**Monthly:**
- Update dependencies
- Review security settings
- Rotate secrets
- Update documentation

**Quarterly:**
- Review staging architecture
- Optimize performance
- Update test data
- Review costs

### Health Checks

Implement health check endpoint:
```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: 'staging',
    timestamp: new Date().toISOString()
  })
})
```

## Rollback Procedure

### Quick Rollback

If staging deployment fails:

```bash
# Revert commit
git revert HEAD

# Push to staging
git push origin staging

# Vercel will auto-deploy
```

### Database Rollback

If migration fails:

```bash
# Rollback last migration
supabase migration down

# Or reset database
supabase db reset
```

### Full Staging Reset

If staging is completely broken:

1. Delete Vercel staging project
2. Delete Supabase staging project
3. Recreate both from scratch
4. Re-apply all migrations
5. Re-deploy edge functions
6. Re-seed test data

## Resources

- [Vercel Staging Docs](https://vercel.com/docs/concepts/projects/environments)
- [Supabase Environments](https://supabase.com/docs/guides/platform/environments)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Sentry Environments](https://docs.sentry.io/product/sentry-basics/environments/)
