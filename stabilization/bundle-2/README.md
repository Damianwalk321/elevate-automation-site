# Dashboard Stabilization Bundle 2

This bundle targets the deeper root cause behind the current blank-loading dashboard state.

## Root cause this bundle addresses

The current loader dynamically injects the dashboard module chain.
That means `dashboard-legacy.js` can be loaded **after** the page has already passed `DOMContentLoaded`.

When that happens, the legacy dashboard boot listener never runs.
The result is exactly what the current screenshots show:

- sidebar loads
- static shell renders
- `Loading dashboard...` stays forever
- no real hydration starts

## What this bundle changes

### 1. DOM-ready bridge
Adds a small bridge so scripts that attach `DOMContentLoaded` late still execute their boot callback immediately.

### 2. Loader update
Loads the DOM-ready bridge before `dashboard-legacy.js`.

### 3. Bootstrap cleanup
Removes synthetic `DOMContentLoaded` redispatch behavior.
Bootstrap should observe and report, not re-fire browser lifecycle events.

### 4. Phase-4 rerender hardening
Stops the broad `state:set -> rerender everything` behavior and narrows rerenders to targeted workflow keys.

### 5. Phase-5 isolation
Uses a render-only Sales OS layer that does not write back into state during task-build render paths.

## Files in this bundle

Copy these files into the repo root exactly as mapped below:

- `stabilization/bundle-2/dashboard.js` -> `/dashboard.js`
- `stabilization/bundle-2/dashboard-dom-ready-bridge.js` -> `/dashboard-dom-ready-bridge.js`
- `stabilization/bundle-2/dashboard-bootstrap.js` -> `/dashboard-bootstrap.js`
- `stabilization/bundle-2/dashboard-phase4-boot.js` -> `/dashboard-phase4-boot.js`
- `stabilization/bundle-2/dashboard-phase5-workflow.js` -> `/dashboard-phase5-workflow.js`

## Expected result

After applying Bundle 2:

- legacy dashboard boot should run even when loaded after DOM ready
- the dashboard should begin real hydration instead of sitting on the static shell
- bootstrap should stop forcing synthetic page lifecycle events
- Sales OS should remain isolated from recursive state writes

## Test order

1. Open `/dashboard.html`
2. Confirm boot telemetry appears
3. Confirm profile/session/listing requests start
4. Confirm the user card and page body stop saying `Loading...`
5. Confirm Sales OS renders without freezing the page
6. Open `/dashboard.html?safe=1` and confirm safe mode still provides recovery
