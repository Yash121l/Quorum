import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Mirrors the production /ingest reverse proxy (functions/ingest/[[path]].ts) locally.
const posthogProxy = {
  "/ingest/static": {
    target: "https://us-assets.i.posthog.com",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/ingest/, ""),
  },
  "/ingest": {
    target: "https://us.i.posthog.com",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/ingest/, ""),
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          // Suppress EPIPE — fires when the browser closes a WS connection
          // while the proxy still has data buffered. Completely harmless.
          proxy.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EPIPE" || err.code === "ECONNRESET") return;
            console.error("[proxy]", err.message);
          });
        },
      },
      "/nodes": { target: "http://localhost:8787", changeOrigin: true },
      "/observer": { target: "http://localhost:8787", changeOrigin: true },
      ...posthogProxy,
    },
  },
  preview: {
    proxy: posthogProxy,
  },
});
