/**
 * One run of the Wiki's prerender job in the Docker stack. It renders into this image's own dist first and replaces what
 * the proxy serves only after that worked, so a failing API leaves the site as it is. See ADR-022, section "Vận hành".
 */
import { stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSiteUrl } from "../src/lib/seo/head-tags.ts"
import { NothingPublished, prerender } from "./prerender.mts"
import { publishSite } from "./publish-site.mts"

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  )

export interface PrerenderJobOptions {
  distDir: string
  siteDir: string
  siteUrl: string
  apiBase: string
  retryDelayMs?: number
}

export async function runPrerenderJob({ distDir, siteDir, ...source }: PrerenderJobOptions) {
  // The first run has nothing to protect, and the site has to work even if the API does not answer yet.
  if (!(await exists(path.join(siteDir, "200.html")))) await publishSite(distDir, siteDir)

  try {
    const { pages } = await prerender({ distDir, ...source })
    await publishSite(distDir, siteDir)
    return pages.length
  } catch (error) {
    // A new system has nothing published yet. On a site that had heroes, the same answer is a fault to report.
    if (!(error instanceof NothingPublished) || (await exists(path.join(siteDir, "hero")))) throw error
    await publishSite(distDir, siteDir)
    return 0
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
    console.error("The site keeps the pages it had.")
    process.exitCode = 1
  })
}
