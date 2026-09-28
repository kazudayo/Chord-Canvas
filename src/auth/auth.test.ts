import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_KEY,
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
    const userHash = await sha256("chordcanvas");
    const passwordHash = await sha256("ChordCanvas-2026!");
    expect(
      await verifyCredentialHashes(
        " chordcanvas ",
        "ChordCanvas-2026!",
        userHash,
        passwordHash,
      ),
    ).toBe(true);
    expect(
      await verifyCredentialHashes(
        "chordcanvas",
        "wrong-password",
        userHash,
        passwordHash,
      ),
    ).toBe(false);
    expect(
      await verifyCredentialHashes(
        "someone",
        "ChordCanvas-2026!",
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
});
