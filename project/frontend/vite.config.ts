import tailwindcss from "@tailwindcss/vite";

import { defineConfig } from "vite";
import devtools from "solid-devtools/vite";
import solidPlugin from "vite-plugin-solid";
import { URL, fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [devtools(), solidPlugin(), tailwindcss()],
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 3000,
    // The client talks to the backend by absolute URL (VITE_API_BASE_URL) with
    // credentialed CORS, so no dev proxy is needed — dev and prod use one path.
  },
  build: { target: "esnext" },
});
