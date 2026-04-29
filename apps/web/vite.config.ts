import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        ws: true,  // proxy WebSocket upgrades for /api/simulations/:id/observer/ws
      },
      "/nodes": { target: "http://localhost:8787", changeOrigin: true },
      "/observer": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});
