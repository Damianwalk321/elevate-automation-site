// dashboard-account-truth-sync.js
//
// Phase R extension content script for site/dashboard domains.
// Reads canonical truth from dashboard localStorage and forwards it into chrome.storage.local.

(() => {
  if (window.__ELEVATE_PHASE_R_DASHBOARD_SYNC__) return;
  window.__ELEVATE_PHASE_R_DASHBOARD_SYNC__ = true;

  const SITE_KEYS = [
    "elevate.account_truth.v1",
    "elevate.extension_account_truth.v1",
    "elevate.posting_gate_truth.v1",
    "elevate.session_bridge_truth.v1"
  ];

  const EXT_KEYS = {
    canonical: "elevate_extension_account_truth",
    postingGate: "elevate_posting_gate_truth",
    session: "elevate_session_bridge_truth",
    meta: "elevate_account_truth_meta"
  };

  function parse(v) {
    try { return JSON.parse(v); } catch { return null; }
  }

  function readTruth() {
    for (const key of SITE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
    return null;
  }

  async function pushTruth(truth) {
    if (!truth || !chrome?.storage?.local) return;
    await chrome.storage.local.set({
      [EXT_KEYS.canonical]: truth,
      [EXT_KEYS.postingGate]: truth,
      [EXT_KEYS.session]: truth,
      [EXT_KEYS.meta]: {
        source: "phase_r_dashboard_content_sync",
        synced_at: new Date().toISOString(),
        url: location.href
      }
    });
  }

  async function sync() {
    const truth = readTruth();
    if (!truth) return;
    await pushTruth(truth);
  }

  window.addEventListener("storage", () => sync().catch(console.error));
  window.addEventListener("elevate:account-truth", (e) => pushTruth(e?.detail || {}).catch(console.error));
  window.addEventListener("elevate:enforcement-bridge", (e) => pushTruth(e?.detail || {}).catch(console.error));

  sync().catch(console.error);
  setInterval(() => sync().catch(() => {}), 12000);
})();
