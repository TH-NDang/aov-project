/**
 * Writes one static HTML file per public page into dist/, plus sitemap.xml and robots.txt, from the public API.
 *
 * Runs after `vite build` and can run again at any time without rebuilding: it reads the template from dist/200.html
 * and replaces what an earlier run wrote. See backend/docs/adr/ADR-022-wiki-static-prerender.md.
 */
import type { HeroRole } from "../src/lib/hero-classifications.ts"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { renderRobots } from "../src/lib/seo/head-tags.ts"
import { parseSiteUrl } from "../src/lib/seo/site-url.ts"
import {
  buildStaticPages,
  renderSitemap,
  renderStaticPage,
  repeatedMeta,
  STATIC_SCOPE,
  type PublishedCatalog,
  type PublishedEntry,
  type PublishedHero,
  type PublishedMode,
  type PublishedPatch,
  type StaticPage,
} from "../src/lib/seo/static-pages.ts"
import { warehouseText } from "@aov/ui/lib/warehouse-content"

const DETAIL_CONCURRENCY = 4
const PAGE_SIZE = 100
const ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 30_000
/** How the public API answers before any patch is live: a new system has no market data to read yet. */
const NO_GAMEPLAY_CONTEXT = "PATCH_CONTEXT_UNAVAILABLE"
/** Directories written only by this script; removing them is how unpublished content disappears. */
const OWNED_DIRECTORIES = ["hero", "skins", "warehouse", "terms", "updates", "modes", "contact"]

class NotPublic extends Error {}

/** The API answered, with no hero at all: a new system, or a fault that must not wipe the pages already online. */
export class NothingPublished extends Error {}

function apiReader(apiBase: string, retryDelayMs: number) {
  /** `scoped: false` for content that has no region or language variant, such as game modes. */
  return async function read<T>(apiPath: string, params: Record<string, string> = {}, scoped = true): Promise<T> {
    const query = new URLSearchParams({ ...(scoped ? STATIC_SCOPE : {}), ...params })
    const url = `${apiBase.replace(/\/$/, "")}/api/wiki/v1${apiPath}?${query}`
    let failure: unknown
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        // No credentials: only what any anonymous reader can see may reach a static page.
        const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
        if (response.ok) return (await response.json()) as T
        if (response.status === 404) throw new NotPublic(url)
        if (response.status === 422) {
          const { code } = (await response.json().catch(() => ({}))) as { code?: string }
          if (code === NO_GAMEPLAY_CONTEXT) throw new NothingPublished(`The public API has no gameplay context: ${url}`)
        }
        failure = new Error(`${url} answered ${response.status}`)
        if (response.status !== 429 && response.status < 500) break
      } catch (error) {
        if (error instanceof NotPublic || error instanceof NothingPublished) throw error
        failure = error
      }
      if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt))
    }
    throw failure
  }
}

type Reader = ReturnType<typeof apiReader>

type Slice<T> = { items: T[]; totalElements: number }

/** Every row of a list; `sliceOf` finds the page in an answer that carries more than the page (GET /heroes). */
async function readPages<T>(read: Reader, apiPath: string, sliceOf = (body: unknown) => body as Slice<T>) {
  const items: T[] = []
  for (let page = 0; ; page++) {
    const slice = sliceOf(
      await read<unknown>(apiPath, {
        page: String(page),
        size: String(PAGE_SIZE),
      }),
    )
    items.push(...slice.items)
    if (!slice.items.length || items.length >= slice.totalElements) return items
  }
}

