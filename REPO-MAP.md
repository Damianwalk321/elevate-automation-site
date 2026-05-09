# Elevate Automation Repo Map

## Live runtime surface
These are the primary live surfaces that should be treated as authoritative before touching older phase artifacts.

### Frontend runtime
- `dashboard.js` — main dashboard loader
- `dashboard-phase3-canonical.js` — canonical dashboard truth layer
- `dashboard-phase21-shell-repair.js` — active shell repair layer
- `profile.html` / `profile.js` — profile module
- `beta.html` / `beta.js` — beta portal
- `js/supabase-client.js` — browser Supabase config authority

### API runtime
- `api/` — deployed Vercel API surface
- `api/_shared/` — shared server helpers
- `_shared/` — shared account/access logic mirrored into API via re-export files

### Schema/runtime docs
- `supabase/migrations/` — migration snapshots committed during stabilization bundles

## Stabilization bundle outcomes
- Bundle 1 — auth/environment recovery
- Bundle 2 — API limit recovery
- Bundle 3 — auth/access authority hardening
- Bundle 4 — schema authority + RLS hardening
- Bundle 5 — dashboard metrics correctness
- Bundle 6 — repo hygiene + validation safety nets

## Cleanup guidance
### Treat as deprecated / review-before-use
- `dashboard-phase21-shell-cleanup.js` — historical artifact, known-invalid/unsafe candidate until replaced or removed cleanly
- `dashboard-legacy.js` — legacy compatibility layer, not preferred for new work
- root `auth.js` and root `account-access.js` — suspicious root-level server artifacts; review for deletion or relocation
- any ZIP artifacts checked into the repo root
- `stabilization/` historical bundle copies

### Preferred rule
When changing production behavior, patch the live runtime surface first rather than historical bundle copies or deprecated phase artifacts.

## Validation commands
- `npm run check:conflicts`
- `npm run check:dashboard-safety`
- `npm run check:repo-hygiene`
- `npm run validate`
