// extension-phase-s-hardening.js
//
// Repo-ready hardening layer for the extension repo.
// Adds:
// - stale truth detection
// - safe deny mode when truth is missing
// - bridge diagnostics in chrome.storage.local
// - popup/session stale-state visibility hooks
//
// Load after extension-phase-r-unified-enforcement.js.

(() => {
  if (globalThis.__ELEVATE_PHASE_S_EXTENSION_HARDENING__) return;
  globalThis.__ELEVATE_PHASE_S_EXTENSION_HARDENING__ = true;

  const Unified = globalThis.ElevateUnifiedEnforcement;
  if (!Unified) {
    console.warn("[Phase S] ElevateUnifiedEnforcement missing.");
    return;
  }

  const DIAG_KEY = "elevate_extension_diagnostics_v1";
  const STALE_MINUTES = 15;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function minutesSince(iso) {
    const ts = new Date(iso || "").getTime();
    if (!ts || Number.isNaN(ts)) return null;
    return Math.max(0, Math.floor((Date.now() - ts) / 60000));
  }

  async function saveDiag(diag) {
    await chrome.storage.local.set({ [DIAG_KEY]: diag });
    return diag;
  }

  async function getDiag() {
    const stored = await chrome.storage.local.get([DIAG_KEY]);
    return stored[DIAG_KEY] || {};
  }

  async function getHardenedTruth() {
    const truth = await Unified.getTruth();
    const syncAge = minutesSince(truth.synced_at);
    const stale = syncAge == null || syncAge >= STALE_MINUTES;

    const hardened = {
      ...truth,
      stale_truth: stale,
      sync_age_minutes: syncAge,
      safe_mode: false
    };

    if (!truth.plan_key || !truth.daily_limit) {
      hardened.safe_mode = true;
      hardened.can_post = false;
      hardened.active = false;
      hardened.access_state = "missing_truth";
    }

    if (stale) {
      hardened.can_post = false;
      hardened.safe_mode = true;
      hardened.access_state = "stale_truth";
    }

    await saveDiag({
      source: "phase_s_extension_hardening",
      checked_at: new Date().toISOString(),
      stale_truth: hardened.stale_truth,
      sync_age_minutes: hardened.sync_age_minutes,
      safe_mode: hardened.safe_mode,
      access_state: hardened.access_state,
      plan_key: hardened.plan_key,
      daily_limit: hardened.daily_limit
    });

    return hardened;
  }

  async function hardenedCanUserPostNow() {
    const truth = await getHardenedTruth();
    const allowed = Boolean(
      truth.active &&
      truth.can_post &&
      !truth.safe_mode &&
      truth.posts_remaining_today > 0
    );

    return {
      allowed,
      ok: allowed,
      reason: allowed
        ? "allowed"
        : truth.access_state === "missing_truth"
          ? "missing_truth"
          : truth.access_state === "stale_truth"
            ? "stale_truth"
            : !truth.active
              ? "inactive_account"
              : !truth.can_post
                ? "posting_blocked"
                : "daily_limit_reached",
      truth
    };
  }

  async function renderDiagnostics() {
    if (typeof document === "undefined") return;
    const truth = await getHardenedTruth();
    const diag = await getDiag();

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value;
    };

    setText("extensionTruthHealth", truth.safe_mode ? "Safe Mode" : truth.stale_truth ? "Stale Truth" : "Healthy");
    setText("extensionTruthSyncAge", diag.sync_age_minutes == null ? "—" : `${diag.sync_age_minutes} min`);
    setText("extensionAccessState", truth.access_state);
  }

  globalThis.ElevateUnifiedEnforcement.getHardenedTruth = getHardenedTruth;
  globalThis.ElevateUnifiedEnforcement.canUserPostNow = hardenedCanUserPostNow;
  globalThis.canUserPostNow = hardenedCanUserPostNow;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => renderDiagnostics().catch(console.error), { once: true });
    } else {
      renderDiagnostics().catch(console.error);
    }
    setTimeout(() => renderDiagnostics().catch(() => {}), 1200);
  }
})();
