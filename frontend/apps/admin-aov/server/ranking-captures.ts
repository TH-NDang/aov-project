/** Where the ranking screenshot reader keeps one capture day under `resources/`: screenshots, then the import body. */
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
