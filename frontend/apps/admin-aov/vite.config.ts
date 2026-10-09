import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { createReadStream, statSync } from "node:fs"
import { extname, resolve, sep } from "node:path"
import { fileURLToPath, URL } from "node:url"

const RESOURCES_ROOT = fileURLToPath(new URL("../../../resources/Lien-Quan-v3", import.meta.url))

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
}

/**
 * Serves the working data set in `resources/` under `/__resources/` so the admin app can run
 * against realistic data before the wiki-service admin API exists. Dev and preview only.
 */
function aovResources(): Plugin {
  const handler = (req: { url?: string }, res: import("node:http").ServerResponse, next: () => void) => {
    const pathname = decodeURIComponent((req.url ?? "/").split("?")[0])
    const file = resolve(RESOURCES_ROOT, "." + pathname)
    const type = CONTENT_TYPES[extname(file).toLowerCase()]
    if (!type || !file.startsWith(RESOURCES_ROOT + sep)) return next()
    try {
      const stat = statSync(file)
      if (!stat.isFile()) return next()
      res.setHeader("Content-Type", type)
      res.setHeader("Content-Length", stat.size)
      res.setHeader("Cache-Control", "no-cache")
      createReadStream(file).pipe(res)
    } catch {
      next()
    }
  }
  return {
    name: "aov-resources",
    configureServer(server) {
      server.middlewares.use("/__resources", handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use("/__resources", handler)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), aovResources()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rolldownOptions: {
      output: {
        // Keep the framework in its own long-lived chunk; it changes far less often than app code.
        codeSplitting: {
          groups: [{ name: "react-vendor", test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ }],
        },
      },
    },
  },
})
