import { buildResourceMediaSources, resourceSourceFiles } from "@aov/ui/lib/resource-media-sources"

/** Credit metadata that travels with an imported folder or ZIP, in its `data/` folder. */
export async function importMediaSources(files: Map<string, File>, base: string) {
  const documents: Record<string, unknown> = {}
  await Promise.all(
    resourceSourceFiles.map(async (name) => {
      const path = `${base ? `${base}/` : ""}data/${name}`
      const file = files.get(path) ?? files.get(`data/${name}`)
      try {
        if (file) documents[name] = JSON.parse(await file.text())
      } catch {
        // Missing metadata remains explicitly unverified; it must never prevent reading the original image.
      }
    }),
  )
  return buildResourceMediaSources(documents)
}
