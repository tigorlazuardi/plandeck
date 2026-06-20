import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { discover } from "../../src/server/discovery.ts";
import type { ResolvedConfig } from "../../src/shared/types.ts";

let tmpDir: string;

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    root: tmpDir,
    port: 4321,
    host: "127.0.0.1",
    title: "Test",
    open: false,
    include: [],
    exclude: [],
    textFiles: [".md", ".mdx", ".txt"],
    nonTextFiles: [".html", ".htm", ".pdf", ".jpg", ".jpeg", ".png"],
    maxFileBytes: 5 * 1024 * 1024,
    ...overrides,
  };
}

function touch(relPath: string, content = "") {
  const abs = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function mkdir(relPath: string) {
  fs.mkdirSync(path.join(tmpDir, relPath), { recursive: true });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-discovery-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("discover - basic file classification", () => {
  it("classifies .md files as kind=md", () => {
    touch("README.md");
    const tree = discover(makeConfig());
    const node = tree.find((n) => n.name === "README.md");
    expect(node).toBeDefined();
    expect(node?.kind).toBe("md");
    expect(node?.type).toBe("file");
  });

  it("classifies .mdx as kind=mdx", () => {
    touch("page.mdx");
    const tree = discover(makeConfig());
    const node = tree.find((n) => n.name === "page.mdx");
    expect(node?.kind).toBe("mdx");
  });

  it("classifies .txt as kind=txt", () => {
    touch("notes.txt");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "notes.txt")?.kind).toBe("txt");
  });

  it("classifies .html as kind=html", () => {
    touch("page.html");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "page.html")?.kind).toBe("html");
  });

  it("classifies .htm as kind=html", () => {
    touch("page.htm");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "page.htm")?.kind).toBe("html");
  });

  it("classifies .pdf as kind=pdf", () => {
    touch("doc.pdf");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "doc.pdf")?.kind).toBe("pdf");
  });

  it("classifies .jpg as kind=image", () => {
    touch("pic.jpg");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "pic.jpg")?.kind).toBe("image");
  });

  it("classifies .jpeg as kind=image", () => {
    touch("pic.jpeg");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "pic.jpeg")?.kind).toBe("image");
  });

  it("classifies .png as kind=image", () => {
    touch("pic.png");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "pic.png")?.kind).toBe("image");
  });

  it("drops files with unknown extensions", () => {
    touch("script.js");
    touch("style.css");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "script.js")).toBeUndefined();
    expect(tree.find((n) => n.name === "style.css")).toBeUndefined();
  });

  it("case-insensitive extension matching (.MD → md)", () => {
    touch("README.MD");
    const tree = discover(makeConfig());
    const node = tree.find((n) => n.name === "README.MD");
    expect(node?.kind).toBe("md");
  });

  it("case-insensitive extension matching (.PDF → pdf)", () => {
    touch("doc.PDF");
    const tree = discover(makeConfig());
    const node = tree.find((n) => n.name === "doc.PDF");
    expect(node?.kind).toBe("pdf");
  });
});

describe("discover - hidden files and dirs", () => {
  it("skips hidden files (dot-prefixed)", () => {
    touch(".hidden.md");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === ".hidden.md")).toBeUndefined();
  });

  it("skips hidden dirs (dot-prefixed) and their contents", () => {
    touch(".hiddendir/doc.md");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === ".hiddendir")).toBeUndefined();
    // also check recursively via flatten
    const allNodes = flattenTree(tree);
    expect(allNodes.find((n) => n.path.includes(".hiddendir"))).toBeUndefined();
  });
});

