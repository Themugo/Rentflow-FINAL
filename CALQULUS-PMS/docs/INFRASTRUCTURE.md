# CALQULUS PMS — infrastructure classification

Production deployment is **Vercel** (`vercel.json`) from GitHub `main`, with Supabase as the backend. Native Vercel GitHub integration is the live deploy path.

| Path | Classification | Notes |
|------|----------------|-------|
| `vercel.json` | **ACTIVE** | SPA rewrites and security headers |
| `.github/workflows/ci.yml` | **ACTIVE** | Lint, typecheck, unit tests, audit |
| `.github/workflows/monitor.yml` | **ACTIVE** | Health checks against www.calqulus.site |
| `.github/workflows/security-scan.yml` | **ACTIVE** | Secrets and dependency scanning |
| `.github/workflows/e2e.yml` | **ACTIVE** | Playwright when `E2E_*` secrets exist |
| `supabase/migrations/20260812*` + `20260819000000` | **APPLY ON LIVE DB** | RLS recursion + landlord finance RPCs; `node scripts/apply-pending-migrations.mjs --dry-run` |
| `.github/workflows/deploy-production.yml` | **PLANNED** | CLI deploy; redundant with native Vercel unless `VERCEL_*` secrets are set |
| `capacitor.config.ts` | **PLANNED** | Web PWA is live; no `android/` or `ios/` projects in this repo |
| `src/sw.ts` + vite-plugin-pwa | **ACTIVE** | Service worker source of truth |
| `monitoring/` | **PLANNED** | Grafana/Prometheus JSON; not wired as the production control plane |
| `k8s/` | **UNUSED** | Kubernetes manifests; not the production host |
| `helm/calqulusrms/` | **UNUSED** | Helm chart; naming leftover (RMS) |
| `terraform/` | **UNUSED** | Not applied from CI |
| `enterprise-upgrades/` | **LEGACY** | Design notes, not runtime |

Do not apply k8s/helm/terraform against production without an explicit decision to leave Vercel.
