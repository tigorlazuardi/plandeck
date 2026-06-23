---
paths: ["src/client/**", "tests/client/**"]
---

# Plandeck client conventions

Durable patterns established in slice 1.2 (client shell + tree + render).

## Data hooks (`src/client/api.ts`)
- `useTree()` — queryKey `['tree']`, `fetchTree` → `GET /api/tree`, typed `TreeResponse`.
- `useDoc(path)` — queryKey `['doc', path]`, `enabled: Boolean(path)`, `fetchDoc` →
  `GET /api/doc/${path}`, typed `DocResponse`.
- All types come from `src/shared/types.ts` (frozen contract). Do not redefine.

## Tree sidebar
- `TreeSidebar` renders the **Mantine `Tree`** component (hierarchical, grouped by
  directory) fed from the nested `TreeNode[]` via `toTreeData()`. Files navigate to
  `/doc/${value}`; directories toggle expand. Long names truncate (ellipsis + `title`).
- `pruneTree(nodes, needle)` is the filter: keeps files whose `name`/`path` contains the
  (lowercased) needle plus the directories leading to them; empty needle = whole tree.
  Expanded state is seeded with `getTreeExpandedState(data, "*")` (expand-all) so grouping
  is visible and filter matches are revealed.
- ⚠️ Mantine `Tree` runs `useEffect(() => controller.initialize(data), [data])`. If the
  `data` array identity changes every render it loops ("Maximum update depth"). Keep
  `treeData` memoized (`useMemo` on `[sourceFiles, needle]`) and ensure any **test mock of
  `useTree`** returns a STABLE object reference (react-query already does) — a fresh object
  per call triggers the loop.

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

## ⚠️ `mock.module('@mantine/core')` is a worker-wide landmine
`tests/client/HtmlView.test.tsx` mocks `@mantine/core` with a PARTIAL stub. bun shares one
module registry per worker, so that stub leaks into EVERY other test in the same worker —
any client file importing a Mantine export NOT in the stub fails with "Export named X not
found". This has broken the suite 3+ times (each new Mantine component must be added to the
stub). **Preferred fix: do NOT mock `@mantine/core` at all — render with a real
`MantineProvider` wrapper** (the pattern the other client tests use). If you add a Mantine
component anywhere in `src/client/`, either remove that mock (best) or add the export to the
stub. Real Mantine + provider is the durable answer.
