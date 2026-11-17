import { SITE_NAME, type PageMeta } from "./page-meta.ts"

export interface HeadTag {
  tag: "meta" | "link"
  attrs: Record<string, string>
}

/** Accepts only an http(s) origin, because every canonical and preview URL is built by appending a root path to it. */
export function parseSiteUrl(value: string | null | undefined) {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    const isOrigin = url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password
    return isOrigin && (url.protocol === "https:" || url.protocol === "http:") ? url.origin : null
  } catch {
    return null
  }
}

/**
 * The Wiki is served at the root of the origin, so this file also speaks for the apps beside it: Admin and the
 * identity provider stay out, while Stream stays open. /api/ and /media/ stay open too: Google renders pages with
 * JavaScript and treats a page whose data it may not fetch as empty. A build without a public address is not the
 * real site, so nothing of it should be crawled.
 */
export function renderRobots(siteUrl: string | null) {
  return siteUrl
    ? `User-agent: *\nAllow: /\nDisallow: /auth/\nDisallow: /admin/\nDisallow: /idp/\n\nSitemap: ${siteUrl}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n"
}

/** Media may be stored with a CDN URL or a same-origin path; previews always need an absolute one. */
export function absoluteUrl(url: string, siteUrl: string | null) {
  try {
    return new URL(url, siteUrl ?? undefined).href
  } catch {
    return null
  }
}

function property(name: string, content: string): HeadTag {
  return { tag: "meta", attrs: { property: name, content } }
}

function named(name: string, content: string): HeadTag {
  return { tag: "meta", attrs: { name, content } }
}

/** One list for the static pages and for the browser, so the two cannot describe a page differently. */
export function headTags(meta: PageMeta, siteUrl: string | null): HeadTag[] {
  const canonical = siteUrl && `${siteUrl}${meta.path}`
  const image = meta.image && absoluteUrl(meta.image.url, siteUrl)
  // Without a public address nothing here could be canonical, so such a build must never be indexed.
  const hidden = meta.noindex || !siteUrl
  const tags: HeadTag[] = [
    named("description", meta.description),
    property("og:site_name", SITE_NAME),
    property("og:type", meta.type ?? "website"),
    property("og:title", meta.heading),
    property("og:description", meta.description),
    property("og:locale", meta.locale.replace("-", "_")),
    named("twitter:title", meta.heading),
    named("twitter:description", meta.description),
  ]
  if (hidden) tags.push(named("robots", "noindex"))
  if (canonical && !meta.noindex) tags.push({ tag: "link", attrs: { rel: "canonical", href: canonical } })
  if (canonical) tags.push(property("og:url", canonical))
  if (image) {
    tags.push(property("og:image", image), named("twitter:image", image))
    if (meta.image?.alt) tags.push(property("og:image:alt", meta.image.alt), named("twitter:image:alt", meta.image.alt))
    if (meta.image?.width) tags.push(property("og:image:width", String(meta.image.width)))
    if (meta.image?.height) tags.push(property("og:image:height", String(meta.image.height)))
    if (meta.image?.type) tags.push(property("og:image:type", meta.image.type))
  }
  // Large cards crop to a wide image, which suits hero artwork but not icons or the square logo.
  const { width = 0, height = 0 } = meta.image ?? {}
  tags.push(named("twitter:card", image && width >= 600 && width > height ? "summary_large_image" : "summary"))
  return tags
}

/** Replaces the previous page's tags, including those written into a static page before the app started. */
export function applyPageHead(document: Document, meta: PageMeta, siteUrl: string | null) {
  document.title = meta.title
  for (const element of document.head.querySelectorAll("[data-seo]")) element.remove()
  for (const { tag, attrs } of headTags(meta, siteUrl)) {
    const element = document.createElement(tag)
    element.setAttribute("data-seo", "")
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value)
    document.head.append(element)
  }
}
