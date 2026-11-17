import type { components } from "../../generated/hero-api"
import type { RelatedImage } from "./import-relations"

export type ImportPolicy = components["schemas"]["ImportPolicy"]
export type ImportField = components["schemas"]["ImportField"]
export type HeroImportInput = components["schemas"]["HeroImportRequest"]
export type HeroImportPlan = components["schemas"]["HeroImportPlan"]

/** One row of the file on its way through the import: what it sends, the server's plan and the result of saving it. */
export interface ImportEntry {
  relatedImages?: RelatedImage[]
  imageUrls?: Record<string, string>
  input: HeroImportInput
  plan?: HeroImportPlan
  error?: string
  selected: boolean
  result?: string
}
