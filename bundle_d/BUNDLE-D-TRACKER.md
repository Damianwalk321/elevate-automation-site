# Bundle D Tracker

## Scope
Targeted operator-surface cleanup based on the latest screen recording and current live dashboard behavior.

## Completed in this bundle
1. Added a dedicated **Listings** nav surface.
2. Added a dedicated **Review Center** nav surface.
3. Moved the listing card workspace out of Overview into a dedicated Listings section.
4. Added lane-based review triage for:
   - Likely Sold / Removed
   - Price Watch
   - Stale / Needs Refresh
   - Review New
5. Preserved vehicle cards inside Analytics while keeping Listings as the operational workspace.
6. Replaced hard `$0` display behavior with **Price pending** for unresolved canonical price rows.
7. Hardened price normalization heuristics so alternate price fields can recover truth before falling to unresolved state.
8. Reduced Overview clutter by soft-hiding secondary upgrade/account surfaces and manager-style surfaces when detected.

## Active known issues
1. **Canonical price truth is still not fully solved** at the backend/data-contract layer.
   - Bundle D prevents bad UI output (`$0`) from being presented as truth.
   - Full fix still requires identifying the correct source field for unresolved listings in Supabase payloads and/or sync ingestion.
2. Review-center actions are still UI-level routing actions.
   - Full state-machine actions such as resolve sold, commit price update, or relist should be backed by durable APIs next.
3. Manager/team extraction remains partially legacy-driven.
   - Bundle D demotes/hides it in the operator flow, but deeper code removal or isolation is still recommended.
4. Listings density is improved directionally by moving the surface, but card internals can still be compressed further.
5. Review Center is now a triage surface, but final workflow persistence still needs dedicated lifecycle APIs and resolution states.

## Recommended next bundle priorities
1. Backend price-truth hardening
2. Durable review actions API
3. Listing-card density compression
4. Overview hierarchy tightening
5. Manager/team isolation into a true separate surface
