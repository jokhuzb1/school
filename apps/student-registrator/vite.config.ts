import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // `exceljs` intentionally stays in a lazy chunk for export/import features.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          exceljs: ["exceljs"],
        },
      },
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
});

