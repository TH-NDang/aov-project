import { warehousePath, WAREHOUSE_TABS } from "../wiki-catalog.ts"
import { headTags } from "./head-tags.ts"
import {
  contactMeta,
  heroMeta,
  heroPositionLabels,
  heroRoleLabels,
  homeMeta,
  patchMeta,
  plainText,
  sectionMeta,
  SECTIONS,
  SITE_NAME,
  termMeta,
  translationFor,
  warehouseEntryMeta,
  type HeroMetaSource,
  type PageImage,
  type PageMeta,
  type PatchLike,
  type SectionKey,
  type WarehouseEntryLike,
  type WarehouseTab,
} from "./page-meta.ts"

/** Static pages describe the default market and language; other languages stay a view of the same URL (ADR-022). */
export const STATIC_SCOPE = { region: "VN", locale: "vi-VN" } as const
const LOCALE = STATIC_SCOPE.locale

export interface PublishedHero extends HeroMetaSource {
  id: string
  positions?: readonly string[]
  skills: readonly { name?: string | null; description?: string | null }[]
  skins: readonly { name?: string | null }[]
}

export interface PublishedEntry extends WarehouseEntryLike {
  id: string
  revision?: { state?: string | null; publishedAt?: string | null } | null
}

export interface PublishedPatch extends PatchLike {
  effectiveAt?: string | null
}

export interface PublishedCatalog {
  heroes: readonly PublishedHero[]
  skins: readonly { heroCode: string; heroName: string; name: string }[]
  warehouse: Record<WarehouseTab, readonly PublishedEntry[]>
  terms: readonly { id: string; name: string; description?: string | null }[]
  patches: readonly PublishedPatch[]
}

export interface StaticPage {
  /** Where the page is served. It differs from the canonical path for older links to the same content. */
  path: string
  meta: PageMeta
  body: string
  /** Only canonical pages belong in the sitemap. */
  listed: boolean
  lastmod?: string | null
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const link = (href: string, text: string) => `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
const sectionName = (key: SectionKey) => SECTIONS[key].name[0]
const list = (rows: readonly string[]) =>
  rows.length ? `<ul>${rows.map((row) => `<li>${row}</li>`).join("")}</ul>` : ""
const paragraph = (text: string | null | undefined) => (text ? `<p>${escapeHtml(text)}</p>` : "")

function picture(image: PageImage | undefined) {
  if (!image) return ""
  const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ""
  return `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt ?? "")}"${size} />`
}

const contents = `<nav aria-label="Mục lục">${list(
  (Object.keys(SECTIONS) as SectionKey[]).map((key) => link(SECTIONS[key].path, sectionName(key))),
)}</nav>`

function page(heading: string, content: string) {
  return `<div data-prerendered><header>${link("/", SITE_NAME)}${contents}</header><main><h1>${escapeHtml(heading)}</h1>${content}</main></div>`
}

function heroPage(hero: PublishedHero): StaticPage[] {
  const meta = heroMeta(hero, LOCALE)
  const roles = heroRoleLabels(hero.roles, LOCALE)
  const positions = heroPositionLabels(hero.positions, LOCALE)
  const skills = hero.skills.flatMap((skill) =>
    skill.name ? [`<strong>${escapeHtml(skill.name)}</strong>: ${escapeHtml(plainText(skill.description))}`] : [],
  )
  const skins = hero.skins.flatMap((skin) => (skin.name ? [escapeHtml(skin.name)] : []))
  const body = page(
    hero.name,
    [
      picture(meta.image),
      paragraph(hero.title),
      paragraph(plainText(hero.summary)),
      roles.length ? paragraph(`Vai trò: ${roles.join(", ")}`) : "",
      positions.length ? paragraph(`Vị trí: ${positions.join(", ")}`) : "",
      skills.length ? `<h2>Kỹ năng</h2>${list(skills)}` : "",
      skins.length ? `<h2>Trang phục</h2>${list(skins)}` : "",
      `<p>${link("/hero", "Tất cả tướng")}</p>`,
    ].join(""),
  )
  // Rich text in the wiki links heroes by id, so those addresses must preview the same page.
  return [
    { path: meta.path, meta, body, listed: true },
    { path: `/hero/${encodeURIComponent(hero.id)}`, meta, body, listed: false },
  ]
}

