import { validateRichTextSettings, type RichTextSettings } from "@aov/ui/lib/entity-rich-text"
import { storageApi } from "../storage/storage-api"
import type { StorageTable } from "../storage/storage-model"
import { starterGlossary } from "./starter-glossary"

export const defaultSettings: RichTextSettings = {
  schemaVersion: 1,
  autoRecognize: true,
  fallbackLocale: "vi-VN",
  entities: starterGlossary,
}
const tableName = "AOV rich text settings v1"
export async function loadSettings() {
  const tables = await storageApi.list()
  const descriptor = tables.find((table) => table.name === tableName && !table.archived)
  const table = descriptor ? await storageApi.get(descriptor.id) : null
  return { table, settings: table?.rows.length ? validateRichTextSettings(table.rows[0]?.settings) : defaultSettings }
}
export async function saveSettings(settings: RichTextSettings, table: StorageTable | null) {
  const validated = validateRichTextSettings(settings)
  const target = table ?? (await storageApi.create(tableName))
  return storageApi.save({
    ...target,
    columns: ["id", "settings"],
    idColumn: "id",
    rows: [{ id: "settings", settings: validated }],
  })
}
