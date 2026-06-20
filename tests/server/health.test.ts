import { describe, expect, it } from "bun:test";
import { app } from "../../src/server/app.ts";

describe("GET /api/tree", () => {
  it("returns 200 with correct shape", async () => {
    const res = await app.request("/api/tree");
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toBeObject();
    const obj = body as Record<string, unknown>;
    expect(typeof obj.root).toBe("string");
    expect(obj.title).toBe("Visual Planner");
    expect(Array.isArray(obj.tree)).toBe(true);
  });
});
