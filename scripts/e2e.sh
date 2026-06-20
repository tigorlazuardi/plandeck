#!/usr/bin/env bash
set -euo pipefail
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$(ls -d /nix/store/*-playwright-browsers 2>/dev/null | head -1)}"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
exec bunx playwright test "$@"
