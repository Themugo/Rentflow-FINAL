# CALQULUS PMS Documentation

Welcome to the CALQULUS PMS documentation. This describes the **current** production system (React 19 + Vite + Supabase + Vercel), not theoretical future platforms.

Infrastructure classification: [INFRASTRUCTURE.md](./INFRASTRUCTURE.md). Historical audits live in [audits/](./audits/) and [archive/](./archive/).

## Quick Links

| Category | Description |
|----------|-------------|
| [📚 ADR](./adr/) | Architecture Decision Records |
| [🔌 API](./api/) | API Documentation |
| [🚀 Deployment](./deployment/) | Deployment Guides |
| [👋 Onboarding](./onboarding/) | Developer Onboarding |
| [📋 Runbooks](./runbooks/) | Operational Runbooks |
| [🔧 Maintenance](./maintenance/) | Maintenance Procedures |
| [📊 Diagrams](./diagrams/) | Sequence Diagrams |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                       │
│         Vite + TypeScript + Tailwind + React Router             │
│                                                                      │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │   Manager    │   Landlord   │    Agency    │    Tenant    │  │
│  │   Portal     │    Portal    │    Portal    │    Portal    │  │
│  │     (/)      │  (/landlord) │   (/agency)  │   (/portal)  │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Backend (BaaS)                       │
│                                                                      │
│  ┌─────────────┬─────────────┬─────────────┬────────────────────┐  │
│  │ PostgreSQL  │   Auth      │  Storage   │   Edge Functions  │  │
│  │   + RLS     │  (JWT)      │  (Files)   │   (API Logic)     │  │
│  └─────────────┴─────────────┴─────────────┴────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       External Services                           │
│                                                                      │
│  ┌───────────┬─────────────┬───────────┬──────────────────────┐   │
│  │  M-Pesa   │   Stripe   │ WhatsApp │      SendGrid        │   │
│  │  (Pay)    │  (Cards)  │  (Notify) │      (Email)        │   │
│  └───────────┴─────────────┴───────────┴──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Platform Roles

| Role | Portal | Description |
|------|--------|-------------|
| Webhost | `/webhost` | Platform owner, manages subscriptions |
| Manager | `/` | Property management, tenant operations |
| Agency | `/agency` | Manages properties for landlords (commission) |
| Landlord | `/landlord/dashboard` | Property owner, revenue view only |
| Submanager | `/` | Restricted staff under manager |
| Tenant | `/portal` | Renter, self-service payments |

## Documentation by Topic

### Getting Started
1. [Developer Onboarding](./onboarding/README.md) - Set up your development environment
2. [Architecture Overview](./onboarding/README.md#architecture-overview) - Understand the system

### Development
3. [API Documentation](./api/README.md) - REST API reference
4. [Edge Functions](./api/endpoints/) - Serverless function APIs
5. [Database Schema](./api/schema.md) - Data model

### Operations
6. [Deployment Guide](./deployment/README.md) - Deploy to production
7. [Runbooks](./runbooks/README.md) - Troubleshooting procedures
8. [Monitoring Setup](./maintenance/README.md#monitoring--alerts) - Observability

### Reference
9. [Architecture Decisions](./adr/README.md) - Why we made certain choices
10. [Sequence Diagrams](./diagrams/README.md) - Workflow visualizations
11. [Testing Guide](./onboarding/README.md#testing-guide) - Test the application

## Test Status

| Category | Tests | Status |
|----------|-------|--------|
| Unit Tests | 100+ | ✅ Passing |
| Integration Tests | 35 | ✅ Passing |
| API Contracts | 43 | ✅ Passing |
| Regression Suites | 81 | ✅ Passing |
| Property-Based | 30 | ✅ Passing |
| Edge Cases | 81 | ✅ Passing |
| Benchmarks | 18 | ✅ Passing |

**Total: 562 tests passing**

## Contributing to Docs

### Style Guide

1. **Use clear headings**: H1 for title, H2 for sections, H3 for subsections
2. **Include examples**: Code examples for every API endpoint
3. **Link related docs**: Cross-reference related documentation
4. **Keep updated**: Update docs when code changes

### File Naming

```
docs/
├── README.md              # Index
├── adr/
│   └── adr-001-title.md  # ADR files
├── api/
│   └── endpoints/
│       └── resource.md    # API endpoint docs
├── deployment/
│   └── guide.md          # Deployment guides
└── ...
```

## Need Help?

- **Development Questions**: Ask in `#dev` Slack channel
- **Production Issues**: Follow [Runbook Procedures](./runbooks/README.md)
- **Feature Requests**: Create GitHub issue with label `documentation`