describe("discover - symlinks skipped", () => {
  it("skips symlink to file", () => {
    touch("real.md", "# real");
    fs.symlinkSync(path.join(tmpDir, "real.md"), path.join(tmpDir, "link.md"));
    const tree = discover(makeConfig());
    // real.md should appear, link.md should not
    expect(tree.find((n) => n.name === "real.md")).toBeDefined();
    expect(tree.find((n) => n.name === "link.md")).toBeUndefined();
  });

  it("skips symlink to directory", () => {
    mkdir("realdir");
    touch("realdir/doc.md", "# doc");
    fs.symlinkSync(path.join(tmpDir, "realdir"), path.join(tmpDir, "linkdir"));
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "realdir")).toBeDefined();
    expect(tree.find((n) => n.name === "linkdir")).toBeUndefined();
  });
});

describe("discover - gitignore support", () => {
  it("respects root .gitignore", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "ignored.md\n");
    touch("ignored.md");
    touch("kept.md");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "ignored.md")).toBeUndefined();
    expect(tree.find((n) => n.name === "kept.md")).toBeDefined();
  });

  it("respects nested subdir .gitignore", () => {
    mkdir("subdir");
    fs.writeFileSync(path.join(tmpDir, "subdir", ".gitignore"), "secret.md\n");
    touch("subdir/secret.md");
    touch("subdir/public.md");
    const tree = discover(makeConfig());
    const subdir = tree.find((n) => n.name === "subdir");
    expect(subdir?.children?.find((n) => n.name === "secret.md")).toBeUndefined();
    expect(subdir?.children?.find((n) => n.name === "public.md")).toBeDefined();
  });

  it("nested gitignore does not affect sibling dirs", () => {
    mkdir("subdir");
    mkdir("other");
    fs.writeFileSync(path.join(tmpDir, "subdir", ".gitignore"), "secret.md\n");
    touch("subdir/secret.md");
    touch("other/secret.md"); // same name, different dir, not ignored
    const tree = discover(makeConfig());
    const other = tree.find((n) => n.name === "other");
    expect(other?.children?.find((n) => n.name === "secret.md")).toBeDefined();
  });

  it("root .gitignore ignores a whole dir", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");
    mkdir("node_modules");
    touch("node_modules/pkg.md");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "node_modules")).toBeUndefined();
  });
});

describe("discover - include/exclude globs", () => {
  it("include filter: only matching files kept", () => {
    touch("docs/guide.md");
    touch("docs/notes.txt");
    touch("other/readme.md");
    const tree = discover(makeConfig({ include: ["docs/**"] }));
    const allFiles = flattenTree(tree).filter((n) => n.type === "file");
    expect(allFiles.every((n) => n.path.startsWith("docs/"))).toBe(true);
    expect(allFiles.find((n) => n.name === "guide.md")).toBeDefined();
    // other/readme.md excluded
    expect(allFiles.find((n) => n.path === "other/readme.md")).toBeUndefined();
  });

  it("exclude filter removes files matching glob", () => {
    touch("docs/guide.md");
    touch("docs/private.md");
    const tree = discover(makeConfig({ exclude: ["docs/private.md"] }));
    const allFiles = flattenTree(tree).filter((n) => n.type === "file");
    expect(allFiles.find((n) => n.name === "guide.md")).toBeDefined();
    expect(allFiles.find((n) => n.name === "private.md")).toBeUndefined();
  });

  it("exclude on a dir prunes the whole subtree", () => {
    touch("private/secret.md");
    touch("docs/guide.md");
    const tree = discover(makeConfig({ exclude: ["private/**"] }));
    const allNodes = flattenTree(tree);
    expect(allNodes.find((n) => n.path.startsWith("private/"))).toBeUndefined();
    expect(allNodes.find((n) => n.name === "guide.md")).toBeDefined();
  });

  it("explicit include can re-include an otherwise-hidden file", () => {
    // .hidden.md is normally skipped (hidden), but explicit include glob overrides
    touch(".hidden.md");
    const tree = discover(makeConfig({ include: [".hidden.md"] }));
    const allFiles = flattenTree(tree).filter((n) => n.type === "file");
    expect(allFiles.find((n) => n.name === ".hidden.md")).toBeDefined();
  });

  it("explicit include can re-include a gitignored file", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "ignored.md\n");
    touch("ignored.md");
    const tree = discover(makeConfig({ include: ["ignored.md"] }));
    const allFiles = flattenTree(tree).filter((n) => n.type === "file");
    expect(allFiles.find((n) => n.name === "ignored.md")).toBeDefined();
  });
});

