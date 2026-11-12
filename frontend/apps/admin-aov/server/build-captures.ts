import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { join } from "node:path"
import type { Plugin } from "vite"
import { findResourcesRoot } from "./patch-captures.ts"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const IMAGE_ID = /^[0-9a-f]{64}$/

export const BUILD_RAW_FOLDER = ["raw", "builds"]
export const BUILD_EXTRACTED_FOLDER = ["extracted", "builds"]
export const BUILD_MANIFEST = "build-manifest.json"

/** What the screenshot reader leaves next to the results: the import body and where each screenshot lives. */
export interface BuildManifest {
  capturedOn: string
  capture: {
    code: string
    capturedAt: string
    sourceTimeZone: string
    sourceLabel: string
    regionCode: string
    images: unknown[]
    heroes: { builds: { needsReview: boolean }[] }[]
  }
  /** Screenshot paths by SHA-256, relative to `resources/raw/builds/<day>/`. */
  images: Record<string, { path: string }>
}

/** A capture set as offered for import. */
export interface BuildCaptureSet {
  capturedOn: string
  code: string
  capturedAt: string
  sourceTimeZone: string
  sourceLabel: string
  regionCode: string
  heroes: number
  builds: number
  needsReview: number
}

export function captureSetOf(manifest: BuildManifest): BuildCaptureSet {
  const builds = manifest.capture.heroes.flatMap((hero) => hero.builds)
  return {
    capturedOn: manifest.capturedOn,
    code: manifest.capture.code,
    capturedAt: manifest.capture.capturedAt,
    sourceTimeZone: manifest.capture.sourceTimeZone,
    sourceLabel: manifest.capture.sourceLabel,
    regionCode: manifest.capture.regionCode,
    heroes: manifest.capture.heroes.length,
    builds: builds.length,
    needsReview: builds.filter((build) => build.needsReview).length,
  }
}

export function createBuildCaptureHandler({ start }: { start: string }) {
  const cache = new Map<string, { modified: number; manifest: BuildManifest }>()

  /** Newest first. A set added while the server runs is picked up by its file time. */
  const loadManifests = async (root: string) => {
    const folder = join(root, ...BUILD_EXTRACTED_FOLDER)
    if (!existsSync(folder)) return []
    const days = (await readdir(folder, { withFileTypes: true })).filter(
      (entry) => entry.isDirectory() && DAY.test(entry.name),
    )
    const manifests = await Promise.all(
      days.map(async (day) => {
        const path = join(folder, day.name, BUILD_MANIFEST)
        const file = await stat(path).catch(() => null)
        if (!file) return null
        const cached = cache.get(path)
        if (cached?.modified === file.mtimeMs) return cached.manifest
        const manifest = JSON.parse(await readFile(path, "utf8")) as BuildManifest
        cache.set(path, { modified: file.mtimeMs, manifest })
        return manifest
      }),
    )
    return manifests
      .filter((manifest): manifest is BuildManifest => !!manifest && DAY.test(manifest.capturedOn))
      .sort((a, b) => b.capture.capturedAt.localeCompare(a.capture.capturedAt))
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
        return failed(res, 405, "METHOD_NOT_ALLOWED", "Build captures are read-only.")
      if ((day && !DAY.test(day)) || (imageId && !IMAGE_ID.test(imageId)))
        return failed(res, 400, "INVALID_REQUEST", "Invalid build capture path.")
      const root = findResourcesRoot(start)
      if (!root) return failed(res, 404, "CAPTURES_UNAVAILABLE", "The resources folder was not found.")
      const manifests = await loadManifests(root)
      if (list) return send(res, 200, { sets: manifests.map(captureSetOf) })
      if (day) {
        const manifest = manifests.find((entry) => entry.capturedOn === day)
        if (!manifest) return failed(res, 404, "SET_NOT_FOUND", "No build capture set for this day.")
        return send(res, 200, manifest.capture)
      }

      const owner = manifests.find((manifest) => manifest.images[imageId!])
      if (!owner) return failed(res, 404, "IMAGE_NOT_FOUND", "Image is not in any build capture set.")
      const image = owner.images[imageId!]!
      const bytes = await readFile(join(root, ...BUILD_RAW_FOLDER, owner.capturedOn, ...image.path.split("/")))
      if (createHash("sha256").update(bytes).digest("hex") !== imageId)
        return failed(res, 502, "IMAGE_HASH_MISMATCH", `${image.path} does not match its recorded hash.`)
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": bytes.length,
        // The address is the content hash, so it can never point at different bytes.
        "Cache-Control": "private, max-age=31536000, immutable",
      })
      res.end(req.method === "HEAD" ? undefined : bytes)
    } catch (error) {
      failed(res, 500, "CAPTURE_READ_FAILED", error instanceof Error ? error.message : "Build capture read failed.")
    }
  }
}

/** Serves the build screenshots and the sets ready to import (ADR-026). Dev and preview only. */
export function buildCaptures(start: string): Plugin {
  const handler = createBuildCaptureHandler({ start })
  return {
    name: "aov-build-captures",
    configureServer(server) {
      server.middlewares.use("/__build-captures", handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use("/__build-captures", handler)
    },
  }
}
