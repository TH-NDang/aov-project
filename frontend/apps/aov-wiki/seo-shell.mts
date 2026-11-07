import { existsSync } from "node:fs"
import path from "node:path"
import type { Plugin, ResolvedConfig } from "vite"
import { parseSiteUrl, renderRobots } from "./src/lib/seo/head-tags.ts"

const NOINDEX = '<meta data-seo name="robots" content="noindex" />'
const HEAD_END = "<!-- /seo:head -->"

const withNoindex = (html: string) => html.replace(HEAD_END, `${NOINDEX}\n    ${HEAD_END}`)

/**
 * Emits what the prerender step and static hosting need from every build: 200.html, the app shell served for any
 * address without its own page, and robots.txt. The preview server follows the same lookup as production hosting.
 */
export function seoShell(): Plugin {
  let config: ResolvedConfig
  return {
    name: "wiki-seo-shell",
    configResolved(resolved) {
      config = resolved
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const entry = bundle["index.html"]
        if (!entry || entry.type !== "asset") return
        const html = String(entry.source)
        const site = parseSiteUrl(config.env.VITE_WIKI_URL)
        if (config.env.VITE_WIKI_URL && !site)
          this.error("VITE_WIKI_URL must be an http(s) origin without a path, for example https://wiki.example.com.")
        // A brand-new page shows up here until the next prerender, and an unknown address stays here for good.
        this.emitFile({ type: "asset", fileName: "200.html", source: withNoindex(html) })
        if (!site) entry.source = withNoindex(html)
        this.emitFile({ type: "asset", fileName: "robots.txt", source: renderRobots(site) })
      },
    },
    configurePreviewServer(server) {
      const distDir = path.resolve(config.root, config.build.outDir)
      server.middlewares.use((request, _response, next) => {
        const [pathname, query] = (request.url ?? "/").split("?")
        const isPage = !pathname.startsWith("/api/") && !pathname.startsWith("/media/") && !path.extname(pathname)
        if (isPage && (request.method === "GET" || request.method === "HEAD")) {
          const target = path.posix.join(decodeURI(pathname), "index.html")
          const served = existsSync(path.join(distDir, target)) ? target : "/200.html"
          request.url = query === undefined ? served : `${served}?${query}`
        }
        next()
      })
    },
  }
}
