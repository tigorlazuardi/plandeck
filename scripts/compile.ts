#!/usr/bin/env bun
/**
 * Cross-compile self-contained single-file binaries for all release targets.
 * `bun build --compile` cross-targets from one host, so CI runs this once on
 * ubuntu. Run AFTER `bun run gen:embedded` so the SPA is baked in.
 */
import { $ } from "bun";

const TARGETS: { target: string; out: string }[] = [
  { target: "bun-linux-x64", out: "plandeck-linux-x64" },
  { target: "bun-linux-arm64", out: "plandeck-linux-arm64" },
  { target: "bun-darwin-arm64", out: "plandeck-darwin-arm64" },
  { target: "bun-windows-x64", out: "plandeck-windows-x64.exe" },
];

await $`mkdir -p dist-bin`;

for (const { target, out } of TARGETS) {
  console.log(`compile: ${target} -> dist-bin/${out}`);
  await $`bun build --compile --target=${target} --outfile dist-bin/${out} ./bin/plandeck.ts`;
}

console.log(`compile: done (${TARGETS.length} targets).`);
