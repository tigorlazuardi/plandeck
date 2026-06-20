---
paths: ["src/**", "tests/**"]
---

# TypeScript strict gotchas (tsconfig)

This project's tsconfig enables `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
Two patterns recur:

## exactOptionalPropertyTypes — don't pass `string | undefined` to `prop?: string`
Passing a possibly-`undefined` value to an optional prop fails (it wants the key absent, not
present-with-undefined). Spread the key conditionally:
```ts
const pathProp = val !== undefined ? { path: val } : {};
return <C {...pathProp} />;
```

## noUncheckedIndexedAccess — `array[i]` is `T | undefined`
After a length/guard check, assert with `!` and a biome-ignore:
```ts
const hit = hits[0]!; // biome-ignore lint/style/noNonNullAssertion: length checked above
```
