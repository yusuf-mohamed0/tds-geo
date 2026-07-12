#!/usr/bin/env bash
set -euo pipefail

# ─── Pre-commit Hook ──────────────────────────────────────
# Install: ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
# Runs quality gates before every commit.
# ──────────────────────────────────────────────────────────

echo "=== Pre-commit Checks ==="

STASHED=false
if ! git diff --quiet HEAD 2>/dev/null; then
  git stash -q --keep-index
  STASHED=true
fi

FAILED=0

# 1. Secrets check
echo -n "  Secrets scan... "
if git diff --cached --name-only | xargs grep -l 'sk-[A-Za-z0-9]\{20,\}\|ghp_\|gho_\|ghu_\' 2>/dev/null; then
  echo "❌ Possible secrets in staged files!"
  FAILED=1
else
  echo "✅"
fi

# 2. TypeScript type check
echo -n "  Type check... "
if npx tsc --noEmit 2>/dev/null; then
  echo "✅"
else
  echo "❌"
  FAILED=1
fi

# 3. Lint staged files
echo -n "  Lint... "
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep '\.ts$' || true)
if [ -n "$STAGED_TS" ]; then
  if echo "$STAGED_TS" | xargs npx eslint --quiet 2>/dev/null; then
    echo "✅"
  else
    echo "❌"
    FAILED=1
  fi
else
  echo "✅ (no TS files)"
fi

if $STASHED; then
  git stash pop -q 2>/dev/null || true
fi

if [ "$FAILED" -ne 0 ]; then
  echo "❌ Pre-commit checks FAILED. Fix errors and try again."
  echo "   To skip (not recommended): git commit --no-verify"
  exit 1
fi

echo "✅ Pre-commit checks passed"
