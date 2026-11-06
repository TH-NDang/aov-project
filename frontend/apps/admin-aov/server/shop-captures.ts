import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { join } from "node:path"
import type { Plugin } from "vite"
import { findResourcesRoot } from "./patch-captures.ts"
import { heroShopImages, type ShopManifest } from "./shop-capture-manifest.ts"

const HERO_CODE = /^[a-z0-9][a-z0-9-]{0,63}$/
const IMAGE_ID = /^[0-9a-f]{64}$/

export const SHOP_RAW_FOLDER = ["raw", "shop"]
export const SHOP_EXTRACTED_FOLDER = ["extracted", "shop"]
export const SHOP_MANIFEST = "shop-manifest.json"

export function createShopCaptureHandler({ start }: { start: string }) {
  const cache = new Map<string, { modified: number; manifest: ShopManifest }>()

  /** Newest first, so a later shop visit leads. A set imported while the server runs is picked up by its file time. */
  const loadManifests = async (root: string) => {
    const folder = join(root, ...SHOP_EXTRACTED_FOLDER)
    if (!existsSync(folder)) return []
    const days = (await readdir(folder, { withFileTypes: true })).filter((entry) => entry.isDirectory())
    const manifests = await Promise.all(
      days.map(async (day) => {
        const path = join(folder, day.name, SHOP_MANIFEST)
        const file = await stat(path).catch(() => null)
        if (!file) return null
        const cached = cache.get(path)
        if (cached?.modified === file.mtimeMs) return cached.manifest
        const manifest = JSON.parse(await readFile(path, "utf8")) as ShopManifest
        cache.set(path, { modified: file.mtimeMs, manifest })
        return manifest
      }),
    )
    return manifests
      .filter((manifest): manifest is ShopManifest => !!manifest)
      .sort((a, b) => b.capturedOn.localeCompare(a.capturedOn))
  }

  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
    res.end(JSON.stringify(value))
  }
  const failed = (res: ServerResponse, status: number, code: string, message: string) =>
    send(res, status, { code, message })

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? "/").split("?")[0]!
    const match = /^\/(?:heroes\/([^/]+)\.json|images\/([^/]+)\.jpg)$/.exec(path)
    if (!match) return next()
    const [, heroCode, imageId] = match
    try {
      if (req.method !== "GET" && req.method !== "HEAD")
        return failed(res, 405, "METHOD_NOT_ALLOWED", "Shop images are read-only.")
      if ((heroCode && !HERO_CODE.test(heroCode)) || (imageId && !IMAGE_ID.test(imageId)))
        return failed(res, 400, "INVALID_REQUEST", "Invalid shop image path.")
      const root = findResourcesRoot(start)
      if (!root) return failed(res, 404, "CAPTURES_UNAVAILABLE", "The resources folder was not found.")
      const manifests = await loadManifests(root)
      if (heroCode)
        return send(res, 200, {
          heroCode,
          images: manifests.flatMap((manifest) => heroShopImages(manifest, heroCode)),
        })
      const owner = manifests.find((manifest) => manifest.images[imageId!])
      if (!owner) return failed(res, 404, "IMAGE_NOT_FOUND", "Image is not in any shop set.")
      const image = owner.images[imageId!]!
      const bytes = await readFile(join(root, ...SHOP_RAW_FOLDER, owner.capturedOn, image.path))
      if (createHash("sha256").update(bytes).digest("hex") !== imageId)
        return failed(res, 502, "IMAGE_HASH_MISMATCH", `${image.fileName} does not match its recorded hash.`)
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": bytes.length,
        // The address is the content hash, so it can never point at different bytes.
        "Cache-Control": "private, max-age=31536000, immutable",
      })
      res.end(req.method === "HEAD" ? undefined : bytes)
    } catch (error) {
      failed(res, 500, "CAPTURE_READ_FAILED", error instanceof Error ? error.message : "Shop image read failed.")
    }
  }
}

/** Serves the shop screenshots that prices and skin acquisition were read from, read-only. Dev and preview only. */
export function shopCaptures(start: string): Plugin {
  const handler = createShopCaptureHandler({ start })
  return {
    name: "aov-shop-captures",
    configureServer(server) {
      server.middlewares.use("/__shop-captures", handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use("/__shop-captures", handler)
    },
  }
}
