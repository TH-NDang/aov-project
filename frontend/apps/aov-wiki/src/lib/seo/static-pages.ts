import { formLabelRole, heroFormPath } from "../hero-forms.ts"
import type { HeroRole } from "../hero-classifications.ts"
import { warehousePath, WAREHOUSE_TABS } from "../wiki-catalog.ts"
import { absoluteUrl, headTags } from "./head-tags.ts"
import {
  contactMeta,
  DEFAULT_IMAGE,
  heroMeta,
  heroPositionLabels,
  heroRoleLabels,
  homeMeta,
  modeMeta,
  patchMeta,
  plainText,
  sectionMeta,
  SECTIONS,
  SITE_NAME,
  termMeta,
  warehouseEntryMeta,
  type HeroMetaSource,
  type ModeMetaSource,
  type PageImage,
  type PageMeta,
  type PatchLike,
  type SectionKey,
  type WarehouseEntryLike,
  type WarehouseTab,
} from "./page-meta.ts"
import { warehouseText } from "@aov/ui/lib/warehouse-content"

/** Static pages describe the default market and language; other languages stay a view of the same URL (ADR-022). */
export const STATIC_SCOPE = { region: "VN", locale: "vi-VN" } as const
const LOCALE = STATIC_SCOPE.locale

/** One build as a static page lists it: the warehouse entries by id, in slot order. */
export interface PublishedBuild {
  source: string
  items: readonly string[]
  enchantments: readonly string[]
  arcana: readonly { id: string; quantity: number }[]
  spellId?: string | null
}

export interface PublishedHero extends HeroMetaSource {
  id: string
  positions?: readonly string[]
  skills: readonly { name?: string | null; description?: string | null }[]
  skins: readonly { name?: string | null }[]
  /** The first build of each source; older callers may leave them out. */
  builds?: readonly PublishedBuild[]
  /** The published forms of a hero that holds forms, default form first (ADR-024). */
  forms?: readonly PublishedHeroForm[]
}

export interface PublishedHeroForm {
  id: string
  code: string
  formKey: string
  name: string
  roles: readonly HeroRole[]
  positions?: readonly string[]
  summary?: string | null
  media?: HeroMetaSource["media"]
  skills: PublishedHero["skills"]
  skins: PublishedHero["skins"]
  builds?: PublishedHero["builds"]
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
  /** Published game modes; older callers may leave them out. */
  modes?: readonly PublishedMode[]
}

export interface PublishedMode extends ModeMetaSource {
  group: string
  publishedAt?: string | null
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

/** How a build names the entries it holds: each links to that entry's own page. */
type EntryNames = ReadonlyMap<string, { tab: WarehouseTab; code: string; name: string }>

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

/**
 * A hero that holds forms has one page per form (ADR-024): the default form at the hero's own address, every other
 * at /hero/<hero>/<form key>. The forms' former addresses and ids preview the same page, unlisted.
 */
function heroFormPages(hero: PublishedHero, forms: readonly PublishedHeroForm[], names: EntryNames): StaticPage[] {
  return forms.flatMap((form, index) => {
    const role = formLabelRole(form, forms)
    const label = (role && heroRoleLabels([role], LOCALE)[0]) || form.name
    const page = heroPage(
      {
        ...hero,
        roles: form.roles,
        positions: form.positions,
        summary: form.summary || hero.summary,
        media: { ...hero.media, ...form.media },
        skills: form.skills,
        skins: [...hero.skins, ...form.skins],
        builds: form.builds,
        form: { key: form.formKey, label, isDefault: index === 0 },
        forms: undefined,
      },
      names,
    )[0]
    const switcher = list(forms.map((other) => link(heroFormPath(hero.code, other.formKey, forms), other.name)))
    const listed = { ...page, body: page.body.replace("</main>", `<h2>Dạng</h2>${switcher}</main>`) }
    const aliases = [form.code, form.id, ...(index === 0 ? [hero.id, `${hero.code}/${form.formKey}`] : [])]
    return [listed, ...aliases.map((alias) => ({ ...listed, path: `/hero/${alias}`, listed: false }))]
  })
}

/** The builds as lists of linked names; an entry the catalog does not know is left out. */
function buildSection(builds: readonly PublishedBuild[], names: EntryNames) {
  const named = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const entry = names.get(id)
      return entry ? [link(warehousePath(entry.tab, entry.code), entry.name)] : []
    })
  const rows = builds.flatMap((build) => {
    const parts = [
      ["Trang bị", named(build.items)],
      ["Phù hiệu", named(build.enchantments)],
      [
        "Bảng ngọc",
        build.arcana.flatMap((row) => {
          const [name] = named([row.id])
          return name ? [`${name} ×${row.quantity}`] : []
        }),
      ],
      ["Phụ trợ", named(build.spellId ? [build.spellId] : [])],
    ] as const
    const lines = parts.flatMap(([label, values]) => (values.length ? [`${label}: ${values.join(", ")}`] : []))
    return lines.length ? [`<h3>${escapeHtml(build.source)}</h3>${list(lines)}`] : []
  })
  return rows.length ? `<h2>Lên đồ</h2>${rows.join("")}` : ""
}

