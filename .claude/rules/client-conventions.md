---
paths: ["src/client/**", "tests/client/**"]
---

# Visual Planner client conventions

Durable patterns established in slice 1.2 (client shell + tree + render).

## Data hooks (`src/client/api.ts`)
- `useTree()` — queryKey `['tree']`, `fetchTree` → `GET /api/tree`, typed `TreeResponse`.
- `useDoc(path)` — queryKey `['doc', path]`, `enabled: Boolean(path)`, `fetchDoc` →
  `GET /api/doc/${path}`, typed `DocResponse`.
- All types come from `src/shared/types.ts` (frozen contract). Do not redefine.

## Tree sidebar
- `TreeSidebar` uses `flattenFiles()` + a filter input + a flat `UnstyledButton` list —
  NOT the Mantine `Tree` component (its renderNode wiring is heavy; flat is simpler +
  testable). A later slice may add real hierarchy; keep `flattenFiles` as the seam.
- `matchesFilter` is case-insensitive substring on `node.name` OR `node.path`.

## Theme (Mantine color scheme)
- To avoid FOUC, initialize `MantineProvider` with `defaultColorScheme` read from
  `localStorage` at module level in `main.tsx` — NOT in a `useEffect` after mount.
  Pattern: `const stored = localStorage.getItem('vp-color-scheme'); defaultColorScheme =
  stored === 'dark' || stored === 'light' ? stored : 'auto'`.

## Client tests (bun:test + happy-dom + RTL)
- `tests/setup.ts` registers happy-dom globals AND an `afterEach` that resets
  `document.body` between tests — REQUIRED, or RTL renders accumulate and `getByText`
  finds duplicates across tests. (RTL's `screen` caches the document ref at import, so the
  reset clears the body directly rather than relying on RTL `cleanup()`.)
- Mock ES modules with `mock.module()` from `bun:test` (not `jest.mock`); the mock path
  must match the import specifier used in the source file exactly.
