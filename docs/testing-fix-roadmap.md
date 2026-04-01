# Dashboard Reliability Roadmap (10 Phases)

## Constraints
- Keep the API surface at **12 endpoints max**; prefer extending existing responses over adding endpoints.
- Prioritize the current blocker: **profile info not syncing from Supabase into the client dashboard**.

## Phase 1 — Stabilize summary payloads (immediate)
- Fix server-side runtime breakers in `/api/get-dashboard-summary` so the dashboard always receives a valid payload.
- Add source-count safeguards so merged listing stats never reference undefined variables.
- Outcome: dashboard boot path no longer silently falls back due to 500s.

## Phase 2 — Establish profile source of truth
- Make `profiles` table the canonical write/read layer for dashboard profile fields.
- Ensure `/api/profile` GET and POST return a consistent shape (`{ profile }` and `updated_at`).
- Remove field drift between `account_snapshot`, `profile_snapshot`, and localStorage fallback.

## Phase 3 — Identity hardening for sync correctness
- Enforce user resolution precedence as: verified auth UID -> users.id -> normalized email fallback.
- Audit all profile/account endpoints to ensure same identity strategy (no mixed casing or alternate email aliases).
- Add debug markers to responses (`identity_source`, `matched_by`) for faster triage.

## Phase 4 — Client hydration determinism
- Refactor dashboard boot sequence to hydrate profile in one deterministic pass:
  1. session,
  2. account/session summary,
  3. profile,
  4. render.
- Prevent stale local snapshot from overriding fresh Supabase profile unless API fails.
- Add explicit "remote vs local" status message in setup panel.

## Phase 5 — Write-path verification and optimistic UI
- After profile save, re-read server profile and diff returned fields against form values.
- Surface field-level sync errors (e.g., invalid URL normalization, missing write permissions).
- Keep optimistic UI but rollback individual fields when server rejects updates.

## Phase 6 — Database and RLS validation
- Verify Supabase RLS allows authenticated users to read/write their own profile row by `id` and intended email fallback logic.
- Confirm indexes for `profiles.id`, `profiles.email`, `subscriptions.user_id`, `posting_usage(user_id,date_key)`.
- Add migration notes for required nullable/non-null profile fields.

## Phase 7 — Observability and diagnostics
- Add structured logs for dashboard-critical endpoints (`profile`, `extension-state`, `get-dashboard-summary`) with request IDs.
- Add lightweight sync diagnostics in UI (last profile sync timestamp + source endpoint).
- Create a reproducible "profile sync smoke test" script for local and production checks.

## Phase 8 — API budget and consolidation (12 max)
- Keep current 12 APIs; do not add net-new endpoints.
- Consolidate overlapping data inside existing endpoints:
  - `/api/get-dashboard-summary` as main read aggregator,
  - `/api/profile` as profile write/read,
  - `/api/extension-state` for extension compatibility only.
- De-duplicate repeated subscription/profile fetch logic in shared helpers.

## Phase 9 — Automated test coverage
- Add integration tests for:
  - profile save -> reload -> dashboard render roundtrip,
  - UID-based identity and email fallback behavior,
  - no-regression for account snapshot/profile snapshot hydration.
- Add contract tests asserting required response keys used by `dashboard.js`.

## Phase 10 — Performance + rollout safety
- Introduce staged rollout flags for sync-path changes.
- Add cache-busting controls only where needed (`_ts`) and avoid over-fetching on routine navigation.
- Define rollback playbook and owner checklist for production incident handling.

## Immediate next execution order
1. Phase 1 + Phase 4 smoke validation.
2. Phase 2 + Phase 3 identity/profile normalization.
3. Phase 5 + Phase 7 visibility improvements.
4. Phase 9 tests before broader refactors in Phase 8/10.