function heroPage(hero: PublishedHero, names: EntryNames = new Map()): StaticPage[] {
  if (hero.forms?.length) return heroFormPages(hero, hero.forms, names)
  const meta = heroMeta({ ...hero, hasBuild: !!hero.builds?.length }, LOCALE)
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
      buildSection(hero.builds ?? [], names),
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
  const text = warehouseText(entry.content.translations, LOCALE)
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
    const text = warehouseText(entry.content.translations, LOCALE)
    const summary = plainText(text?.summary)
    return `${link(warehousePath(tab, entry.code), text?.name ?? entry.code)}${summary ? `: ${escapeHtml(summary)}` : ""}`
  })
  return {
    path: meta.path,
    meta,
    body: page(meta.heading, paragraph(meta.description) + list(rows)),
    listed: true,
    lastmod: latest(entries.map((entry) => entry.revision?.publishedAt)),
  }
}

/** The newest of the dates that have already passed: a list changes when the last of its entries went live. */
function latest(values: readonly (string | null | undefined)[], now = new Date().toISOString()) {
  const passed = values.filter((value): value is string => !!value && value <= now)
  return passed.length ? passed.reduce((newest, value) => (value > newest ? value : newest)) : null
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
  const names: EntryNames = new Map(
    WAREHOUSE_TABS.flatMap((tab) =>
      catalog.warehouse[tab]
        .filter((entry) => entry.revision?.state === "PUBLISHED")
        .map((entry) => [
          entry.id,
          { tab, code: entry.code, name: warehouseText(entry.content.translations, LOCALE)?.name ?? entry.code },
        ]),
    ),
  )
  pages.push(...catalog.heroes.flatMap((hero) => heroPage(hero, names)))
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

  const modes = sectionMeta("modes", LOCALE)
  pages.push({
    path: modes.path,
    meta: modes,
    body: page(
      modes.heading,
      paragraph(modes.description) +
        list(
          (catalog.modes ?? []).map((mode) => {
            const label = link(`/modes/${encodeURIComponent(mode.code)}`, mode.name)
            const details = plainText(mode.summary)
            return details ? `${label}: ${escapeHtml(details)}` : label
          }),
        ),
    ),
    listed: true,
    lastmod: latest((catalog.modes ?? []).map((mode) => mode.publishedAt)),
  })
  for (const mode of catalog.modes ?? []) {
    const meta = modeMeta(mode, LOCALE)
    pages.push({
      path: meta.path,
      meta,
      body: page(mode.name, paragraph(plainText(mode.summary)) + `<p>${link("/modes", "Tất cả chế độ chơi")}</p>`),
      listed: true,
      lastmod: mode.publishedAt,
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
    lastmod: latest(catalog.patches.map((patch) => patch.effectiveAt)),
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
    .map(({ tag, attrs, text }) => {
      const attributes = Object.entries(attrs)
        .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
        .join(" ")
      // structuredData has already made the text safe inside a script tag.
      return text === undefined
        ? `<${tag} data-seo ${attributes} />`
        : `<${tag} data-seo ${attributes}>${text}</${tag}>`
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

/** A page's own art, for Google Images; the shared preview card is not the page's picture. */
function sitemapImage(page: StaticPage, siteUrl: string) {
  const url = page.meta.image?.url
  const image = url && url !== DEFAULT_IMAGE.url ? absoluteUrl(url, siteUrl) : null
  return image ? `<image:image><image:loc>${escapeHtml(image)}</image:loc></image:image>` : ""
}

export function renderSitemap(pages: readonly StaticPage[], siteUrl: string) {
  const urls = pages
    .filter((page) => page.listed)
    .map((page) => {
      const lastmod = sitemapDate(page.lastmod)
      return `  <url><loc>${escapeHtml(`${siteUrl}${page.meta.path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${sitemapImage(page, siteUrl)}</url>`
    })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`
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
