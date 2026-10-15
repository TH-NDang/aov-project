import { mediaPath } from "../../tooling/media-proxy.mts"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  server: {
    proxy: {
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
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
})
