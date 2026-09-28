import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
const [, , userId, password] = process.argv;
if (!userId || !password) {
  console.error("使い方: npm run auth:set -- <ユーザーID> <パスワード>");
  process.exit(1);
}
if (password.length < 10) {
  console.error("パスワードは10文字以上にしてください。");
  process.exit(1);
}
const hash = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");
await writeFile(
  new URL("../.env.local", import.meta.url),
  `CHORD_AUTH_USER_HASH=${hash(userId.trim())}\nCHORD_AUTH_PASSWORD_HASH=${hash(password)}\n`,
  { mode: 0o600 },
);
console.log(
  "認証情報のハッシュを .env.local に保存しました。開発サーバーを再起動してください。",
);
