import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { buildCaptureManifest, type CaptureDatasetFiles, type CaptureManifest } from "./patch-capture-manifest.ts"

/** `resources/raw` is git-ignored, so a worktree has to reach the checkout that holds it. */
export function findResourcesRoot(start: string, configured = process.env.AOV_RESOURCES_DIR): string | null {
  if (configured) return resolve(configured)
  for (let directory = resolve(start); ; directory = dirname(directory)) {
    if (existsSync(join(directory, "resources", "raw"))) return join(directory, "resources")
    if (dirname(directory) === directory) return null
  }
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T
const readOptionalJson = async <T>(path: string): Promise<T | undefined> =>
  existsSync(path) ? readJson<T>(path) : undefined

/** Joins one patch's extracted set (`resources/extracted/<season>/<patch>`) to its review files. */
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
