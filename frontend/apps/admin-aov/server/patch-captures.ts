import { createHash } from "node:crypto"
import { existsSync, readdirSync } from "node:fs"
import { open, readdir, readFile, stat } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import type { Plugin } from "vite"
import { extractInnerArchive, readZipDirectory, readZipEntry, type ZipEntry } from "./nested-zip.ts"
import { buildCaptureManifest, type CaptureDatasetFiles, type CaptureManifest } from "./patch-capture-manifest.ts"

const PATCH_CODE = /^[a-z0-9][a-z0-9-]{0,63}$/
const HERO_CODE = /^[a-z0-9][a-z0-9-]{0,63}$/
const IMAGE_ID = /^[0-9a-f]{64}$/
const SIGNATURE_TTL_MS = 1000

/** `resources/raw` is git-ignored, so a worktree has to reach the checkout that holds it. */
export function findResourcesRoot(start: string, configured = process.env.AOV_RESOURCES_DIR): string | null {
  if (configured) return resolve(configured)
  for (let directory = resolve(start); ; directory = dirname(directory)) {
    if (existsSync(join(directory, "resources", "raw"))) return join(directory, "resources")
    if (dirname(directory) === directory) return null
  }
}

function findPatchDirectory(root: string, patchCode: string): string | null {
  const extracted = join(root, "extracted")
  if (!existsSync(extracted)) return null
  for (const season of readdirSync(extracted, { withFileTypes: true })) {
    if (!season.isDirectory()) continue
    const directory = join(extracted, season.name, patchCode)
    if (existsSync(join(directory, "source-manifest.json"))) return directory
  }
  return null
}

