/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getClientEnvVariables() {
  const clientEnv: Record<string, string> = {};

  for (const key in process.env) {
    if (key.startsWith("CLIENT")) {
      clientEnv[`import.meta.env.${key}`] = JSON.stringify(process.env[key]);
    }
  }

  return clientEnv;
}

export default defineConfig({
  plugins: [react()],
  // define: getClientEnvVariables(),
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "/index.html"),
        oauth: resolve(__dirname, "/oauth-callback.html"),
        connect: resolve(__dirname, "/connect.html"),
        // dev: resolve(__dirname, "/dev.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    globalSetup: "./vitest-global.ts",
    setupFiles: "./vitest.setup.ts",
    globals: true,
  },
});
