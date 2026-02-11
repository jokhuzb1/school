import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
