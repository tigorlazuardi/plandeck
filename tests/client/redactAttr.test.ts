import { describe, expect, test } from "bun:test";
import { isSensitiveKey } from "../../src/client/render/redactAttr.ts";

describe("isSensitiveKey", () => {
  test("matches known secret-shaped keys (case-insensitive substring)", () => {
    expect(isSensitiveKey("http.request.header.authorization")).toBe(true);
    expect(isSensitiveKey("api_key")).toBe(true);
    expect(isSensitiveKey("API_KEY")).toBe(true);
    expect(isSensitiveKey("x-auth-token")).toBe(true);
    expect(isSensitiveKey("user.password")).toBe(true);
    expect(isSensitiveKey("Secret-Value")).toBe(true);
    expect(isSensitiveKey("Cookie")).toBe(true);
  });

  test("does not flag ordinary attribute keys", () => {
    expect(isSensitiveKey("db.statement")).toBe(false);
    expect(isSensitiveKey("user.id")).toBe(false);
    expect(isSensitiveKey("service.name")).toBe(false);
    expect(isSensitiveKey("http.status_code")).toBe(false);
  });
});