describe("discover - sorting", () => {
  it("dirs come before files at same level", () => {
    touch("alpha.md");
    mkdir("beta");
    touch("beta/nested.md");
    touch("gamma.md");
    const tree = discover(makeConfig());
    const types = tree.map((n) => n.type);
    const firstFileIdx = types.indexOf("file");
    const lastDirIdx = types.lastIndexOf("dir");
    if (firstFileIdx !== -1 && lastDirIdx !== -1) {
      expect(lastDirIdx).toBeLessThan(firstFileIdx);
    }
  });

  it("alphabetical case-insensitive within dirs group and files group", () => {
    mkdir("Zeta");
    touch("Zeta/a.md");
    mkdir("alpha");
    touch("alpha/a.md");
    touch("Baz.md");
    touch("aaa.md");
    const tree = discover(makeConfig());
    const dirs = tree.filter((n) => n.type === "dir").map((n) => n.name.toLowerCase());
    const files = tree.filter((n) => n.type === "file").map((n) => n.name.toLowerCase());
    expect(dirs).toEqual([...dirs].sort());
    expect(files).toEqual([...files].sort());
  });
});

describe("discover - relpaths", () => {
  it("relpaths are /- normalized and relative to root", () => {
    mkdir("a/b");
    touch("a/b/doc.md");
    const tree = discover(makeConfig());
    const all = flattenTree(tree).filter((n) => n.type === "file");
    const node = all.find((n) => n.name === "doc.md");
    expect(node?.path).toBe("a/b/doc.md");
    expect(node?.path).not.toContain("\\");
  });
});

describe("discover - empty dirs", () => {
  it("dir with no discovered descendants is omitted", () => {
    mkdir("emptydir");
    const tree = discover(makeConfig());
    // emptydir has no .md/.pdf/etc files → should not appear
    expect(tree.find((n) => n.name === "emptydir")).toBeUndefined();
  });

  it("dir with discovered descendants is included", () => {
    mkdir("docs");
    touch("docs/guide.md");
    const tree = discover(makeConfig());
    expect(tree.find((n) => n.name === "docs")).toBeDefined();
  });
});

describe("discover - kind field", () => {
  it("files have kind field set", () => {
    touch("doc.md");
    const tree = discover(makeConfig());
    const node = tree.find((n) => n.name === "doc.md");
    expect(node?.kind).toBeDefined();
  });

  it("dirs do not have kind field", () => {
    mkdir("docs");
    touch("docs/guide.md");
    const tree = discover(makeConfig());
    const dir = tree.find((n) => n.name === "docs");
    expect(dir?.kind).toBeUndefined();
  });

  it("dirs have children array", () => {
    mkdir("docs");
    touch("docs/guide.md");
    const tree = discover(makeConfig());
    const dir = tree.find((n) => n.name === "docs");
    expect(Array.isArray(dir?.children)).toBe(true);
  });
});

describe("discover - other text extensions → md renderer", () => {
  it("other text ext (not .txt) defaults to md kind", () => {
    // .rst is in textFiles custom list but not the default; let's add it
    touch("notes.rst");
    const cfg = makeConfig({ textFiles: [".md", ".mdx", ".txt", ".rst"] });
    const tree = discover(cfg);
    const node = tree.find((n) => n.name === "notes.rst");
    expect(node?.kind).toBe("md"); // non .md/.mdx/.txt text ext → md
  });
});

// helper: flatten tree to all nodes
function flattenTree(nodes: ReturnType<typeof discover>): ReturnType<typeof discover> {
  const result: ReturnType<typeof discover> = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}
