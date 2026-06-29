---
name: visual-check
description: Use after shipping or changing any plandeck UI (React components in src/client/, themes, layout, viewers) to catch visual regressions a unit test can't — run Playwright in podman, capture screenshots in light AND dark themes, then visually inspect each PNG like a human reviewer. NOT part of CI.
---

# Visual check (human-eye screenshot review)

Unit tests assert structure (a switch exists, a sandbox token is present). They do
**not** catch *visual* defects: low-contrast text, overflow, misalignment, a floating
toolbar that's unreadable over white content, a control that vanishes in dark mode.
This skill closes that gap. It is a **local, manual gate — never wired into CI/CD.**

Trigger it whenever you add or change UI: a new component, a restyle, a new viewer,
a theme tweak, anything a person would *look at*.

## The loop

1. **Capture.** Run the harness (builds SPA, starts the real backend on the e2e
   fixtures, drives `tests/visual/capture.spec.ts` in podman Playwright):

   ```bash
   bun run visual
   ```

   Writes `tests/visual/screenshots/<scenario>-<theme>.png` (gitignored), each
   scenario shot in **both light and dark**. Podman per the project constraint —
   never a host-installed browser.

2. **Add a scenario if your change isn't covered.** Edit
   `tests/visual/capture.spec.ts` — add a `test(...)` inside the `for (const theme
   of THEMES)` loop that navigates to the new UI and `shoot(...)`s it. Every shot
   MUST run in both themes (the loop guarantees this). If the UI needs an
   interaction first (toggle on, menu open), do it in the `prepare` callback before
   the screenshot. Use the e2e fixtures (`tests/e2e/fixtures/`) as content; add a
   fixture there if you need a new doc type.

3. **Inspect every PNG with the Read tool** (Read renders images). Look at the
   *actual pixels*, not just whether the test passed. For each screenshot, the
   light **and** dark variant, check:
   - **Contrast** — is every text/icon readable against its background? (The recurring
     bug: a control floating over doc content or a themed surface, text the same
     value as the background.) Floating chrome must sit on a solid `Paper`/surface,
     not directly over arbitrary content.
   - **Overflow / clipping** — text breaking its container, content cut off, iframes
     not filling the viewport.
   - **Alignment & spacing** — toolbars, buttons, switches lined up; no overlap.
   - **Theme parity** — anything that looks right in one theme but broken in the
     other (hardcoded colors are the usual culprit).
   - **The thing you just changed** — does it actually look the way you intended?

4. **Report findings like a reviewer.** One line per issue:
   `<scenario>-<theme>.png: <what's wrong>. <fix>.` No issues → say so plainly.

5. **Fix, then re-run `bun run visual` and re-inspect.** Loop until clean.

## What it does NOT do

- No pixel-diff/golden-image assertions — the judgment is a human/LLM looking, not
  a byte comparison. (Golden images are brittle across fonts/renderers; this is a
  deliberate review step, not a flaky gate.)
- Not in `ci.yml` or `release.yml`. CI stays: check + unit tests + build. Visual
  review is a pre-commit/pre-release manual step the author runs.

## Files

- `scripts/visual.sh` — the harness (`bun run visual`). Mirrors `scripts/e2e.sh`
  but runs the visual config and dumps PNGs instead of asserting.
- `playwright.visual.config.ts` — separate config, `testDir: tests/visual`,
  1 worker, 0 retries, 1440×900.
- `tests/visual/capture.spec.ts` — the scenarios. Theme set via
  `localStorage('vp-color-scheme')` in `addInitScript` (read at boot in `main.tsx`),
  so it must be set BEFORE navigation.
- `tests/visual/screenshots/` — output, gitignored.

## Related

- E2E (assertion-based, also podman, also non-CI): `scripts/e2e.sh`, `bun run e2e`.
- Theme init pattern: `.claude/rules/client-conventions.md` (localStorage at module
  level, not in a `useEffect`).
