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

if (!fs.existsSync(path.join(repoRoot, "scripts", "check-dashboard-safety.mjs"))) {
  problems.push("scripts/check-dashboard-safety.mjs is missing");
}

if (problems.length) {
  problems.forEach((msg) => console.error(`[fail] ${msg}`));
  process.exit(1);
}

console.log("[ok] repo hygiene checks passed");
