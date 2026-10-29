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
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
})
