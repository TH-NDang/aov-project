/**
 * One run of the Wiki's prerender job in the Docker stack. It renders into this image's own dist first and replaces what
 * the proxy serves only after that worked, so a failing API leaves the site as it is. See ADR-022, section "Vận hành".
 */
import { copyFile, mkdir, readdir, readFile, rename, rm, rmdir, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSiteUrl } from "../src/lib/seo/head-tags.ts"
import { NothingPublished, prerender } from "./prerender.mts"

const COPY_CONCURRENCY = 32

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  )

async function filesIn(root: string, folder = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, folder), { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const relative = path.join(folder, entry.name)
      return entry.isDirectory() ? filesIn(root, relative) : Promise.resolve([relative])
    }),
  )
  return nested.flat()
}

async function sameFile(left: string, right: string) {
  const [a, b] = await Promise.all([stat(left), stat(right).catch(() => null)])
  if (!b || a.size !== b.size) return false
  const [leftBytes, rightBytes] = await Promise.all([readFile(left), readFile(right)])
  return leftBytes.equals(rightBytes)
}

async function removeEmptyFolders(root: string, folder = ""): Promise<void> {
  const entries = await readdir(path.join(root, folder), { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => removeEmptyFolders(root, path.join(folder, entry.name))),
  )
  if (folder && !(await readdir(path.join(root, folder))).length) await rmdir(path.join(root, folder))
}

/**
 * Makes `siteDir` hold exactly what `distDir` holds while the proxy keeps serving it. New files arrive before old ones
 * leave and each one is swapped by a rename, so any page a reader gets still finds the bundle it refers to.
 */
export async function publishSite(distDir: string, siteDir: string) {
  const wanted = await filesIn(distDir)
  const queue = [...wanted]
  await mkdir(siteDir, { recursive: true })
  await Promise.all(
    Array.from({ length: COPY_CONCURRENCY }, async () => {
      for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
        const target = path.join(siteDir, file)
        if (await sameFile(path.join(distDir, file), target)) continue
        await mkdir(path.dirname(target), { recursive: true })
        const incoming = `${target}.${process.pid}.incoming`
        await copyFile(path.join(distDir, file), incoming)
        await rename(incoming, target)
      }
    }),
  )

  const kept = new Set(wanted)
  const present = await filesIn(siteDir)
  await Promise.all(present.filter((file) => !kept.has(file)).map((file) => rm(path.join(siteDir, file))))
  await removeEmptyFolders(siteDir)
}

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
