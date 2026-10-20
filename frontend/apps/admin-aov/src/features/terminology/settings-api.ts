import { validateRichTextSettings, type RichTextSettings } from "@aov/ui/lib/entity-rich-text"
import { storageApi } from "../storage/storage-api"
import { starterGlossary } from "./starter-glossary"
import { backendRequest } from "@/app/auth/session"
import { validateReferenceDocument, type ReferenceSettingsDocument } from "@aov/ui/lib/reference-settings"

export const defaultSettings: RichTextSettings = {
  schemaVersion: 1,
  autoRecognize: true,
  fallbackLocale: "vi-VN",
  entities: starterGlossary,
}
const tableName = "AOV rich text settings v1"
export function createReferenceSettingsApi(request = backendRequest) {
  return {
    load: async () => validateReferenceDocument(await request<ReferenceSettingsDocument>("/admin/reference-settings")),
    save: async (settings: RichTextSettings, expectedVersion: number) =>
      validateReferenceDocument(
        await request<ReferenceSettingsDocument>("/admin/reference-settings", {
          method: "PUT",
          body: JSON.stringify({ expectedVersion, settings: validateRichTextSettings(settings) }),
        }),
      ),
  }
}
export const loadSettings = () => createReferenceSettingsApi().load()
export const saveSettings = (settings: RichTextSettings, expectedVersion: number) =>
  createReferenceSettingsApi().save(settings, expectedVersion)
export async function loadLegacySettings() {
  const tables = await storageApi.list()
  const descriptor = tables.find((table) => table.name === tableName && !table.archived)
  const table = descriptor ? await storageApi.get(descriptor.id) : null
  return table?.rows.length ? validateRichTextSettings(table.rows[0]?.settings) : null
}
