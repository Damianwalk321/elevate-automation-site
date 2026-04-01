#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "❌ ripgrep (rg) is required for check:conflicts"
  exit 2
fi

markers='^(<<<<<<<|=======|>>>>>>>)'

if rg --line-number --hidden --glob '!.git' --glob '!node_modules' "${markers}" .; then
  echo
  echo "❌ Merge conflict markers detected. Resolve them before committing."
  exit 1
fi

echo "✅ No merge conflict markers found."
