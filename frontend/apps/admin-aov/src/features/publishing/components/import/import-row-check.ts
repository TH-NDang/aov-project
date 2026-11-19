import { errorMessage } from "@/lib/api/errors"
import type { ImportContext } from "./import-context"
import { resolveImportImage } from "../../model/import/import-files"
import { hasChangesToSave } from "../../model/import/hero-import-model"
import {
  mapRelation,
  type Relation,
  type RelationField,
  type RelationMapping,
  type RelatedImage,
} from "../../model/import/import-relations"
import type {
  ImportEntry as Entry,
  ImportField as Field,
  ImportPolicy as Policy,
  HeroImportInput as Input,
  HeroImportPlan as Plan,
} from "../../model/import/hero-import-types"

export interface ImportRowCheck {
  row: Record<string, unknown>
  idColumn: string
  /** Codes of the rows checked before this one in the same file; a repeated code is an error. */
  seen: Set<string>
  context: ImportContext
  mode: Input["mode"]
  locale: string
  fields: Field[]
  relationFields: Record<Relation, RelationField[]> | undefined
  mapping: Record<string, string>
  relations: Record<Relation, RelationMapping>
  policies: Record<string, Policy>
  files: Map<string, File>
  base: string
  preview: (input: Input) => Promise<Plan>
}

/**
 * Asks the server what one row of the file would change. Skills and skins are mapped against what the hero already
 * has, so a row with them is asked twice, and the second answer must be about the same version as the first. A row
 * that fails comes back with its error instead of a plan.
 */
export async function checkImportRow({
  row,
  idColumn,
  seen,
  context,
  mode,
  locale,
  fields,
  relationFields,
  mapping,
  relations,
  policies,
  files,
  base,
  preview,
}: ImportRowCheck): Promise<{ code: string; entry: Entry }> {
  const code = String(row[idColumn] ?? "").trim()
  const imageUrls: Record<string, string> = {}
  const input: Input = {
    code,
    rulesetId: context.rulesetId,
    contextId: context.contextId,
    mode,
    locale,
    values: {},
    policies,
  }
  try {
    if (!code || seen.has(code)) throw new Error("Mã tướng trống hoặc bị trùng trong tệp.")
    seen.add(code)
    for (const field of fields) {
      const source = mapping[field.key]
      if (!source || policies[field.key] === "SKIP") continue
      const value = row[source]
      if (field.key === "skills" || field.key === "skins") continue
      if (field.type === "image") {
        if (typeof value === "string" && value.trim()) {
          if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) input.values[field.key] = value
          else imageUrls[field.key] = value.trim()
        }
        continue
      }
      input.values[field.key] =
        field.type === "json" && typeof value === "string" && value.trim() ? JSON.parse(value) : value
    }
    const basePlan = await preview(input)
    const relatedImages: RelatedImage[] = []
    for (const section of ["skills", "skins"] as const) {
      if (!mapping[section] || policies[section] === "SKIP") continue
      if (
        policies[section] !== "OVERWRITE" &&
        Array.isArray(basePlan.before[section]) &&
        (basePlan.before[section] as unknown[]).length
      )
        continue
      if (!relationFields?.[section]) throw new Error("Chưa tải được các trường ánh xạ liên quan từ máy chủ.")
      const mapped = mapRelation(
        section,
        row[mapping[section]],
        relations[section],
        basePlan.before[section],
        locale,
        relationFields[section],
      )
      if (!mapped.rows.length) continue
      input.values[section] = mapped.rows
      relatedImages.push(...mapped.images)
    }
    for (const key of Object.keys(imageUrls)) {
      if (policies[key] !== "OVERWRITE" && basePlan.before[key]) delete imageUrls[key]
      else resolveImportImage(imageUrls[key], files, base)
    }
    relatedImages.forEach((image) => resolveImportImage(image.source, files, base))
    const plan = input.values.skills || input.values.skins ? await preview(input) : basePlan
    if (plan.revisionId !== basePlan.revisionId || plan.version !== basePlan.version)
      throw new Error("Dữ liệu vừa thay đổi trong lúc ánh xạ. Hãy kiểm tra lại để giữ đúng các trường không nhập.")
    return {
      code,
      entry: {
        relatedImages,
        input: { ...input, expectedRevisionId: plan.revisionId, expectedVersion: plan.version },
        plan,
        selected: plan.canApply && hasChangesToSave(plan, relatedImages, imageUrls, policies),
        imageUrls,
      },
    }
  } catch (cause) {
    return { code, entry: { input, error: errorMessage(cause), selected: false } }
  }
}