async function mapLimit<T, R>(values: readonly T[], limit: number, map: (value: T) => Promise<R>) {
  const results: R[] = []
  let next = 0
  const worker = async () => {
    while (next < values.length) {
      const index = next++
      results[index] = await map(values[index])
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

interface HeroListRow {
  id: string
  code: string
  name: string
  roles?: string[]
  positions?: string[]
  forms?: { id: string; code: string; formKey: string; name: string; roles?: HeroRole[]; positions?: string[] }[]
}

interface HeroDetailResponse {
  media: PublishedHero["media"]
  content: {
    profile?: { title?: string | null; summary?: string | null } | null
    skills?: { skills?: { name?: string | null; description?: string | null }[] } | null
    skins?: { skins?: { name?: string | null }[] } | null
  }
  forms?: (Omit<HeroDetailResponse, "forms"> & { id: string; formKey: string })[]
}

async function readHeroes(read: Reader) {
  const rows = await readPages<HeroListRow>(read, "/heroes", (body) => (body as { page: Slice<HeroListRow> }).page)
  const heroes = await mapLimit(rows, DETAIL_CONCURRENCY, async (row): Promise<PublishedHero | null> => {
    try {
      const detail = await read<HeroDetailResponse>(`/heroes/${encodeURIComponent(row.id)}`)
      // A hero that holds forms is read form by form; the list names each published form in order (ADR-024).
      const forms = (row.forms ?? []).flatMap((form) => {
        const formDetail = detail.forms?.find((candidate) => candidate.id === form.id)
        return formDetail
          ? [
              {
                ...form,
                roles: form.roles ?? [],
                summary: formDetail.content.profile?.summary,
                media: formDetail.media,
                skills: formDetail.content.skills?.skills ?? [],
                skins: formDetail.content.skins?.skins ?? [],
              },
            ]
          : []
      })
      return {
        ...row,
        forms: undefined,
        title: detail.content.profile?.title,
        summary: detail.content.profile?.summary,
        media: detail.media,
        skills: detail.content.skills?.skills ?? [],
        skins: detail.content.skins?.skins ?? [],
        ...(forms.length ? { forms } : {}),
      }
    } catch (error) {
      // A hero withdrawn between the two requests simply has no page.
      if (error instanceof NotPublic) return null
      throw error
    }
  })
  return heroes.filter((hero) => hero !== null)
}

async function readSkins(read: Reader) {
  const items: PublishedCatalog["skins"][number][] = []
  for (let page = 0; ; page++) {
    const { page: slice } = await read<{
      page: { items: PublishedCatalog["skins"][number][]; totalElements: number }
    }>("/skins", { page: String(page), size: "60" })
    items.push(...slice.items)
    if (!slice.items.length || items.length >= slice.totalElements) return items
  }
}

async function readTerms(read: Reader) {
  const { settings } = await read<{
    settings: {
      fallbackLocale?: string
      entities: {
        id: string
        kind: string
        translations?: { locale: string; name: string; description?: string | null }[]
      }[]
    }
  }>("/reference-catalog")
  return settings.entities.flatMap((entity) => {
    const text = entity.kind === "term" ? warehouseText(entity.translations ?? [], STATIC_SCOPE.locale) : undefined
    return text ? [{ id: entity.id, name: text.name, description: text.description }] : []
  })
}

export async function readPublishedCatalog(apiBase: string, retryDelayMs = 1000): Promise<PublishedCatalog> {
  const read = apiReader(apiBase, retryDelayMs)
  const [heroes, skins, terms, patches, items, enchantments, arcana, spells, archived, modes] = await Promise.all([
    readHeroes(read),
    readSkins(read),
    readTerms(read),
    readPages<PublishedPatch>(read, "/patches"),
    readPages<PublishedEntry>(read, "/items"),
    readPages<PublishedEntry>(read, "/enchantments"),
    readPages<PublishedEntry>(read, "/arcana"),
    readPages<PublishedEntry>(read, "/spells"),
    readPages<PublishedEntry>(read, "/spells/archived"),
    read<{ items: PublishedMode[] }>("/game-modes", {}, false).then((answer) => answer.items),
  ])
  // Retired talents stay readable in the wiki, so they keep their pages too.
  const currentSpells = new Set(spells.map((entry) => entry.id))
  return {
    heroes,
    skins,
    terms,
    patches,
    modes,
    warehouse: {
      items,
      enchantments,
      arcana,
      spells: [...spells, ...archived.filter((entry) => !currentSpells.has(entry.id))],
    },
  }
}

function staticFile(distDir: string, page: StaticPage) {
  const relative = page.path === "/" ? "index.html" : path.join(decodeURI(page.path.slice(1)), "index.html")
  const file = path.resolve(distDir, relative)
  // Codes come from the API; a malformed one must not be able to write outside the site.
  if (!file.startsWith(path.resolve(distDir) + path.sep)) throw new Error(`Refusing to write ${page.path}.`)
  return file
}

export interface PrerenderOptions {
  distDir: string
  siteUrl: string
  apiBase: string
  retryDelayMs?: number
}

export async function prerender({ distDir, siteUrl, apiBase, retryDelayMs }: PrerenderOptions) {
  const template = await readFile(path.join(distDir, "200.html"), "utf8").catch(() => {
    throw new Error(`${distDir} has no 200.html. Run the Wiki build first.`)
  })

  // Everything is prepared before anything is touched, so a failing API leaves the previous pages online.
  const catalog = await readPublishedCatalog(apiBase, retryDelayMs)
  if (!catalog.heroes.length) throw new NothingPublished("The public API returned no published heroes.")
  const pages = buildStaticPages(catalog)
  const files = pages.map((page) => ({
    file: staticFile(distDir, page),
    html: renderStaticPage(template, page, siteUrl),
  }))
  const sitemap = renderSitemap(pages, siteUrl)
  const robots = renderRobots(siteUrl)

  await Promise.all(
    OWNED_DIRECTORIES.map((directory) => rm(path.join(distDir, directory), { recursive: true, force: true })),
  )
  await mapLimit(files, 32, async ({ file, html }) => {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, html)
  })
  await writeFile(path.join(distDir, "sitemap.xml"), sitemap)
  await writeFile(path.join(distDir, "robots.txt"), robots)

  return { pages, catalog }
}

async function main() {
  const { loadEnv } = await import("vite")
  const appRoot = fileURLToPath(new URL("..", import.meta.url))
  const env = loadEnv("production", appRoot, "")
  const siteUrl = parseSiteUrl(env.VITE_WIKI_URL)
  if (!siteUrl)
    throw new Error("VITE_WIKI_URL must be the public origin of the Wiki, for example https://wiki.example.com.")

  const apiBase = env.WIKI_API_TARGET || "http://localhost:8080"
  const { pages, catalog } = await prerender({ distDir: path.join(appRoot, "dist"), siteUrl, apiBase })

  for (const repeated of repeatedMeta(pages)) console.warn(`Repeated ${repeated}`)
  console.log(
    `Prerendered ${pages.length} pages for ${siteUrl} from ${apiBase}: ${catalog.heroes.length} heroes, ` +
      `${pages.filter((page) => page.listed).length} sitemap URLs.`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
