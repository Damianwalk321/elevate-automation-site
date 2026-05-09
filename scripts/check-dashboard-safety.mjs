import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const filesToScan = [
  "dashboard-phase21-shell-cleanup.js",
  "dashboard-phase21-shell-repair.js",
  "dashboard-phase3-canonical.js",
  "dashboard.js",
  "dashboard-bootstrap.js",
  "elevate-automation-phase-r-update/dashboard-phase-r-unified-truth.js",
  "api/get-dashboard-summary-canonical.js",
  "api/profile.js"
];

const requiredSummarySignals = [
  "identity_source",
  "matched_by",
  "canonical_profile_table",
  "canonical_listings_table",
  "account_snapshot",
  "profile_snapshot",
  "setup_status",
  "plan_access",
  "diagnostics"
];

const requiredProfileSignals = [
  "canonical_profile_table",
  "legacy_profile_tables",
  "identity_source",
  "matched_by",
  "setup_fields",
  "diagnostics"
];

const checks = [];

function addCheck(file, ok, message) {
  checks.push({ file, ok, message });
}

for (const relPath of filesToScan) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    addCheck(relPath, false, "missing file");
    continue;
  }

  const content = fs.readFileSync(absPath, "utf8");

  const pythonStyleIf = /if\s*\([^\n]+\)\s*:/g.test(content);
  const pythonStyleFor = /for\s*\([^\n]+\)\s*:/g.test(content);
  const unresolvedConflict = /<<<<<<<|=======|>>>>>>>/g.test(content);

  if (pythonStyleIf || pythonStyleFor) {
    addCheck(relPath, false, "contains invalid JS control syntax");
    continue;
  }

  if (unresolvedConflict) {
    addCheck(relPath, false, "contains unresolved conflict markers");
    continue;
  }

  if (relPath === "api/get-dashboard-summary-canonical.js") {
    const missing = requiredSummarySignals.filter((signal) => !content.includes(signal));
    if (missing.length) {
      addCheck(relPath, false, `missing canonical summary signals: ${missing.join(", ")}`);
      continue;
    }
  }

  if (relPath === "api/profile.js") {
    const missing = requiredProfileSignals.filter((signal) => !content.includes(signal));
    if (missing.length) {
      addCheck(relPath, false, `missing canonical profile signals: ${missing.join(", ")}`);
      continue;
    }
  }

  if (relPath.includes("dashboard-phase-r-unified-truth.js")) {
    const phaseRSignals = ["last_sync_at", "last_sync_request_id", "last_sync_source", "syncTruth"].filter((signal) => !content.includes(signal));
    if (phaseRSignals.length) {
      addCheck(relPath, false, `missing Phase R sync diagnostics: ${phaseRSignals.join(", ")}`);
      continue;
    }
  }

  addCheck(relPath, true, "ok");
}

const failed = checks.filter((item) => !item.ok);

for (const item of checks) {
  const prefix = item.ok ? "[ok]" : "[fail]";
  console.log(`${prefix} ${item.file} - ${item.message}`);
}

if (failed.length) {
  process.exit(1);
}
