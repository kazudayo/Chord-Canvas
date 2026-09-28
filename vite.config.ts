import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_USER_HASH =
  "a31473b2c6a69fabd2cb4459fff92e80e3c9afd3277f7558f22d5d73c9efee9c";
const DEFAULT_PASSWORD_HASH =
  "b15a945402e077494a0c321629baf4e085aeb73f6f71fd3509bbedf00ee21e3d";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    base: "/HarmoTrail/",
    define: {
      __AUTH_USER_HASH__: JSON.stringify(
        env.HARMOTRAIL_AUTH_USER_HASH ||
          env.CHORD_AUTH_USER_HASH ||
          DEFAULT_USER_HASH,
      ),
      __AUTH_PASSWORD_HASH__: JSON.stringify(
        env.HARMOTRAIL_AUTH_PASSWORD_HASH ||
          env.CHORD_AUTH_PASSWORD_HASH ||
          DEFAULT_PASSWORD_HASH,
      ),
    },
  };
});
