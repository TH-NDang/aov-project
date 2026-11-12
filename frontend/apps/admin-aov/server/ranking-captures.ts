import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { join } from "node:path"
import type { Plugin } from "vite"
import { findResourcesRoot } from "./patch-captures.ts"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const IMAGE_ID = /^[0-9a-f]{64}$/

export const RANKING_RAW_FOLDER = ["raw", "ranking"]
export const RANKING_EXTRACTED_FOLDER = ["extracted", "ranking"]
export const RANKING_MANIFEST = "ranking-manifest.json"

/** What the screenshot reader leaves next to the results: the import body and where each screenshot lives. */
export interface RankingManifest {
  capturedOn: string
  snapshot: {
    code: string
    capturedAt: string
    sourceTimeZone: string
    modeLabel: string
    regionCode: string
    images: unknown[]
    heroes: { values: { needsReview: boolean }[] }[]
  }
  images: Record<string, { path: string; fileName: string; width: number; height: number }>
}

/** A capture set as offered for import. */
export interface RankingCaptureSet {
  capturedOn: string
  code: string
  capturedAt: string
  sourceTimeZone: string
  modeLabel: string
  regionCode: string
  heroes: number
  values: number
  needsReview: number
  images: number
}

export function captureSetOf(manifest: RankingManifest): RankingCaptureSet {
  const values = manifest.snapshot.heroes.flatMap((hero) => hero.values)
  return {
    capturedOn: manifest.capturedOn,
    code: manifest.snapshot.code,
    capturedAt: manifest.snapshot.capturedAt,
    sourceTimeZone: manifest.snapshot.sourceTimeZone,
    modeLabel: manifest.snapshot.modeLabel,
    regionCode: manifest.snapshot.regionCode,
    heroes: manifest.snapshot.heroes.length,
    values: values.length,
    needsReview: values.filter((value) => value.needsReview).length,
    images: manifest.snapshot.images.length,
  }
}

export function createRankingCaptureHandler({ start }: { start: string }) {
  const cache = new Map<string, { modified: number; manifest: RankingManifest }>()

  /** Newest first. A set added while the server runs is picked up by its file time. */
  const loadManifests = async (root: string) => {
    const folder = join(root, ...RANKING_EXTRACTED_FOLDER)
    if (!existsSync(folder)) return []
    const days = (await readdir(folder, { withFileTypes: true })).filter(
      (entry) => entry.isDirectory() && DAY.test(entry.name),
    )
    const manifests = await Promise.all(
      days.map(async (day) => {
        const path = join(folder, day.name, RANKING_MANIFEST)
        const file = await stat(path).catch(() => null)
        if (!file) return null
        const cached = cache.get(path)
        if (cached?.modified === file.mtimeMs) return cached.manifest
        const manifest = JSON.parse(await readFile(path, "utf8")) as RankingManifest
        cache.set(path, { modified: file.mtimeMs, manifest })
        return manifest
      }),
    )
    return manifests
      .filter((manifest): manifest is RankingManifest => !!manifest && DAY.test(manifest.capturedOn))
      .sort((a, b) => b.snapshot.capturedAt.localeCompare(a.snapshot.capturedAt))
  }

  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
    res.end(JSON.stringify(value))
  }
  const failed = (res: ServerResponse, status: number, code: string, message: string) =>
    send(res, status, { code, message })

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? "/").split("?")[0]!
    const match = /^\/(?:(sets)\.json|sets\/([^/]+)\.json|images\/([^/]+)\.png)$/.exec(path)
    if (!match) return next()
    const [, list, day, imageId] = match
    try {
      if (req.method !== "GET" && req.method !== "HEAD")
        return failed(res, 405, "METHOD_NOT_ALLOWED", "Ranking captures are read-only.")
      if ((day && !DAY.test(day)) || (imageId && !IMAGE_ID.test(imageId)))
        return failed(res, 400, "INVALID_REQUEST", "Invalid ranking capture path.")
      const root = findResourcesRoot(start)
      if (!root) return failed(res, 404, "CAPTURES_UNAVAILABLE", "The resources folder was not found.")
      const manifests = await loadManifests(root)
      if (list) return send(res, 200, { sets: manifests.map(captureSetOf) })
      if (day) {
        const manifest = manifests.find((entry) => entry.capturedOn === day)
        if (!manifest) return failed(res, 404, "SET_NOT_FOUND", "No ranking capture set for this day.")
        return send(res, 200, manifest.snapshot)
      }

      const owner = manifests.find((manifest) => manifest.images[imageId!])
      if (!owner) return failed(res, 404, "IMAGE_NOT_FOUND", "Image is not in any ranking capture set.")
      const image = owner.images[imageId!]!
      const bytes = await readFile(join(root, ...RANKING_RAW_FOLDER, owner.capturedOn, ...image.path.split("/")))
      if (createHash("sha256").update(bytes).digest("hex") !== imageId)
        return failed(res, 502, "IMAGE_HASH_MISMATCH", `${image.fileName} does not match its recorded hash.`)
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": bytes.length,
        // The address is the content hash, so it can never point at different bytes.
        "Cache-Control": "private, max-age=31536000, immutable",
      })
      res.end(req.method === "HEAD" ? undefined : bytes)
    } catch (error) {
      failed(res, 500, "CAPTURE_READ_FAILED", error instanceof Error ? error.message : "Ranking capture read failed.")
    }
  }
}

/** Serves the ranking screenshots values were read from, and the sets ready to import. Dev and preview only. */
export function rankingCaptures(start: string): Plugin {
  const handler = createRankingCaptureHandler({ start })
  return {
    name: "aov-ranking-captures",
    configureServer(server) {
      server.middlewares.use("/__ranking-captures", handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use("/__ranking-captures", handler)
    },
  }
}
