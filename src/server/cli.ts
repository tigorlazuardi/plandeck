import { defineCommand } from "citty";
import type { ResolvedConfig } from "../shared/types.ts";
import { resolveConfig } from "./config.ts";
import { startServer } from "./index.ts";

// Extended overrides type — includes CLI-only flags not in ResolvedConfig
export type CliOverrides = Partial<ResolvedConfig> & {
  root?: string;
  includeHidden?: boolean;
  useGitignore?: boolean;
};

// Raw parsed args shape from citty
interface CliArgs {
  dir?: string;
  port?: number;
  host?: string;
  title?: string;
  open?: boolean;
  include?: string | string[];
  exclude?: string | string[];
  hidden?: boolean;
  noGitignore?: boolean;
}

/**
 * Map parsed CLI args → overrides object for resolveConfig.
 * Only sets keys that were explicitly provided.
 */
export function buildCliOverrides(args: CliArgs): CliOverrides {
  const overrides: CliOverrides = {};

  if (args.dir !== undefined) {
    overrides.root = args.dir;
  }
  if (args.port !== undefined) {
    overrides.port = args.port;
  }
  if (args.host !== undefined) {
    overrides.host = args.host;
  }
  if (args.title !== undefined) {
    overrides.title = args.title;
  }
  if (args.open !== undefined) {
    overrides.open = args.open;
  }
  if (args.include !== undefined) {
    overrides.include = Array.isArray(args.include) ? args.include : [args.include];
  }
  if (args.exclude !== undefined) {
    overrides.exclude = Array.isArray(args.exclude) ? args.exclude : [args.exclude];
  }
  if (args.hidden === true) {
    overrides.includeHidden = true;
  }
  if (args.noGitignore === true) {
    overrides.useGitignore = false;
  }

  return overrides;
}

export const cli = defineCommand({
  meta: {
    name: "visual-planner",
    version: "0.1.0",
    description: "Serve a directory of docs as a local read-only web app",
  },
  args: {
    dir: {
      type: "positional",
      description: "Directory to serve (defaults to cwd)",
      required: false,
    },
    port: {
      type: "string",
      description: "Port to listen on",
      alias: "p",
    },
    host: {
      type: "string",
      description: "Host to bind to",
    },
    title: {
      type: "string",
      description: "Site title",
    },
    open: {
      type: "boolean",
      description: "Open browser after start",
      default: false,
    },
    include: {
      type: "string",
      description: "Glob patterns to include (repeatable)",
      alias: "i",
    },
    exclude: {
      type: "string",
      description: "Glob patterns to exclude (repeatable)",
      alias: "e",
    },
    hidden: {
      type: "boolean",
      description: "Include hidden files/dirs",
      default: false,
    },
    "no-gitignore": {
      type: "boolean",
      description: "Disable .gitignore filtering",
      default: false,
    },
  },
  async run({ args }) {
    const rawArgs: CliArgs = {};

    if (args.dir) rawArgs.dir = args.dir;
    if (args.port) rawArgs.port = Number(args.port);
    if (args.host) rawArgs.host = args.host;
    if (args.title) rawArgs.title = args.title;
    if (args.open) rawArgs.open = args.open;
    if (args.include) rawArgs.include = args.include;
    if (args.exclude) rawArgs.exclude = args.exclude;
    if (args.hidden) rawArgs.hidden = args.hidden;
    if (args["no-gitignore"]) rawArgs.noGitignore = args["no-gitignore"];

    const overrides = buildCliOverrides(rawArgs);
    const config = resolveConfig(overrides);

    const { actualPort } = await startServer(config);

    // actualPort used by startServer banner; suppress unused warning
    void actualPort;
  },
});
