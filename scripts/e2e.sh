#!/usr/bin/env bash
set -euo pipefail

# Portable Playwright E2E via Podman — host-independent ("takeout"-friendly).
# The browser lives in the official Playwright image (pinned to the SAME version as
# the @playwright/test devDependency), NOT in any host/nix path. Any machine with
# podman + bun can run this unchanged.
#
# Flow: build the client on the host (bun, fast) -> run vite-preview + playwright
# INSIDE the container via npx (node-based; works against bun-installed node_modules).

IMAGE="mcr.microsoft.com/playwright:v1.59.1-noble"

cd "$(dirname "$0")/.."

# 1. Build dist/ on the host so the in-container `vite preview` serves static output.
bun run build

# 2. Run Playwright inside the container. node_modules is mounted; the container's
#    own browsers (image default path) match the pinned @playwright/test 1.59.1.
exec podman run --rm \
  -v "$PWD":/work:Z \
  -w /work \
  "$IMAGE" \
  npx playwright test "$@"
