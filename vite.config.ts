import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_USER_HASH =
  "d332d21e4ad5f0a0282f858a05f113d05aa6bc1e8ce25c1e6775e9df7e9deb06";
const DEFAULT_PASSWORD_HASH =
  "0aef5ff2241dfaeecf1df1464c2f1008d72e40d1e379c10b2f2b9db54629a280";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "CHORD_AUTH_");
  return {
    plugins: [react()],
    base: "/Chord-Canvas/",
    define: {
      __AUTH_USER_HASH__: JSON.stringify(
        env.CHORD_AUTH_USER_HASH || DEFAULT_USER_HASH,
      ),
      __AUTH_PASSWORD_HASH__: JSON.stringify(
        env.CHORD_AUTH_PASSWORD_HASH || DEFAULT_PASSWORD_HASH,
      ),
    },
  };
});
