import path from "node:path"

/** The faces nearly every page's text is set in: regular weight, Latin and Vietnamese letters. */
const FACES = ["be-vietnam-pro-latin-400-normal", "be-vietnam-pro-vietnamese-400-normal"]

/** What this plugin reads of Vite's build output; typed here so the tooling folder needs no Vite of its own. */
interface BuiltFile {
  type: string
  fileName: string
}

/**
 * A Vite plugin that preloads the body text faces from the built page, so they arrive with the stylesheet instead of
 * after it and the text is not drawn twice. The other weights and letter sets still load when the page uses them.
 */
export function fontPreload(faces: readonly string[] = FACES) {
  let base = "/"
  return {
    name: "aov-font-preload",
    apply: "build" as const,
    configResolved(config: { base: string }) {
      base = config.base
    },
    transformIndexHtml: {
      order: "post" as const,
      handler(_html: string, context: { bundle?: Record<string, BuiltFile> }) {
        return Object.values(context.bundle ?? {})
          .filter(
            (output) =>
              output.type === "asset" &&
              output.fileName.endsWith(".woff2") &&
              faces.some((face) => path.basename(output.fileName).startsWith(`${face}-`)),
          )
          .map((output) => ({
            tag: "link",
            attrs: { rel: "preload", as: "font", type: "font/woff2", crossorigin: "", href: base + output.fileName },
            injectTo: "head" as const,
          }))
      },
    },
  }
}
