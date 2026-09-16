import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Отдельный порт от Mini App (5173) — оба должны уметь работать одновременно
// в dev-режиме (раздел 5 ТЗ: "отдельное SPA", не вкладка внутри Mini App).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
});
