import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { ResolvedConfig } from "../shared/types.ts";

// ── Zod schemas ──────────────────────────────────────────────────────────────

const ExtListSchema = z.array(z.string().regex(/^\./, "Extensions must start with '.'"));

const PlandeckConfigFileSchema = z
  .object({
    port: z.number().int().positive().optional(),
    host: z.string().optional(),
    title: z.string().optional(),
    open: z.boolean().optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    textFiles: ExtListSchema.optional(),
    nonTextFiles: ExtListSchema.optional(),
    maxFileBytes: z.number().int().positive().optional(),
  })
  .strict();

const ResolvedConfigSchema = z.object({
  root: z.string().min(1, "root must be non-empty"),
  port: z.number().int().positive("port must be a positive integer"),
  host: z.string(),
  title: z.string(),
  open: z.boolean(),
  include: z.array(z.string()),
  exclude: z.array(z.string()),
  textFiles: ExtListSchema,
  nonTextFiles: ExtListSchema,
  maxFileBytes: z.number().int().positive(),
});

// ── Built-in defaults ─────────────────────────────────────────────────────────

const BUILTIN_DEFAULTS = {
  port: 4321,
  host: "127.0.0.1",
  open: false,
  include: [] as string[],
  exclude: [] as string[],
  textFiles: [".md", ".mdx", ".txt"],
  nonTextFiles: [".html", ".htm", ".pdf", ".jpg", ".jpeg", ".png"],
  maxFileBytes: 5 * 1024 * 1024,
} as const;

// ── resolveConfig ─────────────────────────────────────────────────────────────

/**
 * Resolve config from layered sources. Precedence (later wins per key):
 *   built-in defaults < ENV (PLANDECK_*) < .plandeck.json < overrides arg (CLI)
 *
 * Resolution order subtlety:
 *   1. Resolve root: defaults < env(PLANDECK_ROOT) < overrides.root
 *   2. Read .plandeck.json from that root
 *   3. Merge: defaults → env → plandeck config → overrides
 *   4. title-from-basename if no layer provided a title
 *   5. Validate final shape via zod
 */
export function resolveConfig(
  overrides?: Partial<ResolvedConfig> & { root?: string },
  opts?: { cwd?: string; env?: Record<string, string | undefined> },
): ResolvedConfig {
  const cwd = opts?.cwd ?? process.cwd();
  const env = opts?.env ?? process.env;

  // Step 1: resolve root first (defaults < env < overrides)
  const defaultRoot = cwd;
  const envRoot = env.PLANDECK_ROOT;
  const root = overrides?.root ?? envRoot ?? defaultRoot;

  // Step 2: read .plandeck.json from resolved root
  let pdconfig: z.infer<typeof PlandeckConfigFileSchema> = {};
  const pdconfigPath = path.join(root, ".plandeck.json");
  if (fs.existsSync(pdconfigPath)) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(pdconfigPath, "utf-8"));
    } catch (e) {
      throw new Error(
        `Failed to parse .plandeck.json at ${pdconfigPath}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const result = PlandeckConfigFileSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Invalid .plandeck.json at ${pdconfigPath}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      );
    }
    pdconfig = result.data;
  }

  // Step 3: parse ENV values
  const envPort = env.PLANDECK_PORT !== undefined ? Number(env.PLANDECK_PORT) : undefined;
  const envHost = env.PLANDECK_HOST;
  const envTitle = env.PLANDECK_TITLE;
  const envOpenRaw = env.PLANDECK_OPEN;
  const envOpen =
    envOpenRaw !== undefined ? envOpenRaw === "true" || envOpenRaw === "1" : undefined;

  // Track whether any layer explicitly set a title (for basename fallback logic)
  const anyTitleSet =
    overrides?.title !== undefined || pdconfig.title !== undefined || envTitle !== undefined;

  // Step 4: merge layers (later wins per key)
  // defaults → env → pdconfig → overrides
  const merged: ResolvedConfig = {
    root,
    port: overrides?.port ?? pdconfig.port ?? envPort ?? BUILTIN_DEFAULTS.port,
    host: overrides?.host ?? pdconfig.host ?? envHost ?? BUILTIN_DEFAULTS.host,
    title:
      overrides?.title ?? pdconfig.title ?? envTitle ?? (anyTitleSet ? "" : path.basename(root)),
    open: overrides?.open ?? pdconfig.open ?? envOpen ?? BUILTIN_DEFAULTS.open,
    include: overrides?.include ?? pdconfig.include ?? BUILTIN_DEFAULTS.include,
    exclude: overrides?.exclude ?? pdconfig.exclude ?? BUILTIN_DEFAULTS.exclude,
    textFiles: overrides?.textFiles ?? pdconfig.textFiles ?? [...BUILTIN_DEFAULTS.textFiles],
    nonTextFiles: overrides?.nonTextFiles ??
      pdconfig.nonTextFiles ?? [...BUILTIN_DEFAULTS.nonTextFiles],
    maxFileBytes: overrides?.maxFileBytes ?? pdconfig.maxFileBytes ?? BUILTIN_DEFAULTS.maxFileBytes,
  };

  // Step 5: title fallback to basename if nothing set it
  if (!anyTitleSet) {
    merged.title = path.basename(root);
  }

  // Step 6: validate final config
  const validation = ResolvedConfigSchema.safeParse(merged);
  if (!validation.success) {
    throw new Error(
      `Invalid resolved config: ${validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  }

  return validation.data;
}
