import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

let tmpRoot: string;

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vp-raw-test-"));

  // Write fixture files
  fs.writeFileSync(path.join(tmpRoot, "sample.pdf"), "%PDF-1.4 fake");
  fs.writeFileSync(path.join(tmpRoot, "sample.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(tmpRoot, "sample.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
  fs.writeFileSync(path.join(tmpRoot, "hello.txt"), "hello world");

  // Set VP_ROOT before importing app
  process.env.VP_ROOT = tmpRoot;
});

afterAll(() => {
  process.env.VP_ROOT = undefined;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

async function getApp() {
  const mod = await import("../../src/server/app.ts");
  return mod.app;
}

// ── confinedResolve unit tests (imported directly) ────────────────────────────
describe("confinedResolve", () => {
  it("accepts valid in-root file", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    const result = confinedResolve(tmpRoot, "sample.pdf");
    expect("resolved" in result).toBe(true);
  });

  it("rejects '..' path component", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    const result = confinedResolve(tmpRoot, "../etc/passwd");
    expect("error" in result).toBe(true);
  });

  it("rejects percent-encoded '..' (%2e%2e)", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    const result = confinedResolve(tmpRoot, "%2e%2e%2fetc%2fpasswd");
    expect("error" in result).toBe(true);
  });

  it("rejects encoded absolute path (%2fetc%2fpasswd)", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    const result = confinedResolve(tmpRoot, "%2fetc%2fpasswd");
    expect("error" in result).toBe(true);
  });

  it("rejects absolute path injection", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    const result = confinedResolve(tmpRoot, "/etc/passwd");
    expect("error" in result).toBe(true);
  });

  it("rejects symlink escaping root", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    const symlinkPath = path.join(tmpRoot, "escape.pdf");
    try {
      fs.symlinkSync("/etc/passwd", symlinkPath);
    } catch {
      return; // skip if symlink creation fails
    }
    try {
      const result = confinedResolve(tmpRoot, "escape.pdf");
      expect("error" in result).toBe(true);
    } finally {
      fs.unlinkSync(symlinkPath);
    }
  });

  it("rejects directory", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    const subdir = path.join(tmpRoot, "subdir");
    fs.mkdirSync(subdir, { recursive: true });
    const result = confinedResolve(tmpRoot, "subdir");
    expect("error" in result).toBe(true);
  });

  it("rejects nonexistent file", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    const result = confinedResolve(tmpRoot, "doesnotexist.pdf");
    expect("error" in result).toBe(true);
    expect((result as { error: number }).error).toBe(404);
  });
});

// ── HTTP endpoint tests ───────────────────────────────────────────────────────
describe("GET /api/raw/*", () => {
  it("serves pdf with application/pdf content-type", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/sample.pdf");
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("application/pdf");
  });

  it("serves png with image/png content-type", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/sample.png");
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("image/png");
  });

  it("serves jpg with image/jpeg content-type", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/sample.jpg");
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("image/jpeg");
  });

  it("serves unknown ext with application/octet-stream", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/hello.txt");
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("application/octet-stream");
  });

  it("rejects percent-encoded path traversal %2e%2e%2fetc%2fpasswd → 403", async () => {
    const app = await getApp();
    // This reaches our handler because %2e%2e is NOT normalized by Hono router
    const res = await app.request("/api/raw/%2e%2e%2fetc%2fpasswd");
    expect(res.status === 403 || res.status === 404).toBe(true);
  });

  it("rejects encoded absolute path %2fetc%2fpasswd → 403", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/%2fetc%2fpasswd");
    expect(res.status === 403 || res.status === 404).toBe(true);
  });

  it("returns 404 for nonexistent file", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/doesnotexist.pdf");
    expect(res.status).toBe(404);
  });

  it("returns 404 for directory", async () => {
    const app = await getApp();
    fs.mkdirSync(path.join(tmpRoot, "testdir"), { recursive: true });
    const res = await app.request("/api/raw/testdir");
    expect(res.status === 403 || res.status === 404).toBe(true);
  });
});
