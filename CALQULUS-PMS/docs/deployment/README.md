# Deployment Documentation

This directory contains deployment-related documentation for CALQULUS RMS.

## Contents

### Deployment Guides

| Guide | Description |
|-------|-------------|
| [Production Deployment](./production.md) | Complete production deployment procedure |
| [Staging Setup](./staging.md) | Staging environment configuration |
| [Local Development](./local.md) | Local development setup |
| [Vercel Deployment](./vercel.md) | Vercel-specific deployment |
| [Supabase Deployment](./supabase.md) | Supabase configuration and deployment |

### CI/CD

| Guide | Description |
|-------|-------------|
| [GitHub Actions](./github-actions.md) | CI/CD pipeline configuration |
| [Quality Gates](./quality-gates.md) | Deployment quality checks |
| [Rollback Procedures](./rollback.md) | How to rollback a deployment |

### Infrastructure

| Guide | Description |
|-------|-------------|
| [Docker Setup](./docker.md) | Docker containerization |
| [Kubernetes](./kubernetes.md) | K8s deployment |
| [Terraform](./terraform.md) | Infrastructure as Code |

## Quick Deployment

### Prerequisites
- Node.js 18+
- Supabase CLI
- Vercel CLI
- Access to Supabase and Vercel projects

### Steps

```bash
# 1. Clone and install
git clone https://github.com/Themugo/CALQULUS-PMS.git
cd CALQULUS-PMS
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Run database migrations
npx supabase db push

# 4. Start development
npm run dev
```

## Production Checklist

- [ ] All tests passing (`npm run test:all`)
- [ ] TypeScript compilation (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Security audit (`npm audit`)
- [ ] Smoke tests pass
- [ ] Rollback plan ready
