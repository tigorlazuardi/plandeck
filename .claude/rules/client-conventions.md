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
- Directories are **collapsed by default**; an effect calls `mantineTree.expandAllNodes()`
  only when a filter is active (so nested matches are visible). Do NOT seed
  `getTreeExpandedState(treeData, "*")` at mount — `treeData` is `[]` while the query loads,
  so the seed is empty anyway.
- ⚠️ `renderNode` must OWN the click: `Tree` has `expandOnClick={false}` and the node's
  `onClick` does `toggleExpanded` (dir) / `navigate` (file). Do NOT also call
  `elementProps.onClick` — that re-toggles and the folder never opens (real bug).
- ⚠️ Two infinite-loop traps with Mantine `Tree`:
  1. `useEffect(() => controller.initialize(data), [data])` loops if `data` identity changes
     every render — keep `treeData` memoized and make any **test mock of `useTree`** return a
     STABLE object (react-query already does).
  2. The controller from `useMantineTree()` is a fresh object each render — do NOT put it in a
     `useEffect` dep array (it would re-run `expandAllNodes` every render).

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
