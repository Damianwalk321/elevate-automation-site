# Dashboard Stabilization Bundle 3

This bundle targets the current failure mode after Bundle 2 testing:

- dashboard shell renders
- page stays on `Loading dashboard...`
- Vercel shows `/api/sync-user` requests with duplicate-email errors
- dashboard appears to restart or spin without reaching a stable hydrated state

## What Bundle 3 fixes

### 1. Legacy boot registration
Adds a dedicated `dashboard-legacy-boot-bridge.js` that captures the late `DOMContentLoaded` boot callback from `dashboard-legacy.js`, exposes it as a callable boot function, and guarantees it only runs once unless manually retried.

### 2. Loader ordering
Updates `dashboard.js` so the legacy boot bridge loads before `dashboard-legacy.js`.

### 3. Bootstrap de-looping
Updates `dashboard-bootstrap.js` to call the registered legacy boot only once and then watch readiness instead of repeatedly retriggering startup.

### 4. sync-user duplicate email hardening
Replaces the current `users` table upsert behavior with a lookup/update/insert flow that avoids the `users_email_key` duplicate error.

## Files in this bundle

Copy these files into the repo root exactly as mapped below:

- `stabilization/bundle-3/dashboard.js` -> `/dashboard.js`
- `stabilization/bundle-3/dashboard-legacy-boot-bridge.js` -> `/dashboard-legacy-boot-bridge.js`
- `stabilization/bundle-3/dashboard-bootstrap.js` -> `/dashboard-bootstrap.js`
- `stabilization/bundle-3/api-sync-user.js` -> `/api/sync-user.js`

## Expected result

After applying Bundle 3:

- legacy dashboard boot should be registered and callable
- the boot path should stop looping
- `sync-user` should stop throwing duplicate-email console errors
- the dashboard should either hydrate normally or fail in a narrower, easier-to-diagnose place

## Test order

1. Open `/dashboard.html`
2. Confirm the loading shell clears or at least progresses farther than before
3. Check Vercel logs and confirm `sync-user` no longer logs the duplicate email error
4. Retry login -> dashboard flow and verify the page does not keep re-entering startup
