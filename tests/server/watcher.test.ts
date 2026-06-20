import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { FsEvent } from "../../src/shared/types.ts";
import type { Watcher } from "../../src/server/watcher.ts";
import { createWatcher } from "../../src/server/watcher.ts";
import type { ResolvedConfig } from "../../src/shared/types.ts";

function makeConfig(root: string): ResolvedConfig {
  return {
    root,
    port: 4321,
    host: "127.0.0.1",
    title: "Test",
    open: false,
    include: [],
    exclude: [],
    textFiles: [".md", ".mdx", ".txt"],
    nonTextFiles: [".html", ".htm", ".pdf", ".jpg", ".jpeg", ".png"],
    maxFileBytes: 5 * 1024 * 1024,
  };
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createWatcher", () => {
  let tmpDir: string;
  let watcher: Watcher;
  let events: FsEvent[];
  let unsub: () => void;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-watcher-test-"));
    events = [];
  });

  afterEach(async () => {
    unsub?.();
    await watcher?.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits add event after creating a file", async () => {
    const config = makeConfig(tmpDir);
    watcher = createWatcher(config);
    unsub = watcher.subscribe((e) => events.push(e));

    // Wait for watcher to be ready
    await waitMs(300);

    fs.writeFileSync(path.join(tmpDir, "hello.md"), "# Hello");
    await waitMs(400);

    const addEvents = events.filter((e) => e.type === "add");
    expect(addEvents.length).toBeGreaterThanOrEqual(1);
    const addEvent = addEvents[0];
    expect(addEvent.type).toBe("add");
    if (addEvent.type === "add" || addEvent.type === "change" || addEvent.type === "unlink") {
      expect(addEvent.path).toBe("hello.md");
    }
  });

  it("emits change event after modifying a file", async () => {
    const filePath = path.join(tmpDir, "edit.md");
    fs.writeFileSync(filePath, "# Initial");

    const config = makeConfig(tmpDir);
    watcher = createWatcher(config);
    unsub = watcher.subscribe((e) => events.push(e));

    // Wait for watcher to be ready
    await waitMs(300);

    fs.writeFileSync(filePath, "# Updated");
    await waitMs(400);

    const changeEvents = events.filter((e) => e.type === "change");
    expect(changeEvents.length).toBeGreaterThanOrEqual(1);
    const changeEvent = changeEvents[0];
    if (changeEvent.type === "add" || changeEvent.type === "change" || changeEvent.type === "unlink") {
      expect(changeEvent.path).toBe("edit.md");
    }
  });

  it("emits unlink event after deleting a file", async () => {
    const filePath = path.join(tmpDir, "gone.md");
    fs.writeFileSync(filePath, "# Bye");

    const config = makeConfig(tmpDir);
    watcher = createWatcher(config);
    unsub = watcher.subscribe((e) => events.push(e));

    // Wait for watcher to be ready
    await waitMs(300);

    fs.unlinkSync(filePath);
    await waitMs(400);

    const unlinkEvents = events.filter((e) => e.type === "unlink");
    expect(unlinkEvents.length).toBeGreaterThanOrEqual(1);
    const unlinkEvent = unlinkEvents[0];
    if (unlinkEvent.type === "add" || unlinkEvent.type === "change" || unlinkEvent.type === "unlink") {
      expect(unlinkEvent.path).toBe("gone.md");
    }
  });

  it("does NOT emit events for files in .git/ subdir", async () => {
    const gitDir = path.join(tmpDir, ".git");
    fs.mkdirSync(gitDir, { recursive: true });

    const config = makeConfig(tmpDir);
    watcher = createWatcher(config);
    unsub = watcher.subscribe((e) => events.push(e));

    await waitMs(300);

    fs.writeFileSync(path.join(gitDir, "COMMIT_EDITMSG"), "test commit");
    await waitMs(400);

    const nonReadyEvents = events.filter((e) => e.type !== "ready");
    expect(nonReadyEvents).toHaveLength(0);
  });

  it("does NOT emit events for files in node_modules/ subdir", async () => {
    const nmDir = path.join(tmpDir, "node_modules");
    fs.mkdirSync(nmDir, { recursive: true });

    const config = makeConfig(tmpDir);
    watcher = createWatcher(config);
    unsub = watcher.subscribe((e) => events.push(e));

    await waitMs(300);

    fs.writeFileSync(path.join(nmDir, "something.js"), "module.exports = {}");
    await waitMs(400);

    const nonReadyEvents = events.filter((e) => e.type !== "ready");
    expect(nonReadyEvents).toHaveLength(0);
  });

  it("does NOT emit events for hidden files", async () => {
    const config = makeConfig(tmpDir);
    watcher = createWatcher(config);
    unsub = watcher.subscribe((e) => events.push(e));

    await waitMs(300);

    fs.writeFileSync(path.join(tmpDir, ".hidden.md"), "# Hidden");
    await waitMs(400);

    const nonReadyEvents = events.filter((e) => e.type !== "ready");
    expect(nonReadyEvents).toHaveLength(0);
  });
});
