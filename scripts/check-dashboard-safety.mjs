import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const filesToScan = [
  "dashboard-phase21-shell-cleanup.js",
  "dashboard-phase21-shell-repair.js",
  "dashboard-phase3-canonical.js",
  "dashboard.js"
];

const checks = [];

for (const relPath of filesToScan) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    checks.push({ file: relPath, ok: false, message: "missing file" });
    continue;
  }

  const content = fs.readFileSync(absPath, "utf8");

  const pythonStyleIf = /if\s*\([^\n]+\)\s*:/g.test(content);
  const pythonStyleFor = /for\s*\([^\n]+\)\s*:/g.test(content);
  const unresolvedConflict = /<<<<<<<|=======|>>>>>>>/g.test(content);

  if (pythonStyleIf || pythonStyleFor) {
    checks.push({ file: relPath, ok: false, message: "contains invalid JS control syntax" });
    continue;
  }

  if (unresolvedConflict) {
    checks.push({ file: relPath, ok: false, message: "contains unresolved conflict markers" });
    continue;
  }

  checks.push({ file: relPath, ok: true, message: "ok" });
}

const failed = checks.filter((item) => !item.ok);

for (const item of checks) {
  const prefix = item.ok ? "[ok]" : "[fail]";
  console.log(`${prefix} ${item.file} - ${item.message}`);
}

if (failed.length) {
  process.exit(1);
}
