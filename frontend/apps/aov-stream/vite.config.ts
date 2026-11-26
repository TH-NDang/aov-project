import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"

const proxy = {
  "/api/community": { target: process.env.COMMUNITY_API_TARGET || "http://localhost:8082", changeOrigin: true },
  "/api/wiki": { target: process.env.WIKI_API_TARGET || "http://localhost:8080", changeOrigin: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  // What every page needs is one script and one sheet, whatever else comes on demand. A chunk of its own would put the
  // sheets of what the parts share with it before all others, and the order decides between rules that are alike.
  build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: "app", tags: ["$initial"] }] } } } },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
})
