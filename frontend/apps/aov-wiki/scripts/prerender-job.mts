/**
 * One run of the Wiki's prerender job in the Docker stack. It renders into this image's own dist first and replaces what
 * the proxy serves only after that worked, so a failing API leaves the site as it is. A new release is the exception:
 * it goes out even without pages, because the backends it was built for are already serving. See ADR-022, its
 * operations section and its addendum of 19/11/2026.
 */
import { stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSiteUrl } from "../src/lib/seo/site-url.ts"
import { publishSite, servesBundleOf } from "./publish-site.mts"

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  )

type Renderer = typeof import("./prerender.mts")

/**
 * The renderer is loaded inside the job's error handling, so a fault in its code or a module missing from the image
 * still lets a new release out. Only this file, publish-site.mts and site-url.ts must load for that; the source
 * rules in lint/ keep packages out of them.
 */
const loadPrerender = (): Promise<Renderer> => import("./prerender.mts")

/** Prerendering failed on a new release, which went out without prerendered pages so that its bundle meets its API. */
export class ReleasedWithoutPages extends Error {}

export interface PrerenderJobOptions {
  distDir: string
  siteDir: string
  siteUrl: string
  apiBase: string
  retryDelayMs?: number
  loadRenderer?: () => Promise<Renderer>
}

export async function runPrerenderJob({
  distDir,
  siteDir,
  loadRenderer = loadPrerender,
  ...source
}: PrerenderJobOptions) {
  // The first run has nothing to protect, and the site has to work even if the API does not answer yet.
  if (!(await exists(path.join(siteDir, "200.html")))) await publishSite(distDir, siteDir)
  const newRelease = !(await servesBundleOf(distDir, siteDir))

  let renderer: Renderer | undefined
  try {
    renderer = await loadRenderer()
    const { pages } = await renderer.prerender({ distDir, ...source })
    await publishSite(distDir, siteDir)
    return pages.length
  } catch (error) {
    // A new system has nothing published yet. On a site that had heroes, the same answer is a fault to report.
    const nothingPublished = renderer !== undefined && error instanceof renderer.NothingPublished
    if (nothingPublished && !(await exists(path.join(siteDir, "hero")))) {
      await publishSite(distDir, siteDir)
      return 0
    }
    if (!newRelease) throw error

    // The old bundle may not read what the new backends answer, and its pages load that bundle: both go.
    await publishSite(distDir, siteDir)
    throw new ReleasedWithoutPages(
      `${error instanceof Error ? error.message : String(error)}\nThe new bundle went out without prerendered pages, ` +
        "so the Wiki matches the API. Pages come back with the next run that works.",
      { cause: error },
    )
  }
}

async function main() {
  const siteUrl = parseSiteUrl(process.env.VITE_WIKI_URL)
  const apiBase = process.env.WIKI_API_TARGET
  const siteDir = process.env.WIKI_SITE_DIR
  if (!siteUrl || !apiBase || !siteDir) throw new Error("Set VITE_WIKI_URL, WIKI_API_TARGET and WIKI_SITE_DIR.")

  const distDir = fileURLToPath(new URL("../dist", import.meta.url))
  const pages = await runPrerenderJob({ distDir, siteDir, siteUrl, apiBase })

  console.log(
    pages
      ? `Published ${pages} prerendered pages for ${siteUrl}.`
      : "Nothing is published yet, so the site went out without prerendered pages.",
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    if (!(error instanceof ReleasedWithoutPages)) console.error("The site keeps the pages it had.")
    process.exitCode = 1
  })
}
