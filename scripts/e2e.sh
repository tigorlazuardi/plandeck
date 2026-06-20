#!/usr/bin/env bash
set -euo pipefail

WORKTREE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=4321
FIXTURE_DIR="$WORKTREE_ROOT/tests/e2e/fixtures"
IMAGE="mcr.microsoft.com/playwright:v1.59.1-noble"

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

echo "Running Playwright E2E in podman..."
podman run --rm --network host \
  -v "$WORKTREE_ROOT":/work:Z \
  -w /work \
  "$IMAGE" \
  npx playwright test
