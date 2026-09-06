# ADR-001: Supabase as Backend-as-a-Service

**Status**: Accepted  
**Date**: 2024-01-15  
**Deciders**: Platform Team

## Context

We needed a backend infrastructure for the CALQULUS RMS property management platform. The requirements included:
- PostgreSQL database with Row-Level Security (RLS)
- Authentication (email, phone, OAuth)
- Real-time subscriptions
- File storage
- Edge functions for serverless logic
- Minimal DevOps overhead

## Decision

We chose **Supabase** as our Backend-as-a-Service (BaaS) platform.

### Rationale

1. **PostgreSQL Foundation**: Supabase provides a fully managed PostgreSQL database with excellent performance, ACID compliance, and mature tooling.

2. **Row-Level Security (RLS)**: Native support for RLS allows us to implement multi-tenant data isolation at the database level, ensuring tenants can never access each other's data.

3. **Authentication**: Built-in auth supports email/password, phone (OTP), and OAuth providers (Google, etc.) with JWT tokens.

4. **Edge Functions**: Deno-based edge functions run close to users for low-latency API logic.

5. **Cost-Effective**: Generous free tier with usage-based pricing that scales with our growth.

## Consequences

### Benefits

- **Rapid Development**: Pre-built auth, storage, and real-time features accelerated development
- **TypeScript Support**: Auto-generated types from database schema
- **Real-time**: Built-in WebSocket support for live updates
- **Security**: RLS policies enforce data isolation at the database level

### Drawbacks

- **Vendor Lock-in**: Application tightly coupled to Supabase-specific APIs
- **Cold Starts**: Edge functions may have cold start latency
- **Customization Limits**: Limited ability to customize database internals
- **Cost at Scale**: Usage-based pricing may become expensive at high volume

## Implementation Details

### Database Schema
```sql
-- Core tables with RLS enabled
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES auth.users NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager can CRUD own properties" ON properties
  FOR ALL USING (auth.uid() = manager_id);
```

### Authentication Flow
```typescript
// Client-side auth
const { data, error } = await supabase.auth.signInWithPassword({
  email, password
});
```

### Edge Functions
```typescript
// supabase/functions/process-payment/index.ts
Deno.serve(async (req) => {
  // Payment processing logic
  return new Response(JSON.stringify({ success: true }));
});
```

## References

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
