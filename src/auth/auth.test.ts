import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_KEY,
  LEGACY_AUTH_SESSION_KEY,
  clearAuthSession,
  createAuthSession,
  hasAuthSession,
  sha256,
  verifyCredentialHashes,
} from "./auth";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("ログイン認証", () => {
  it("SHA-256で認証情報を照合する", async () => {
    const userHash = await sha256("harmotrail");
    const passwordHash = await sha256("HarmoTrail-2026!");
    expect(
      await verifyCredentialHashes(
        " harmotrail ",
        "HarmoTrail-2026!",
        userHash,
        passwordHash,
      ),
    ).toBe(true);
    expect(
      await verifyCredentialHashes(
        "harmotrail",
        "wrong-password",
        userHash,
        passwordHash,
      ),
    ).toBe(false);
    expect(
      await verifyCredentialHashes(
        "someone",
        "HarmoTrail-2026!",
        userHash,
        passwordHash,
      ),
    ).toBe(false);
  });
  it("ログイン状態をタブのsessionStorageで作成・削除する", () => {
    const storage = memoryStorage();
    expect(hasAuthSession(storage)).toBe(false);
    createAuthSession(storage);
    expect(storage.getItem(AUTH_SESSION_KEY)).toBe("authenticated");
    expect(hasAuthSession(storage)).toBe(true);
    clearAuthSession(storage);
    expect(hasAuthSession(storage)).toBe(false);
  });
  it("旧名称のログイン状態を引き継いで削除できる", () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_AUTH_SESSION_KEY, "authenticated");
    expect(hasAuthSession(storage)).toBe(true);
    clearAuthSession(storage);
    expect(hasAuthSession(storage)).toBe(false);
  });
});
