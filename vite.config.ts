import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pluginRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: pluginRoot,
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  plugins: [react()],
  define: {
    __AUTH_USER_HASH__: JSON.stringify(""),
    __AUTH_PASSWORD_HASH__: JSON.stringify(""),
  },
  build: {
    emptyOutDir: true,
    manifest: "manifest.json",
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    rollupOptions: {
      input: fileURLToPath(new URL("./client-entry.tsx", import.meta.url)),
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
