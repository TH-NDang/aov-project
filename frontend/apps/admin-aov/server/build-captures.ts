/** Where the build screenshot reader keeps one capture day under `resources/`: screenshots, then the import body. */
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