function warehouseEntryPage(tab: WarehouseTab, entry: PublishedEntry): StaticPage[] {
  const meta = warehouseEntryMeta(tab, entry, LOCALE)
  const text = translationFor(entry.content.translations, LOCALE)
  const body = page(
    text?.name ?? entry.code,
    [
      picture(meta.image?.url.startsWith("/images/") ? undefined : meta.image),
      paragraph(plainText(text?.summary)),
      paragraph(plainText(text?.description)),
      `<p>${link(warehousePath(tab), `Tất cả ${sectionName(tab).toLowerCase()}`)}</p>`,
    ].join(""),
  )
  const lastmod = entry.revision?.publishedAt
  return [
    { path: meta.path, meta, body, listed: true, lastmod },
    { path: warehousePath(tab, entry.id), meta, body, listed: false },
  ]
}

function warehouseListPage(tab: WarehouseTab, entries: readonly PublishedEntry[]): StaticPage {
  const meta = sectionMeta(tab, LOCALE)
  const rows = entries.map((entry) => {
    const text = translationFor(entry.content.translations, LOCALE)
    const summary = plainText(text?.summary)
    return `${link(warehousePath(tab, entry.code), text?.name ?? entry.code)}${summary ? `: ${escapeHtml(summary)}` : ""}`
  })
  return {
    path: meta.path,
    meta,
    body: page(meta.heading, paragraph(meta.description) + list(rows)),
    listed: true,
  }
}

function skinsPage(catalog: PublishedCatalog): StaticPage {
  const meta = sectionMeta("skins", LOCALE)
  const byHero = new Map<string, { name: string; skins: string[] }>()
  for (const skin of catalog.skins) {
    const hero = byHero.get(skin.heroCode) ?? { name: skin.heroName, skins: [] }
    hero.skins.push(skin.name)
    byHero.set(skin.heroCode, hero)
  }
  const groups = [...byHero].map(
    ([code, hero]) =>
      `<h2>${link(`/hero/${encodeURIComponent(code)}`, hero.name)}</h2>${list(hero.skins.map(escapeHtml))}`,
  )
  return {
    path: meta.path,
    meta,
    body: page(meta.heading, paragraph(meta.description) + groups.join("")),
    listed: true,
  }
}

