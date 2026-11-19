/**
 * Replaces a live static site with a new build while the proxy keeps serving it (ADR-022; ADR-021, addendum of
 * 18/11/2026). The Wiki's prerender job and the job that publishes Stream and Admin both go through here.
 */
import { copyFile, mkdir, readdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const COPY_CONCURRENCY = 32

/** Lists the bundle of the live release, which stays one more release; it belongs to no build. */
export const PUBLISHED_BUNDLE = ".published-bundle.json"

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

const toPosix = (file: string) => file.split(path.sep).join("/")
const isBundle = (file: string) => toPosix(file).startsWith("assets/")

/** The bundle files of the live release. A site published before the list existed keeps every bundle file once. */
async function liveBundle(siteDir: string, present: string[]): Promise<Set<string>> {
  try {
    const listed: unknown = JSON.parse(await readFile(path.join(siteDir, PUBLISHED_BUNDLE), "utf8"))
    if (Array.isArray(listed)) {
      return new Set(
        listed.filter((file): file is string => typeof file === "string").map((file) => path.normalize(file)),
      )
    }
  } catch {
    /* No list yet: fall through. */
  }
  return new Set(present.filter(isBundle))
}

/** Bundle files are named by their content, so a new build of different code brings different names. */
function sameRelease(built: string[], live: Set<string>) {
  const bundle = built.filter(isBundle).map((file) => path.normalize(file))
  return bundle.length === live.size && bundle.every((file) => live.has(file))
}

/** Whether `siteDir` already serves the bundle of `distDir`: the same release, where only pages would change. */
export async function servesBundleOf(distDir: string, siteDir: string) {
  const present = await filesIn(siteDir).catch(() => [])
  const live = await liveBundle(
    siteDir,
    present.filter((file) => file !== PUBLISHED_BUNDLE),
  )

  return sameRelease(await filesIn(distDir), live)
}

/**
 * Makes `siteDir` hold what `distDir` holds while the proxy keeps serving it. New files arrive before old ones leave
 * and each one is swapped by a rename, so any page a reader gets still finds the bundle it refers to. The bundle of
 * the release being replaced stays until the next release, so a tab that opened it can still load a chunk later.
 * Publishing the live release again, with new pages only, is not a release: what it kept from the one before stays.
 */
export async function publishSite(distDir: string, siteDir: string) {
  const wanted = await filesIn(distDir)
  await mkdir(siteDir, { recursive: true })
  const before = (await filesIn(siteDir)).filter((file) => file !== PUBLISHED_BUNDLE)
  const live = await liveBundle(siteDir, before)
  const previousBundle = sameRelease(wanted, live) ? new Set(before.filter(isBundle)) : live

  const queue = [...wanted]
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

  const kept = new Set([...wanted, ...previousBundle, PUBLISHED_BUNDLE])
  const present = await filesIn(siteDir)
  await Promise.all(present.filter((file) => !kept.has(file)).map((file) => rm(path.join(siteDir, file))))
  await removeEmptyFolders(siteDir)

  const list = path.join(siteDir, PUBLISHED_BUNDLE)
  await writeFile(`${list}.${process.pid}.incoming`, JSON.stringify(wanted.filter(isBundle).map(toPosix)))
  await rename(`${list}.${process.pid}.incoming`, list)
}
