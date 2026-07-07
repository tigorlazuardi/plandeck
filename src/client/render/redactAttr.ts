/**
 * Tier-A universal redaction: attribute KEYS matching any of these substrings
 * (case-insensitive) have their VALUE masked in the UI. The key itself stays
 * visible — it's the debug join key, only the secret-shaped value is hidden.
 */
export const SENSITIVE_ATTR_KEY_SUBSTRINGS = [
  "token",
  "password",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "credential",
  "private_key",
  "bearer",
  "cookie",
] as const;

/** True when `key` looks like it holds a secret (case-insensitive substring match). */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_ATTR_KEY_SUBSTRINGS.some((needle) => lower.includes(needle));
}
