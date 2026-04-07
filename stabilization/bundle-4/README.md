# Dashboard Stabilization Bundle 4

This bundle targets the current post-Bundle-3 behavior:

- dashboard shell still sits on `Loading dashboard...`
- Chrome can hit `RESULT_CODE_HUNG`
- Vercel still shows the old `/api/sync-user` duplicate-email error, which suggests the prior sync-user fix was not actually applied to the live root file

## Bundle 4 approach

Bundle 4 removes the bridge complexity and switches to a simpler, narrower boot recovery strategy.

## What Bundle 4 changes

### 1. One-time post-legacy DOM boot dispatch
`dashboard.js` now dispatches a synthetic `DOMContentLoaded` **once** immediately after `dashboard-legacy.js` is loaded, but only if the document is already ready.

This is much narrower than the earlier bootstrap-loop behavior:
- it happens one time only
- it happens at loader time only
- it happens before phase-4 boot and bootstrap are loaded

### 2. Passive bootstrap watcher
`dashboard-bootstrap.js` is reduced to a passive readiness watcher.
It no longer tries to invoke legacy boot or re-enter startup.

### 3. Direct sync-user root replacement
Bundle 4 includes the replacement file at the real mapped path:
- `stabilization/bundle-4/api/sync-user.js` -> `/api/sync-user.js`

That should stop the duplicate `users_email_key` issue once actually copied into the live root.

## Files in this bundle

Copy these files into the repo root exactly as mapped below:

- `stabilization/bundle-4/dashboard.js` -> `/dashboard.js`
- `stabilization/bundle-4/dashboard-bootstrap.js` -> `/dashboard-bootstrap.js`
- `stabilization/bundle-4/api/sync-user.js` -> `/api/sync-user.js`

## Expected result

After applying Bundle 4:
- legacy boot should have one clean chance to start even when loaded after DOM ready
- bootstrap should stop contributing to startup re-entry
- `sync-user` should stop logging duplicate email errors once the root file is replaced
- the dashboard should either hydrate or fail in a more isolated, debuggable stage

## Test order

1. Copy the three files into the live root paths
2. Open `/dashboard.html`
3. Confirm whether the shell progresses past `Loading dashboard...`
4. Check Vercel logs and confirm `/api/sync-user` no longer logs the duplicate key error
5. If the page still stalls, the next blocker is likely inside `dashboard-legacy.js` boot internals rather than the loader/bootstrap chain
