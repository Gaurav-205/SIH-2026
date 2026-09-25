import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

// `npm run build`        -> normal multi-file build (dist/) for Vercel/Netlify.
// `npm run build:single` -> one self-contained index.html with hash routing (dist-single/) for offline demos.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  base: mode === "single" ? "./" : "/",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: { outDir: mode === "single" ? "dist-single" : "dist", chunkSizeWarningLimit: 2000 },
}))
