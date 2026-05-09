# Elevate Automation Repo Map

## Live runtime surface
These are the primary live surfaces that should be treated as authoritative before touching older phase artifacts.

### Frontend runtime
- `dashboard.js` — main dashboard loader
- `dashboard-bootstrap.js` — live dashboard readiness watcher
- `dashboard-phase3-canonical.js` — canonical dashboard truth layer
- `dashboard-phase21-shell-repair.js` — active shell repair layer
- `elevate-automation-phase-r-update/dashboard-phase-r-unified-truth.js` — canonical summary consumer and account truth bridge
- `profile.html` / `profile.js` — profile module
- `beta.html` / `beta.js` — beta portal
- `js/supabase-client.js` — browser Supabase config authority

### API runtime
- `api/get-dashboard-summary-canonical.js` — canonical dashboard summary source
- `api/get-dashboard-summary.js` — legacy-compatible summary entrypoint
- `api/profile.js` — canonical profile read/write surface
- `api/` — deployed Vercel API surface
- `api/_shared/` — shared server helpers
- `_shared/` — shared account/access and canonical state logic used by API endpoints

### Schema/runtime docs
- `supabase/migrations/` — migration snapshots committed during stabilization bundles
- `scripts/check-dashboard-safety.mjs` — dashboard/runtime contract validation
- `scripts/check-repo-hygiene.mjs` — repo hygiene and runtime ownership validation

## Runtime ownership boundaries
- **Patch production behavior here first:** live runtime files in the sections above
- **Do not treat historical phase artifacts as the source of truth** when a live runtime equivalent exists
- **Bundle/phase copies are context only** unless the repo map explicitly says they are live

## Stabilization bundle outcomes
- Bundle 1 — auth/environment recovery
- Bundle 2 — API limit recovery
- Bundle 3 — auth/access authority hardening
- Bundle 4 — schema authority + RLS hardening
- Bundle 5 — dashboard metrics correctness
- Bundle 6 — repo hygiene + validation safety nets
- Final cleanup bundle — root artifact removal + backend listing/meta cleanup

## Cleanup guidance
### Treat as deprecated / review-before-use
- `dashboard-phase21-shell-cleanup.js` — historical artifact, known-invalid/unsafe candidate until replaced or removed cleanly
- `dashboard-legacy.js` — legacy compatibility layer, not preferred for new work
- any ZIP artifacts checked into the repo root
- `stabilization/` historical bundle copies

### Preferred rule
When changing production behavior, patch the live runtime surface first rather than historical bundle copies or deprecated phase artifacts.

### Contributor safety rule
If a runtime fix can be made in a file listed under **Live runtime surface**, do that before creating or editing another phase/bundle copy.

## Validation commands
- `npm run check:conflicts`
- `npm run check:dashboard-safety`
- `npm run check:repo-hygiene`
- `npm run validate`
