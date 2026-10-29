import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildResourceMediaSources, resourceSourceFiles } from "../../frontend/packages/ui/src/lib/resource-media-sources.ts"

const root = resolve(fileURLToPath(new URL("../../resources/Lien-Quan-v3", import.meta.url)))
const documents = {}
for (const name of resourceSourceFiles) documents[name] = JSON.parse(await readFile(resolve(root, "data", name), "utf8"))
process.stdout.write(JSON.stringify(buildResourceMediaSources(documents)))
