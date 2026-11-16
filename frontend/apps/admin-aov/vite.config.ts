import { mediaPath } from "../../tooling/media-proxy.mts"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import { jsonStorage } from "./server/json-storage.ts"

export default defineConfig({
  server: {
    proxy: {
      "/api/community": { target: process.env.COMMUNITY_API_TARGET || "http://localhost:8082", changeOrigin: true },
      "/api/wiki": { target: process.env.WIKI_API_TARGET || "http://localhost:8080", changeOrigin: true },
      "/media/": {
        target: process.env.WIKI_MEDIA_FILER_TARGET || "http://localhost:8888",
        changeOrigin: true,
        bypass(req, res) {
          if (req.method !== "GET" && req.method !== "HEAD") {
            if (res) {
              res.statusCode = 405
              res.end()
            }
            return false
          }
        },
        rewrite: (path) => mediaPath(path, process.env.WIKI_MEDIA_BUCKET || "wiki-media"),
      },
    },
  },
  preview: {
    proxy: {
      "/api/community": { target: process.env.COMMUNITY_API_TARGET || "http://localhost:8082", changeOrigin: true },
      "/api/wiki": { target: process.env.WIKI_API_TARGET || "http://localhost:8080", changeOrigin: true },
      "/media/": {
        target: process.env.WIKI_MEDIA_FILER_TARGET || "http://localhost:8888",
        changeOrigin: true,
        bypass(req, res) {
          if (req.method !== "GET" && req.method !== "HEAD") {
            if (res) {
              res.statusCode = 405
              res.end()
            }
            return false
          }
        },
        rewrite: (path) => mediaPath(path, process.env.WIKI_MEDIA_BUCKET || "wiki-media"),
      },
    },
  },
  optimizeDeps: { include: ["@tanstack/react-table"] },
  plugins: [react(), tailwindcss(), jsonStorage(fileURLToPath(new URL("./storage", import.meta.url)))],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rolldownOptions: {
      output: {
        // Keep the framework in its own long-lived chunk; it changes far less often than app code.
        codeSplitting: {
          groups: [
            { name: "react-vendor", test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
