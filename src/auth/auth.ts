declare const __AUTH_USER_HASH__: string;
declare const __AUTH_PASSWORD_HASH__: string;

export const AUTH_SESSION_KEY = "harmotrail.auth.v1";
export const LEGACY_AUTH_SESSION_KEY = "chord-canvas.auth.v1";

export async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function sameHash(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyCredentials(
  userId: string,
  password: string,
): Promise<boolean> {
  return verifyCredentialHashes(
    userId,
    password,
    __AUTH_USER_HASH__,
    __AUTH_PASSWORD_HASH__,
  );
}

export async function verifyCredentialHashes(
  userId: string,
  password: string,
  expectedUserHash: string,
  expectedPasswordHash: string,
): Promise<boolean> {
  const [userHash, passwordHash] = await Promise.all([
    sha256(userId.trim()),
    sha256(password),
  ]);
  return (
    sameHash(userHash, expectedUserHash) &&
    sameHash(passwordHash, expectedPasswordHash)
  );
}

export function hasAuthSession(storage: Storage = sessionStorage): boolean {
  return (
    storage.getItem(AUTH_SESSION_KEY) === "authenticated" ||
    storage.getItem(LEGACY_AUTH_SESSION_KEY) === "authenticated"
  );
}
export function createAuthSession(storage: Storage = sessionStorage): void {
  storage.setItem(AUTH_SESSION_KEY, "authenticated");
}
export function clearAuthSession(storage: Storage = sessionStorage): void {
  storage.removeItem(AUTH_SESSION_KEY);
  storage.removeItem(LEGACY_AUTH_SESSION_KEY);
}
