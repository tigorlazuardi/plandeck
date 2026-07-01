#!/usr/bin/env bash
# Visual capture harness — builds the SPA, runs the real backend against the e2e
# fixtures, drives tests/visual/capture.spec.ts in podman Playwright, and writes
# screenshots to tests/visual/screenshots/ for a human/LLM to review.
#
# NOT part of CI. Run after shipping UI: `bun run visual`, then Read the PNGs.
# See the `visual-check` skill for the review loop.
set -euo pipefail

WORKTREE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=4321
FIXTURE_DIR="$WORKTREE_ROOT/tests/e2e/fixtures"
IMAGE="mcr.microsoft.com/playwright:v1.59.1-noble"
SHOT_DIR="$WORKTREE_ROOT/tests/visual/screenshots"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Building dist..."
cd "$WORKTREE_ROOT"
bun run build

echo "Starting server on port $PORT..."
PLANDECK_PORT=$PORT PLANDECK_ROOT=$FIXTURE_DIR PLANDECK_TITLE="Plandeck" bun "$WORKTREE_ROOT/bin/plandeck.ts" &
SERVER_PID=$!

echo "Waiting for server..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/api/tree" > /dev/null 2>&1; then
    echo "Server ready."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Server did not start in time."
    exit 1
  fi
  sleep 1
done

rm -rf "$SHOT_DIR"
mkdir -p "$SHOT_DIR"

echo "Capturing screenshots via podman Playwright..."
# podman on macOS runs in a VM: the container can't reach the host via
# localhost/--network host. Route it to the host through the podman
# host-gateway alias instead. Linux keeps localhost + --network host.
PODMAN_HOST_ARGS=()
BASE_URL="http://localhost:$PORT"
if [[ "$(uname -s)" == "Darwin" ]]; then
  PODMAN_HOST_ARGS=(--add-host=host.containers.internal:host-gateway)
  BASE_URL="http://host.containers.internal:$PORT"
fi

podman run --rm --network host \
  ${PODMAN_HOST_ARGS[@]+"${PODMAN_HOST_ARGS[@]}"} \
  -e PLANDECK_BASE_URL="$BASE_URL" \
  -v "$WORKTREE_ROOT":/work:Z \
  -w /work \
  "$IMAGE" \
  npx playwright test --config=playwright.visual.config.ts

echo ""
echo "Screenshots written to: tests/visual/screenshots/"
ls -1 "$SHOT_DIR"
