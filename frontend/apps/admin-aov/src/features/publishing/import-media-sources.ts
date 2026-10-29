import { buildResourceMediaSources, resourceSourceFiles } from "@aov/ui/lib/resource-media-sources"

export async function importMediaSources(files: Map<string, File>, base: string, localResources: boolean) {
  const documents: Record<string, unknown> = {}
  await Promise.all(
    resourceSourceFiles.map(async (name) => {
      const path = `${base ? `${base}/` : ""}data/${name}`
      const file = files.get(path) ?? files.get(`data/${name}`)
      try {
        if (file) documents[name] = JSON.parse(await file.text())
        else if (localResources) {
          const response = await fetch(`/__resources/data/${name}`, { credentials: "omit", redirect: "error" })
          if (response.ok && response.headers.get("content-type")?.includes("json"))
            documents[name] = await response.json()
        }
      } catch {
        // Missing metadata remains explicitly unverified; it must never prevent reading the original image.
      }
    }),
  )
  return buildResourceMediaSources(documents)
}
