import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
    },
  },
});
