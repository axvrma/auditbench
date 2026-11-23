import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react";
          if (
            /\/node_modules\/(recharts|d3-[^/]+|victory-vendor|react-smooth)\//.test(
              id,
            )
          )
            return "charts";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:4001",
      "/screenshots": "http://127.0.0.1:4001",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
