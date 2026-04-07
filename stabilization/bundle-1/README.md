# Dashboard Stabilization Bundle 1

This bundle is the first website-side stabilization pass for the Elevate Automation dashboard.

## What is included

This bundle groups the highest-priority website phases into one implementation set:

1. **P0 runtime stabilization**
   - remove the most likely phase-5/state render loop source
   - stop synthetic bootstrap recursion patterns
   - keep the dashboard functional even when Sales OS is disabled

2. **Single-path boot hardening**
   - cleaner loader flags
   - safer boot telemetry
   - safe-mode entry point

3. **Phase 5 workflow isolation**
   - render Sales OS without writing back into state during render
   - only rerender on targeted state changes

4. **Operational recovery path**
   - `?safe=1` support
   - safe mode disables phase 5 workflow while keeping the core dashboard alive

## Files in this bundle

Copy these files over the matching root files in the repo:

- `stabilization/bundle-1/dashboard.js` -> `/dashboard.js`
- `stabilization/bundle-1/dashboard-bootstrap.js` -> `/dashboard-bootstrap.js`
- `stabilization/bundle-1/dashboard-phase4-boot.js` -> `/dashboard-phase4-boot.js`
- `stabilization/bundle-1/dashboard-phase5-workflow.js` -> `/dashboard-phase5-workflow.js`

## Expected outcome

After applying these replacements:

- the dashboard should stop freezing on initial load from the current phase-5 render loop path
- the page should have a recoverable safe mode
- boot telemetry should stay visible without redispatching `DOMContentLoaded`
- Sales OS should behave as a rendering layer rather than a render-triggering state writer

## Suggested test order

1. Open `/dashboard.html?safe=1`
2. Confirm the core dashboard loads without freezing
3. Open `/dashboard.html`
4. Confirm the dashboard loads and Sales OS appears under the overview command center
5. Switch Sales OS mode and role selectors
6. Confirm the page does not enter a loading loop or browser hang

## Notes

This bundle is intentionally focused on **stability first**, not full architecture cleanup.
The next bundle should handle:

- legacy boot extraction
- summary endpoint decomposition
- route/module separation
- setup wizard rebuild
