# CALQULUS PMS

A modern property management platform for Kenya and East Africa, built with React, TypeScript, Supabase, and Tailwind CSS. It connects webhosts, managers, landlords, agencies, and tenants in one operational system for properties, leases, billing, payments, and maintenance.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth, Realtime)
- **Mobile**: Capacitor (iOS/Android)
- **Testing**: Vitest (unit), Playwright (E2E)
- **Monitoring**: Sentry (optional `VITE_SENTRY_DSN`)

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI (for local development)
- Git

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Themugo/CALQULUS-PMS.git
cd CALQULUS-PMS
npm install
```

## Environment Setup

Copy the example environment file and configure your Supabase credentials:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Running Tests

```bash
# Unit tests
npm run test

# Unit tests in watch mode
npm run test:watch

# Financial integrity tests
npm run test:financial

# Data isolation tests
npm run test:isolation

# E2E tests
npm run test:e2e

# All tests (CI pipeline)
npm run test:all
```

### Type Checking & Linting

```bash
# TypeScript check
npm run typecheck

# ESLint
npm run lint

# Full verification (lint + typecheck + tests + build + audit)
npm run verify
```

## Project Structure

```text
src/
├── features/          # Feature-based modules
│   ├── webhost/       # Webhost dashboard
│   ├── manager/       # Manager portal
│   ├── landlord/      # Landlord portal
│   ├── tenant/        # Tenant portal
│   └── properties/    # Property management
├── shared/            # Shared components and hooks
├── integrations/      # Third-party integrations
├── lib/               # Utility functions
└── app/               # App configuration (routes, providers)
```

## Documentation

- [Architecture Overview](ARCHITECTURE_DIAGRAMS.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Database Schema](supabase/migrations/)
- [User Manuals](docs/)
  - [Manager Manual](docs/MANAGER_USER_MANUAL.md)
  - [Landlord Manual](docs/LANDLORD_USER_MANUAL.md)
  - [Tenant Manual](docs/TENANT_USER_MANUAL.md)
  - [Agency Manual](docs/AGENCY_USER_MANUAL.md)
  - [Webhost Manual](docs/WEBHOST_USER_MANUAL.md)

## Build & Deploy

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

For deployment instructions, see the [deployment documentation](deployment/app-assets-specification.md).

## Demo Accounts

These accounts are pre-seeded with sample data. Sign in at the matching portal:

| Role          | Email                         | Password          |
|---------------|-------------------------------|-------------------|
| Demo Manager  | demo.manager@calqulusrms.com  | Demo@2026         |
| Demo Landlord | demo.landlord@calqulusrms.com | Demo@2026         |
| Test Manager  | jimmythemugo@gmail.com        | CALQULUS RMS@2026!|

> The `Demo*` accounts use the `Demo@2026` password; the `Test Manager` account uses
its own credentials. See [docs/DEMO_ACCOUNTS_AND_PAYMENT_FLOW.md](docs/DEMO_ACCOUNTS_AND_PAYMENT_FLOW.md) for details on seeding and the demo payment flow.

## License

UNLICENSED — Proprietary software
