# Developer Onboarding

Welcome to the CALQULUS RMS development team! This guide will help you get started with the codebase.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Development Workflow](#development-workflow)
4. [Common Tasks](#common-tasks)
5. [Testing Guide](#testing-guide)
6. [Resources](#resources)

## Getting Started

### Prerequisites

- Node.js 18+ (use `nvm` for version management)
- Git
- Docker (optional, for Supabase local development)
- Supabase CLI
- Vercel CLI

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/Themugo/CALQULUS-PMS.git
cd CALQULUS-PMS

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### Required Accounts

- [ ] GitHub account with repository access
- [ ] Supabase account (ask team lead)
- [ ] Vercel account (ask team lead)
- [ ] Sentry account for error tracking

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│                    Vite + TypeScript                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Backend (BaaS)                     │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL + RLS │ Auth │ Storage │ Edge Functions │ Realtime │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       External APIs                          │
│         M-Pesa │ Stripe │ WhatsApp │ Email (SendGrid)        │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| State | React Query, Zustand |
| Routing | React Router 7 |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) |
| Payments | M-Pesa, Stripe |
| Deployment | Vercel |
| Monitoring | Sentry, Grafana |

### Key Directories

```
CALQULUS-PMS/
├── src/
│   ├── features/        # Feature modules
│   │   ├── auth/       # Authentication
│   │   ├── payments/    # Payment processing
│   │   ├── tenants/     # Tenant management
│   │   ├── properties/  # Property management
│   │   └── ...
│   ├── shared/          # Shared utilities
│   │   ├── components/  # UI components
│   │   ├── hooks/      # Custom hooks
│   │   ├── lib/        # Libraries
│   │   └── types/      # TypeScript types
│   ├── test/           # Test files
│   └── integrations/    # External integrations
├── supabase/
│   ├── functions/       # Edge functions
│   ├── migrations/      # Database migrations
│   └── seed/            # Database seeds
├── docs/               # Documentation
├── e2e/                # Playwright E2E tests
└── monitoring/         # Monitoring configs
```

## Development Workflow

### Branch Naming

```
feature/xxx-description     # New features
bugfix/xxx-description     # Bug fixes
hotfix/xxx-description     # Urgent fixes
docs/xxx-description       # Documentation
refactor/xxx-description   # Code refactoring
```

### Commit Messages

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: code formatting
refactor: restructure code
test: add tests
chore: maintenance tasks
```

### Pull Request Process

1. Create branch from `main`
2. Make changes
3. Run tests: `npm run test:all`
4. Create PR with description
5. Request review
6. Squash and merge

## Common Tasks

### Adding a New Feature

1. Create feature directory: `src/features/xxx`
2. Add routes in `src/app/routes.ts`
3. Implement components
4. Add tests
5. Update documentation

### Adding a Database Migration

```bash
# Create new migration
npx supabase migration new add_new_table

# Edit migration file
# supabase/migrations/xxx_add_new_table.sql

# Apply to local
npx supabase db push

# Apply to staging
npx supabase link --project-ref staging-xxx
npx supabase db push
```

### Adding an Edge Function

1. Create function: `supabase/functions/xxx/index.ts`
2. Implement handler
3. Test locally: `npx supabase functions serve xxx`
4. Deploy: `npx supabase functions deploy xxx`

## Testing Guide

### Running Tests

```bash
# All tests
npm run test:all

# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Property-based tests
npm run test:property-based

# Benchmarks
npm run test:benchmarks
```

### Writing Tests

```typescript
// src/test/example.test.ts
import { describe, it, expect } from "vitest";

describe("Feature", () => {
  it("should do something", () => {
    expect(1 + 1).toBe(2);
  });
});
```

## Resources

### Documentation
- [API Documentation](../api/README.md)
- [Architecture Decisions](../adr/README.md)
- [Deployment Guide](../deployment/README.md)
- [Runbooks](../runbooks/README.md)

### External
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs)