/** Patches that have an extracted set, so a revision from another patch can still reach the screenshots that exist. */
function listCaptureSets(root: string): string[] {
  const extracted = join(root, "extracted")
  if (!existsSync(extracted)) return []
  return readdirSync(extracted, { withFileTypes: true })
    .filter((season) => season.isDirectory())
    .flatMap((season) =>
      readdirSync(join(extracted, season.name), { withFileTypes: true })
        .filter(
          (patch) =>
            patch.isDirectory() &&
            PATCH_CODE.test(patch.name) &&
            existsSync(join(extracted, season.name, patch.name, "source-manifest.json")),
        )
        .map((patch) => patch.name),
    )
    .sort()
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T
const readOptionalJson = async <T>(path: string): Promise<T | undefined> =>
  existsSync(path) ? readJson<T>(path) : undefined

/** Changes whenever a file the manifest is built from is added, removed or rewritten. */
export async function captureSetSignature(directory: string): Promise<string> {
  const folders = [directory, join(directory, "manual"), join(directory, "evidence")]
  const parts = await Promise.all(
    folders.map(async (folder) => {
      const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
      const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      const stamps = await Promise.all(
        files.map(async (entry) => {
          const info = await stat(join(folder, entry.name)).catch(() => null)
          return info ? `${entry.name}:${info.size}:${info.mtimeMs}` : entry.name
        }),
      )
      return stamps.sort().join("|")
    }),
  )
  return parts.join("\n")
}

export async function loadCaptureManifest(directory: string, patchCode: string): Promise<CaptureManifest> {
  const names = await readdir(directory)
  const reviews = names.filter((name) => /^manual-attributes-\d+\.review\.json$/.test(name)).sort()
  const evidenceNames = (await readdir(join(directory, "evidence"))).filter((name) => name.endsWith(".json")).sort()
  const files: CaptureDatasetFiles = {
    patchCode,
    sourceManifest: await readJson(join(directory, "source-manifest.json")),
    evidence: await Promise.all(
      evidenceNames.map((name) => readJson<CaptureDatasetFiles["evidence"][number]>(join(directory, "evidence", name))),
    ),
    importRows: await readJson(join(directory, "manual", "import-rows.json")),
    attributeSources: await readJson(join(directory, "manual-attribute-sources.json")),
    attributeReviews: await Promise.all(
      reviews.map((name) => readJson<CaptureDatasetFiles["attributeReviews"][number]>(join(directory, name))),
    ),
    sourceGaps: await readJson(join(directory, "manual", "source-gaps.json")),
    observedAttributes: await readOptionalJson(join(directory, "manual", "observed-attributes.json")),
    recaptureRequests: await readOptionalJson(join(directory, "recapture-requests.review.json")),
  }
  return buildCaptureManifest(files)
}

interface HandlerOptions {
  start: string
  cacheRoot?: string
  /** How long one look at the files stands for every request. */
  signatureTtlMs?: number
}

export function createPatchCaptureHandler({ start, cacheRoot, signatureTtlMs = SIGNATURE_TTL_MS }: HandlerOptions) {
  const manifests = new Map<string, { signature: string; manifest: Promise<CaptureManifest> }>()
  const signatures = new Map<string, { at: number; value: Promise<string> }>()
  const extractions = new Map<string, Promise<string>>()
  const directories = new Map<string, Promise<Map<string, ZipEntry>>>()

  // A burst of image requests shares one look at the files.
  const signatureOf = (directory: string) => {
    const cached = signatures.get(directory)
    if (cached && Date.now() - cached.at < signatureTtlMs) return cached.value
    const value = captureSetSignature(directory)
    signatures.set(directory, { at: Date.now(), value })
    return value
  }

  /** Reviews and captures added while the dev server runs are read again on the next request. */
  const manifestFor = async (root: string, patchCode: string) => {
    const directory = findPatchDirectory(root, patchCode)
    if (!directory) return null
    const signature = await signatureOf(directory)
    const cached = manifests.get(patchCode)
    if (cached?.signature === signature) return cached.manifest
    const manifest = loadCaptureManifest(directory, patchCode)
    // A failed read is not remembered: the fix is usually restoring files while the dev server keeps running.
    manifest.catch(() => {
      if (manifests.get(patchCode)?.manifest === manifest) manifests.delete(patchCode)
    })
    manifests.set(patchCode, { signature, manifest })
    return manifest
  }

  const innerArchive = (root: string, manifest: CaptureManifest, archive: string) => {
    const cache = cacheRoot ?? process.env.AOV_CAPTURE_CACHE ?? join(tmpdir(), "aov-patch-captures")
    const target = join(cache, manifest.archiveSha256.slice(0, 16), basename(archive))
    let extraction = extractions.get(target)
    if (!extraction) {
      extraction = (async () => {
        const existing = await stat(target).catch(() => null)
        if (!existing) await extractInnerArchive(join(root, "raw", basename(manifest.archive)), archive, target)
        return target
      })()
      extraction.catch(() => extractions.delete(target))
      extractions.set(target, extraction)
    }
    return extraction
  }

  const readMember = async (path: string, member: string) => {
    const file = await open(path, "r")
    try {
      let directory = directories.get(path)
      if (!directory) {
        directory = readZipDirectory(file)
        directory.catch(() => directories.delete(path))
        directories.set(path, directory)
      }
      const entry = (await directory).get(member)
      if (!entry) throw new Error(`${member} is not in ${basename(path)}.`)
      return await readZipEntry(file, entry)
    } finally {
      await file.close()
    }
  }

  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
    res.end(JSON.stringify(value))
  }
  const failed = (res: ServerResponse, status: number, code: string, message: string) =>
    send(res, status, { code, message })

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? "/").split("?")[0]!
    if (path === "/sets.json" && (req.method === "GET" || req.method === "HEAD")) {
      const root = findResourcesRoot(start)
      return send(res, 200, { patches: root ? listCaptureSets(root) : [] })
    }
    const match = /^\/([^/]+)\/(?:(coverage)\.json|(heroes)\.json|heroes\/([^/]+)\.json|images\/([^/]+)\.png)$/.exec(
      path,
    )
    if (!match) return next()
    const [, patchCode = "", coverage, allHeroes, heroCode, imageId] = match
    try {
      if (req.method !== "GET" && req.method !== "HEAD")
        return failed(res, 405, "METHOD_NOT_ALLOWED", "Capture images are read-only.")
      if (
        !PATCH_CODE.test(patchCode) ||
        (heroCode && !HERO_CODE.test(heroCode)) ||
        (imageId && !IMAGE_ID.test(imageId))
      )
        return failed(res, 400, "INVALID_REQUEST", "Invalid capture path.")
      const root = findResourcesRoot(start)
      if (!root) return failed(res, 404, "CAPTURES_UNAVAILABLE", "The resources folder was not found.")
      const manifest = await manifestFor(root, patchCode)
      if (!manifest) return failed(res, 404, "PATCH_NOT_FOUND", `No capture set for patch ${patchCode}.`)
      if (coverage) return send(res, 200, { patchCode, archive: manifest.archive, ...manifest.coverage })
      if (allHeroes) return send(res, 200, { patchCode, heroes: manifest.sources })
      if (heroCode) {
        const hero = manifest.heroes.get(heroCode)
        if (!hero) return failed(res, 404, "HERO_NOT_FOUND", `No captures for hero ${heroCode}.`)
        return send(res, 200, { patchCode, ...hero })
      }
      const image = manifest.images.get(imageId!)
      if (!image) return failed(res, 404, "IMAGE_NOT_FOUND", "Image is not in this capture set.")
      const bytes = await readMember(await innerArchive(root, manifest, image.archive), image.member)
      if (createHash("sha256").update(bytes).digest("hex") !== image.id)
        return failed(res, 502, "IMAGE_HASH_MISMATCH", `${image.fileName} does not match its recorded hash.`)
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": bytes.length,
        // The address is the content hash, so it can never point at different bytes.
        "Cache-Control": "private, max-age=31536000, immutable",
      })
      res.end(req.method === "HEAD" ? undefined : bytes)
    } catch (error) {
      failed(res, 500, "CAPTURE_READ_FAILED", error instanceof Error ? error.message : "Capture read failed.")
    }
  }
}

/** Serves one patch's original screenshots out of `resources/raw`, read-only. Dev and preview only. */
export function patchCaptures(start: string): Plugin {
  const handler = createPatchCaptureHandler({ start })
  return {
    name: "aov-patch-captures",
    configureServer(server) {
      server.middlewares.use("/__patch-captures", handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use("/__patch-captures", handler)
    },
  }
}
