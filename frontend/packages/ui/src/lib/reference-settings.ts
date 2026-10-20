import { validateRichTextSettings, type RichTextSettings } from "./entity-rich-text"

export interface ReferenceSettingsDocument {
  version: number
  settings: RichTextSettings
}
export function validateReferenceDocument(value: ReferenceSettingsDocument): ReferenceSettingsDocument {
  if (!Number.isSafeInteger(value.version) || value.version < 1) throw new Error("Invalid reference settings version")
  return { version: value.version, settings: validateRichTextSettings(value.settings) }
}
