import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { sanitizeFilename } from "../../src/server/raw.ts";

let tmpRoot: string;

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vp-raw-test-"));

  // Write fixture files
  fs.writeFileSync(path.join(tmpRoot, "sample.pdf"), "%PDF-1.4 fake");
  fs.writeFileSync(path.join(tmpRoot, "sample.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(tmpRoot, "sample.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
  fs.writeFileSync(path.join(tmpRoot, "hello.txt"), "hello world");
  fs.writeFileSync(path.join(tmpRoot, "page.html"), "<html><body>hello</body></html>");
  fs.writeFileSync(
    path.join(tmpRoot, "image.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  );

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

  it("rejects intermediate dir symlink pointing outside root (dir-symlink bypass)", async () => {
    const { confinedResolve } = await import("../../src/server/raw.ts");
    // Create a dir OUTSIDE root with a secret file
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-outside-"));
    const secretContent = "SECRET_CONTENT_SHOULD_NOT_LEAK";
    fs.writeFileSync(path.join(outsideDir, "secret.txt"), secretContent);
    // Create a dir symlink INSIDE root pointing at the outside dir
    const linkPath = path.join(tmpRoot, "link");
    try {
      fs.symlinkSync(outsideDir, linkPath, "dir");
    } catch {
      // If symlink creation fails (e.g. no permission), skip but do not silently pass
      fs.rmSync(outsideDir, { recursive: true, force: true });
      console.warn("Skipping dir-symlink test: symlink creation failed");
      return;
    }
    try {
      // `link/secret.txt` lexically resolves inside root but escapes via the dir symlink
      const result = confinedResolve(tmpRoot, "link/secret.txt");
      // Must be REJECTED — not a resolved path
      expect("error" in result).toBe(true);
    } finally {
      fs.unlinkSync(linkPath);
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
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

  // XSS mitigation: active-content types must be forced to download
  it("html file → content-type octet-stream (not text/html)", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/page.html");
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("application/octet-stream");
    expect(ct).not.toContain("text/html");
  });

  it("html file → has Content-Disposition: attachment", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/page.html");
    expect(res.status).toBe(200);
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toContain("attachment");
  });

  it("html file → has X-Content-Type-Options: nosniff", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/page.html");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("svg file → content-type octet-stream (not image/svg+xml)", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/image.svg");
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("application/octet-stream");
    expect(ct).not.toContain("image/svg+xml");
  });

  it("svg file → has Content-Disposition: attachment", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/image.svg");
    expect(res.status).toBe(200);
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toContain("attachment");
  });

  it("pdf → has X-Content-Type-Options: nosniff", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/sample.pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("png → has X-Content-Type-Options: nosniff", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/sample.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("pdf → no Content-Disposition (served inline)", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/sample.pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBeNull();
  });

  it("every raw response has Content-Security-Policy: sandbox", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/sample.pdf");
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox");
  });

  it("404 response includes nosniff and CSP", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/doesnotexist.bin");
    expect(res.status).toBe(404);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox");
  });

  it("403 response includes nosniff and CSP", async () => {
    const app = await getApp();
    const res = await app.request("/api/raw/%2e%2e%2fetc%2fpasswd");
    expect(res.status === 403 || res.status === 404).toBe(true);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox");
  });

  it("file with quote in name → Content-Disposition is well-formed and has filename*=", async () => {
    // On Linux most filesystems allow `"` in filenames. Try to create one; skip if not.
    const quotedName = 'weird"file.bin';
    const quotedPath = path.join(tmpRoot, quotedName);
    let created = false;
    try {
      fs.writeFileSync(quotedPath, "data");
      created = true;
    } catch {
      console.warn('Skipping quote-filename test: cannot create file with `"` in name');
      return;
    }
    try {
      const app = await getApp();
      const res = await app.request(`/api/raw/${encodeURIComponent(quotedName)}`);
      expect(res.status).toBe(200);
      const cd = res.headers.get("content-disposition") ?? "";
      // Must not contain a raw double-quote inside the filename="..." value
      // (would break the header). The filename= token must be well-formed.
      expect(cd).toContain("attachment");
      expect(cd).toContain('filename="');
      expect(cd).not.toMatch(/filename="[^"]*"[^"]*"/); // no stray quote inside value
      // RFC 5987 extended form must also be present
      expect(cd).toContain("filename*=UTF-8''");
    } finally {
      if (created) fs.unlinkSync(quotedPath);
    }
  });
});

// ── sanitizeFilename unit tests ───────────────────────────────────────────────
describe("sanitizeFilename", () => {
  it("leaves a normal filename unchanged in safeName", () => {
    const { safeName, encoded } = sanitizeFilename("hello.txt");
    expect(safeName).toBe("hello.txt");
    expect(encoded).toBe("hello.txt");
  });

  it("replaces double-quote with underscore in safeName", () => {
    const { safeName } = sanitizeFilename('file"name.txt');
    expect(safeName).not.toContain('"');
    expect(safeName).toBe("file_name.txt");
  });

  it("replaces CR and LF with underscore in safeName", () => {
    const { safeName } = sanitizeFilename("file\r\nname.txt");
    expect(safeName).not.toContain("\r");
    expect(safeName).not.toContain("\n");
    expect(safeName).toBe("file__name.txt");
  });

  it("replaces other control chars (\\x01–\\x1f) in safeName", () => {
    const { safeName } = sanitizeFilename("file\x01\x1fname.txt");
    expect(safeName).toBe("file__name.txt");
  });

  it("percent-encodes special chars in encoded form", () => {
    const { encoded } = sanitizeFilename('file"na me.txt');
    expect(encoded).toContain("%22"); // " → %22
    expect(encoded).toContain("%20"); // space → %20
  });

  it("produces well-formed Content-Disposition from a hostile filename", () => {
    const { safeName, encoded } = sanitizeFilename('at"tack\r\nfile.bin');
    const header = `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
    // Header must not contain bare CR or LF (would split the header)
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    // filename= value must be closed properly — no unescaped quote inside
    const filenameMatch = header.match(/filename="([^"]*)"/);
    expect(filenameMatch).not.toBeNull();
  });
});
