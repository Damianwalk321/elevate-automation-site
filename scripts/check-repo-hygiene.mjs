import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const forbiddenPatterns = [
  /elevate-automation-phase-.*\.zip$/i,
  /elevate-bundle-.*\.zip$/i,
  /^stabilization\//i
];

const suspiciousRootFiles = [
  "auth.js",
  "account-access.js"
];

const requiredLiveRuntimeFiles = [
  "dashboard.js",
  "dashboard-bootstrap.js",
  "dashboard-phase3-canonical.js",
  "dashboard-phase21-shell-repair.js",
  "profile.html",
  "profile.js",
  "api/profile.js",
  "api/get-dashboard-summary-canonical.js",
  "api/get-dashboard-summary.js",
  "api/_shared/account-access.js",
  "_shared/canonical-state.js",
  "REPO-MAP.md",
  "scripts/check-dashboard-safety.mjs"
];

const deprecatedReviewBeforeUseFiles = [
  "dashboard-phase21-shell-cleanup.js",
  "dashboard-legacy.js"
];

const repoMapSignals = [
  "## Live runtime surface",
  "## Cleanup guidance",
  "Treat as deprecated / review-before-use",
  "Preferred rule",
  "## Validation commands"
];

function walk(dir, prefix = "") {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(prefix, entry.name);
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules"].includes(entry.name)) continue;
      results.push(...walk(abs, rel));
    } else {
      results.push(rel.replace(/\\/g, "/"));
    }
  }
  return results;
}

const allFiles = walk(repoRoot);
const problems = [];
const warnings = [];

for (const rel of allFiles) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(rel)) {
      problems.push(`${rel} matches forbidden cleanup pattern ${pattern}`);
    }
  }
}

for (const rel of suspiciousRootFiles) {
  const abs = path.join(repoRoot, rel);
  if (fs.existsSync(abs)) {
    problems.push(`${rel} still exists at repo root and should be reviewed for removal or relocation`);
  }
}

for (const rel of requiredLiveRuntimeFiles) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    problems.push(`${rel} is missing from the required live runtime surface`);
  }
}

for (const rel of deprecatedReviewBeforeUseFiles) {
  const abs = path.join(repoRoot, rel);
  if (fs.existsSync(abs)) {
    warnings.push(`${rel} exists and is treated as deprecated/review-before-use`);
  }
}

const repoMapPath = path.join(repoRoot, "REPO-MAP.md");
if (!fs.existsSync(repoMapPath)) {
  problems.push("REPO-MAP.md is missing");
} else {
  const repoMap = fs.readFileSync(repoMapPath, "utf8");
  const missingSignals = repoMapSignals.filter((signal) => !repoMap.includes(signal));
  if (missingSignals.length) {
    problems.push(`REPO-MAP.md is missing required guidance sections: ${missingSignals.join(", ")}`);
  }
}

const packageJsonPath = path.join(repoRoot, "package.json");
if (!fs.existsSync(packageJsonPath)) {
  problems.push("package.json is missing");
} else {
  const packageJson = fs.readFileSync(packageJsonPath, "utf8");
  const requiredScripts = ["check:conflicts", "check:dashboard-safety", "check:repo-hygiene", "validate"];
  const missingScripts = requiredScripts.filter((name) => !packageJson.includes(`\"${name}\"`));
  if (missingScripts.length) {
    problems.push(`package.json is missing validation scripts: ${missingScripts.join(", ")}`);
  }
}

warnings.forEach((msg) => console.warn(`[warn] ${msg}`));

if (problems.length) {
  problems.forEach((msg) => console.error(`[fail] ${msg}`));
  process.exit(1);
}

console.log("[ok] repo hygiene checks passed");
