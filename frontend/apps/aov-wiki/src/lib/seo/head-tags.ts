import { LOGO_IMAGE, SITE_NAME, type PageMeta } from "./page-meta.ts"

export interface HeadTag {
  tag: "meta" | "link" | "script"
  attrs: Record<string, string>
  /** The content of a script tag: structured data, already safe to place inside the tag. */
  text?: string
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

/**
 * Schema.org data for search results: the site and its publisher on the home page, the breadcrumb trail on every page
 * below it, and the date of an article that has one. Nothing for a page that must not be indexed.
 */
export function structuredData(meta: PageMeta, siteUrl: string | null) {
  if (!siteUrl || meta.noindex) return null
  const canonical = `${siteUrl}${meta.path}`
  const organization = { "@id": `${siteUrl}/#organization` }
  const graph: Record<string, unknown>[] = []
  if (meta.path === "/")
    graph.push(
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        url: canonical,
        description: meta.description,
        inLanguage: meta.locale,
        publisher: organization,
      },
      {
        "@type": "Organization",
        ...organization,
        name: SITE_NAME,
        url: canonical,
        logo: absoluteUrl(LOGO_IMAGE, siteUrl),
      },
    )
  if (meta.breadcrumbs && meta.breadcrumbs.length > 1)
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: meta.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: `${siteUrl}${crumb.path}`,
      })),
    })
  if (meta.type === "article" && meta.published) {
    const image = meta.image && absoluteUrl(meta.image.url, siteUrl)
    graph.push({
      "@type": "Article",
      headline: meta.heading,
      description: meta.description,
      datePublished: meta.published,
      inLanguage: meta.locale,
      mainEntityOfPage: canonical,
      ...(image ? { image } : {}),
      author: organization,
      publisher: organization,
    })
  }
  if (!graph.length) return null
  // "<" never appears raw, so published text cannot close the script tag.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")
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
  const data = structuredData(meta, siteUrl)
  if (data) tags.push({ tag: "script", attrs: { type: "application/ld+json" }, text: data })
  return tags
}

/** Replaces the previous page's tags, including those written into a static page before the app started. */
export function applyPageHead(document: Document, meta: PageMeta, siteUrl: string | null) {
  document.title = meta.title
  for (const element of document.head.querySelectorAll("[data-seo]")) element.remove()
  for (const { tag, attrs, text } of headTags(meta, siteUrl)) {
    const element = document.createElement(tag)
    element.setAttribute("data-seo", "")
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value)
    if (text) element.textContent = text
    document.head.append(element)
  }
}
