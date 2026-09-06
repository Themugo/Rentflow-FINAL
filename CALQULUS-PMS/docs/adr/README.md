# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the CALQULUS RMS platform.

## About ADRs

ADRs are documents that capture important architectural decisions made during the development of the project. They serve as:

- A record of why decisions were made
- Context for future team members
- A way to track the evolution of the architecture

## ADR Format

Each ADR contains:
- **Status**: Proposed, Accepted, Deprecated, Superseded
- **Context**: The situation that requires a decision
- **Decision**: The chosen solution
- **Consequences**: Benefits, drawbacks, and trade-offs

## Index

| ADR # | Title | Status | Date |
|-------|-------|--------|------|
| [ADR-001](./adr-001-supabase-backend.md) | Supabase as Backend-as-a-Service | Accepted | 2024-01 |
| [ADR-002](./adr-002-three-role-architecture.md) | Three-Role Architecture (Manager/Agency/Landlord) | Accepted | 2024-03 |
| [ADR-003](./adr-003-mpesa-payment-integration.md) | M-Pesa Payment Integration Strategy | Accepted | 2024-02 |
| [ADR-004](./adr-004-edge-functions-for-api.md) | Edge Functions for API Logic | Accepted | 2024-02 |
| [ADR-005](./adr-005-react-19-frontend.md) | React 19 with TypeScript Frontend | Accepted | 2024-04 |
| [ADR-006](./adr-006-multi-tenant-isolation.md) | Multi-Tenant Data Isolation Strategy | Accepted | 2024-03 |
| [ADR-007](./adr-007-water-billing-system.md) | Water Billing System Design | Accepted | 2024-05 |
| [ADR-008](./adr-008-role-based-permissions.md) | Role-Based Permission Model | Accepted | 2024-03 |
| [ADR-009](./adr-009-vercel-deployment.md) | Vercel for Frontend Deployment | Accepted | 2024-01 |
| [ADR-010](./adr-010-observability-stack.md) | Observability Stack (Sentry, Grafana) | Accepted | 2024-06 |

## Creating a New ADR

1. Copy the template: `docs/adr/TEMPLATE.md`
2. Name the file: `adr-XXX-title.md` where XXX is the next sequential number
3. Fill in all sections
4. Submit for review

## Maintaining ADRs

When an ADR is superseded or deprecated:
1. Update the status in the ADR
2. Add a "Superseded by" link to the new ADR
3. Update this index
