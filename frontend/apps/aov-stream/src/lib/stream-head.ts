/** What a Stream page says about itself to search engines and link previews. */
export interface StreamHeadInput {
  title: string
  description?: string
  /** The router path of the page, without the app's base path. */
  path: string
  /** A page about the signed-in reader, or one that does not exist: it must not be indexed. */
  noindex?: boolean
  /** BCP 47, such as vi-VN. */
  locale: string
}

export interface StreamHeadTag {
  tag: "meta" | "link"
  attrs: Record<string, string>
}

export const STREAM_SITE_NAME = "AOV Stream"

/** The public origin Stream is served from, read from the Wiki address the build knows; null outside a real site. */
export function streamOrigin(wikiUrl: string | null | undefined) {
  if (!wikiUrl?.trim()) return null
  try {
    const url = new URL(wikiUrl.trim())
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null
  } catch {
    return null
  }
}

/** The address of a page as the reverse proxy serves it: Stream lives under its base path, home with a slash. */
export function streamCanonical(origin: string | null, basePath: string, path: string) {
  if (!origin) return null
  const base = basePath.replace(/\/+$/, "")
  return `${origin}${base}${path === "/" || !path ? "/" : path}`
}

/** Without a public address nothing can be canonical, so such a build is never indexed, as in the Wiki (ADR-022). */
export function streamHeadTags(page: StreamHeadInput, canonical: string | null): StreamHeadTag[] {
  const meta = (key: "name" | "property", name: string, content: string): StreamHeadTag => ({
    tag: "meta",
    attrs: { [key]: name, content },
  })
  const tags: StreamHeadTag[] = [
    meta("property", "og:site_name", STREAM_SITE_NAME),
    meta("property", "og:type", "website"),
    meta("property", "og:title", page.title),
    meta("property", "og:locale", page.locale.replace("-", "_")),
  ]
  if (page.description)
    tags.push(meta("name", "description", page.description), meta("property", "og:description", page.description))
  if (page.noindex || !canonical) tags.push(meta("name", "robots", "noindex"))
  else tags.push({ tag: "link", attrs: { rel: "canonical", href: canonical } }, meta("property", "og:url", canonical))
  return tags
}

/** A description taken from running text: its first words, about 160 characters, ending on a whole word. */
export function pageSummary(text: string | null | undefined, limit = 160) {
  const words = (text ?? "").replace(/\s+/g, " ").trim()
  if (words.length <= limit) return words || undefined
  const cut = words.slice(0, limit - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`
}
