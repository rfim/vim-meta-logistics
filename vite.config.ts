import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Multi-page app: every page keeps its own URL (index.html, story.html, ...), relative base for GitHub Pages.
const pages = ["index", "overview", "fettle", "toast", "nexus", "mining", "spares", "governance", "notebook"];

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: { input: Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)])) },
  },
});
