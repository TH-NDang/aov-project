/**
 * The derived manifest a capture collection carries at its root (ADR-030 section 8). The sync tool builds it on the
 * machine that has the review files; Admin reads it through a presigned link and opens the pictures by SHA-256, so the
 * evidence screens work in a built Admin without any local folder. Pure: no file or network access.
 */
import {
  sourceArchiveOf,
  type CaptureCoverage,
  type CaptureImage,
  type CaptureManifest,
  type HeroSourceCoverage,
} from "./patch-capture-manifest.ts"
import { heroShopImages, type ShopCaptureImage, type ShopManifest } from "./shop-capture-manifest.ts"
import { captureSetOf as buildSetOf, type BuildCaptureSet, type BuildManifest } from "./build-captures.ts"
import { captureSetOf as rankingSetOf, type RankingCaptureSet, type RankingManifest } from "./ranking-captures.ts"

/** Where the derived manifest sits in every capture collection. */
export const CAPTURE_SET_FILE = "capture-manifest.json"

/** The collection categories that carry a derived manifest. */
export const CAPTURE_KINDS = ["HERO_CAPTURE", "SHOP_CAPTURE", "BUILD_CAPTURE", "RANKING_CAPTURE"] as const
export type CaptureKind = (typeof CAPTURE_KINDS)[number]

/** A patch picture as Admin opens it: by its bytes, with the place it has in the collection. */
export interface PatchSetImage extends CaptureImage {
  sha256: string
  path: string
}

export interface PatchCaptureSet {
  kind: "HERO_CAPTURE"
  patchCode: string
  archive: string
  coverage: CaptureCoverage
  sources: HeroSourceCoverage[]
  heroes: Record<string, { heroCode: string; sourceFolder: string; images: PatchSetImage[] }>
}

export interface ShopCaptureSet {
  kind: "SHOP_CAPTURE"
  capturedOn: string
  region: string
  heroes: Record<string, ShopCaptureImage[]>
}

export interface BuildCaptureSetFile {
  kind: "BUILD_CAPTURE"
  set: BuildCaptureSet
  /** The import body, as the screenshot reader wrote it. */
  capture: BuildManifest["capture"]
}

export interface RankingCaptureSetFile {
  kind: "RANKING_CAPTURE"
  set: RankingCaptureSet
  /** The import body, as the screenshot reader wrote it. */
  snapshot: RankingManifest["snapshot"]
}

export type CaptureSetFile = PatchCaptureSet | ShopCaptureSet | BuildCaptureSetFile | RankingCaptureSetFile

/** A picture the manifest points at and the path push gave it, so publishing can check that it is really there. */
export interface ExpectedPicture {
  sha256: string
  path: string
}

const withoutZip = (name: string) => name.replace(/\.zip$/i, "")
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1)

/** Push stores a ZIP's entries under `raw/<archive>/<inner archive>/<member>`, the archive names without ".zip". */
export function patchImagePath(manifest: CaptureManifest, image: Pick<CaptureImage, "archive" | "member">) {
  const outer = sourceArchiveOf(manifest, image.archive).archive
  return `raw/${withoutZip(baseName(outer))}/${withoutZip(image.archive)}/${image.member}`.normalize("NFC")
}

export function patchCaptureSet(manifest: CaptureManifest): PatchCaptureSet {
  const heroes: PatchCaptureSet["heroes"] = {}
  for (const [code, hero] of manifest.heroes)
    heroes[code] = {
      heroCode: hero.heroCode,
      sourceFolder: hero.sourceFolder,
      images: hero.images.map((image) => ({ ...image, sha256: image.id, path: patchImagePath(manifest, image) })),
    }
  return {
    kind: "HERO_CAPTURE",
    patchCode: manifest.patchCode,
    archive: manifest.archive,
    coverage: manifest.coverage,
    sources: manifest.sources,
    heroes,
  }
}

/** Every picture of the set, also those no hero claims, since the coverage lists them too. */
export const patchPictures = (manifest: CaptureManifest): ExpectedPicture[] =>
  [...manifest.images.values()].map((image) => ({ sha256: image.id, path: patchImagePath(manifest, image) }))

export function shopCaptureSet(manifest: ShopManifest): ShopCaptureSet {
  return {
    kind: "SHOP_CAPTURE",
    capturedOn: manifest.capturedOn,
    region: manifest.region,
    heroes: Object.fromEntries(Object.keys(manifest.heroes).map((code) => [code, heroShopImages(manifest, code)])),
  }
}

export const shopPictures = (manifest: ShopManifest): ExpectedPicture[] =>
  Object.entries(manifest.images).map(([sha256, image]) => ({
    sha256,
    path: `raw/shop/${manifest.capturedOn}/${image.path}`.normalize("NFC"),
  }))

export const buildCaptureSet = (manifest: BuildManifest): BuildCaptureSetFile => ({
  kind: "BUILD_CAPTURE",
  set: buildSetOf(manifest),
  capture: manifest.capture,
})

export const buildPictures = (manifest: BuildManifest): ExpectedPicture[] =>
  Object.entries(manifest.images).map(([sha256, image]) => ({
    sha256,
    path: `raw/builds/${manifest.capturedOn}/${image.path}`.normalize("NFC"),
  }))

export const rankingCaptureSet = (manifest: RankingManifest): RankingCaptureSetFile => ({
  kind: "RANKING_CAPTURE",
  set: rankingSetOf(manifest),
  snapshot: manifest.snapshot,
})

export const rankingPictures = (manifest: RankingManifest): ExpectedPicture[] =>
  Object.entries(manifest.images).map(([sha256, image]) => ({
    sha256,
    path: `raw/ranking/${manifest.capturedOn}/${image.path}`.normalize("NFC"),
  }))

/** Pictures the collection does not hold at the path push gives them, with those bytes. */
export function missingPictures(
  pictures: readonly ExpectedPicture[],
  files: readonly { path: string; sha256: string }[],
) {
  const stored = new Map(files.map((file) => [file.path, file.sha256]))
  return pictures.filter((picture) => stored.get(picture.path) !== picture.sha256)
}
