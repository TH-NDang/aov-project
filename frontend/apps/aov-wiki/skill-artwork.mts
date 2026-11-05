import { readFile, readdir } from "node:fs/promises"
import type { Plugin } from "vite"

const directory = new URL("../../../resources/Lien-Quan-v3/assets/skill/", import.meta.url)
const filename = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+-[1-9]\d*\.png$/
const mount = "/skill-artwork/"

/** Serve the same public illustrations in development and in standalone static builds. */
export function skillArtwork(): Plugin {
  return {
    name: "wiki-skill-artwork",
    configureServer(server) {
      server.middlewares.use(mount, async (request, response) => {
        const file = (request.url ?? "").split("?")[0].slice(1)
        if (!filename.test(file) || (request.method !== "GET" && request.method !== "HEAD")) {
          response.writeHead(404).end()
          return
        }
        try {
          const image = await readFile(new URL(file, directory))
          response.writeHead(200, { "Content-Type": "image/png", "Content-Length": image.length })
          response.end(request.method === "HEAD" ? undefined : image)
        } catch {
          response.writeHead(404).end()
        }
      })
    },
    async generateBundle() {
      for (const file of await readdir(directory)) {
        if (filename.test(file))
          this.emitFile({
            type: "asset",
            fileName: `skill-artwork/${file}`,
            source: await readFile(new URL(file, directory)),
          })
      }
    },
  }
}
