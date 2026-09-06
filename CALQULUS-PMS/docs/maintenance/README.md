# Maintenance Documentation

This directory contains maintenance procedures for CALQULUS RMS.

## Table of Contents

1. [Release Process](#release-process)
2. [Database Migrations](#database-migrations)
3. [Monitoring & Alerts](#monitoring--alerts)
4. [Backup & Recovery](#backup--recovery)
5. [Performance Tuning](#performance-tuning)

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
  │     │     └── Bug fixes
  │     └──────── New features (backwards compatible)
  └────────────── Breaking changes
```

### Release Schedule

- **Patch releases**: As needed (bug fixes)
- **Minor releases**: Every 2 weeks (new features)
- **Major releases**: Quarterly (breaking changes)

### Release Checklist

```bash
# 1. Update version
npm version patch  # or minor, major

# 2. Update changelog
git log --oneline v1.0.0..HEAD > CHANGELOG.md

# 3. Create release branch
git checkout -b release/v1.0.0

# 4. Run full test suite
npm run test:all

# 5. Deploy to staging
git push origin release/v1.0.0

# 6. Verify staging
npm run smoke:deploy

# 7. Create GitHub release
gh release create v1.0.0 --title "v1.0.0" --notes @CHANGELOG.md

# 8. Merge to main
git checkout main
git merge release/v1.0.0
git push origin main

# 9. Deploy to production
npx vercel --prod
```

## Database Migrations

### Creating a Migration

```bash
# Create new migration
npx supabase migration new add_property_features

# Edit the migration file
# supabase/migrations/20240101120000_add_property_features.sql
```

### Migration Best Practices

1. **Always add, never modify**: New migrations only
2. **Test on staging first**: Apply, verify, then production
3. **Prepare rollback**: Always have rollback SQL ready
4. **Use transactions**: Wrap in `BEGIN...COMMIT`

### Migration Example

```sql
-- Good migration
BEGIN;

-- Add new column with default
ALTER TABLE properties 
ADD COLUMN owner_phone TEXT DEFAULT NULL;

-- Add index for common queries
CREATE INDEX idx_properties_owner_phone 
ON properties(owner_phone) 
WHERE owner_phone IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN properties.owner_phone 
IS 'Owner phone number for notifications';

COMMIT;
```

### Rolling Back

```bash
# Rollback last migration
npx supabase db reset

# Or apply rollback SQL
psql $DATABASE_URL -f supabase/migrations/rollback/xxx.sql
```

## Monitoring & Alerts

### Key Metrics

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | >1% | >5% | Page on-call |
| P99 Latency | >500ms | >2000ms | Scale or optimize |
| Payment Success | <95% | <90% | Investigate payments |
| DB Connections | >70% | >90% | Check for leaks |

### Alert Configuration

```yaml
# monitoring/alerts.yml
alerts:
  - name: high-error-rate
    condition: error_rate > 0.05
    severity: critical
    channels: [pagerduty, slack]
    
  - name: payment-failures
    condition: payment_success_rate < 0.90
    severity: critical
    channels: [pagerduty]
    
  - name: slow-queries
    condition: query_duration_p99 > 2000
    severity: warning
    channels: [slack]
```

## Backup & Recovery

### Backup Schedule

| Type | Frequency | Retention |
|------|-----------|-----------|
| Database | Continuous (via Supabase) | 7 days |
| File Storage | Daily | 30 days |
| Config | On change | In Git |

### Recovery Procedures

#### Point-in-Time Recovery

```bash
# Restore to specific timestamp
npx supabase db restore --timestamp "2024-01-01 12:00:00"
```

#### Full Restore

```bash
# Export backup
npx supabase db dump > backup.sql

# Restore to new instance
psql $NEW_DATABASE_URL < backup.sql
```

## Performance Tuning

### Database Optimization

```sql
-- Analyze tables for query optimization
ANALYZE;

-- Vacuum to reclaim space
VACUUM FULL;

-- Check index usage
SELECT 
  indexrelname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Frontend Performance

```typescript
// Use React Query for caching
const { data } = useQuery({
  queryKey: ['properties'],
  queryFn: fetchProperties,
  staleTime: 30_000,  // 30 seconds
  gcTime: 10 * 60_000, // 10 minutes
});
```

### Edge Function Optimization

```typescript
// Cold start optimization
// 1. Minimize imports
// 2. Use edge runtime
// 3. Cache responses where possible

Deno.serve(async (req) => {
  // Cache for 5 minutes
  const cacheKey = req.url;
  const cached = await KV.get(cacheKey);
  
  if (cached) {
    return new Response(cached, {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  }
  
  // Process...
  const response = new Response(JSON.stringify(data));
  
  // Store in cache
  await KV.set(cacheKey, response.clone());
  
  return response;
});
```