/** Every page crawlers can reach, from published data only: anything the public API does not return has no page. */
export function buildStaticPages(catalog: PublishedCatalog): StaticPage[] {
  const pages: StaticPage[] = []
  const home = homeMeta(LOCALE)
  pages.push({
    path: home.path,
    meta: home,
    body: page(
      SITE_NAME,
      paragraph(home.description) +
        list(
          (Object.keys(SECTIONS) as SectionKey[]).map(
            (key) => `${link(SECTIONS[key].path, sectionName(key))}: ${escapeHtml(SECTIONS[key].description[0])}`,
          ),
        ),
    ),
    listed: true,
  })

  const contact = contactMeta(LOCALE)
  pages.push({
    path: contact.path,
    meta: contact,
    body: page(contact.heading, paragraph(contact.description)),
    listed: true,
  })

  const heroes = sectionMeta("heroes", LOCALE)
  pages.push({
    path: heroes.path,
    meta: heroes,
    body: page(
      heroes.heading,
      paragraph(heroes.description) +
        list(
          catalog.heroes.map((hero) => {
            const roles = heroRoleLabels(hero.roles, LOCALE)
            const label = link(`/hero/${encodeURIComponent(hero.code)}`, hero.name)
            return roles.length ? `${label}: ${escapeHtml(roles.join(", "))}` : label
          }),
        ),
    ),
    listed: true,
  })
  pages.push(...catalog.heroes.flatMap(heroPage))
  pages.push(skinsPage(catalog))

  for (const tab of WAREHOUSE_TABS) {
    const entries = catalog.warehouse[tab].filter((entry) => entry.revision?.state === "PUBLISHED")
    pages.push(warehouseListPage(tab, entries))
    pages.push(...entries.flatMap((entry) => warehouseEntryPage(tab, entry)))
    // A bare /warehouse opens the first tab.
    if (tab === WAREHOUSE_TABS[0]) pages.push({ ...warehouseListPage(tab, entries), path: "/warehouse", listed: false })
  }

  const terms = sectionMeta("terms", LOCALE)
  pages.push({
    path: terms.path,
    meta: terms,
    body: page(
      terms.heading,
      paragraph(terms.description) +
        list(
          catalog.terms.map((term) => {
            const details = plainText(term.description)
            const label = link(`/terms/${encodeURIComponent(term.id)}`, term.name)
            return details ? `${label}: ${escapeHtml(details)}` : label
          }),
        ),
    ),
    listed: true,
  })
  for (const term of catalog.terms) {
    const meta = termMeta(term, LOCALE)
    pages.push({
      path: meta.path,
      meta,
      body: page(term.name, paragraph(plainText(term.description)) + `<p>${link("/terms", "Tất cả thuật ngữ")}</p>`),
      listed: true,
    })
  }

  const updates = sectionMeta("updates", LOCALE)
  pages.push({
    path: updates.path,
    meta: updates,
    body: page(
      updates.heading,
      paragraph(updates.description) +
        list(
          catalog.patches.map((patch) =>
            link(`/updates/${encodeURIComponent(patch.code)}`, plainText(patch.title) || patch.code),
          ),
        ),
    ),
    listed: true,
  })
  for (const patch of catalog.patches) {
    const meta = patchMeta(patch, LOCALE)
    pages.push({
      path: meta.path,
      meta,
      body: page(
        meta.heading,
        paragraph(plainText(patch.summary)) +
          paragraph(plainText(patch.description)) +
          `<p>${link("/updates", "Tất cả ghi chú cập nhật")}</p>`,
      ),
      listed: true,
      lastmod: patch.effectiveAt,
    })
  }
  return pages
}

function renderHead(meta: PageMeta, siteUrl: string) {
  return headTags(meta, siteUrl)
    .map(({ tag, attrs }) => {
      const attributes = Object.entries(attrs)
        .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
        .join(" ")
      return `<${tag} data-seo ${attributes} />`
    })
    .join("\n    ")
}

const replaceBetween = (html: string, pattern: RegExp, value: string, label: string) => {
  if (!pattern.test(html)) throw new Error(`The page template has no ${label}.`)
  // A function keeps "$" in published text from being read as a replacement pattern.
  return html.replace(pattern, () => value)
}

/** The app replaces the body when it starts, so what is written here is only ever read without JavaScript. */
export function renderStaticPage(template: string, page: StaticPage, siteUrl: string) {
  let html = replaceBetween(
    template,
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(page.meta.title)}</title>`,
    "title",
  )
  html = replaceBetween(
    html,
    /<!-- seo:head -->[\s\S]*?<!-- \/seo:head -->/,
    `<!-- seo:head -->\n    ${renderHead(page.meta, siteUrl)}\n    <!-- /seo:head -->`,
    "head marker",
  )
  return replaceBetween(html, /<!-- seo:body -->/, page.body, "body marker")
}

/** Full timestamps are valid too, but only the day is known to be meaningful across markets. */
const sitemapDate = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null

export function renderSitemap(pages: readonly StaticPage[], siteUrl: string) {
  const urls = pages
    .filter((page) => page.listed)
    .map((page) => {
      const lastmod = sitemapDate(page.lastmod)
      return `  <url><loc>${escapeHtml(`${siteUrl}${page.meta.path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`
    })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
}

/** Two pages sharing a title or description compete with each other in search results. */
export function repeatedMeta(pages: readonly StaticPage[]) {
  const repeated: string[] = []
  for (const field of ["title", "description"] as const) {
    const seen = new Map<string, string>()
    for (const page of pages.filter((candidate) => candidate.listed)) {
      const other = seen.get(page.meta[field])
      if (other) repeated.push(`${field}: ${other} and ${page.path}`)
      else seen.set(page.meta[field], page.path)
    }
  }
  return repeated
}
