import type { ImportEntry, ImportField, ImportPolicy, HeroImportPlan } from "./hero-import-types"
import type { RelatedImage } from "./import-relations"

type Row = Record<string, unknown>

const dataFile = /\.(json|csv)$/i
const zipFile = /\.zip$/i

/** The columns of the rows; the `__` ones are the importer's own notes, not data. */
export const importColumns = (rows: readonly Row[]) =>
  [...new Set(rows.flatMap(Object.keys))].filter((key) => !key.startsWith("__"))

/** Each field maps to the column of the same name when the file has one. */
export const defaultFieldMapping = (fields: readonly ImportField[], columns: readonly string[]) =>
  Object.fromEntries(fields.filter((field) => columns.includes(field.key)).map((field) => [field.key, field.key]))

/** The column that names each hero: `code`, else `id`, else none yet. */
export const defaultIdColumn = (columns: readonly string[]) =>
  columns.includes("code") ? "code" : columns.includes("id") ? "id" : ""

/** Whether a checked row would change anything: its fields, related pictures, or a picture it may write. */
export function hasChangesToSave(
  plan: Pick<HeroImportPlan, "changed" | "before">,
  relatedImages: readonly RelatedImage[],
  imageUrls: Readonly<Record<string, string>>,
  policies: Readonly<Record<string, ImportPolicy>>,
) {
  return (
    plan.changed ||
    relatedImages.length > 0 ||
    Object.keys(imageUrls).some((key) => policies[key] === "OVERWRITE" || !plan.before[key])
  )
}

/** A row can be saved when the server accepts its plan, it has no error, it was not sent yet and it changes something. */
export function isImportable(entry: ImportEntry) {
  return (
    !!entry.plan?.canApply &&
    !entry.error &&
    !entry.result &&
    hasChangesToSave(entry.plan, entry.relatedImages ?? [], entry.imageUrls ?? {}, entry.input.policies)
  )
}

/** The review filter: every row, the rows that failed, or the rows of one classification. */
export const matchesImportFilter = (entry: ImportEntry, filter: string) =>
  filter === "ALL" || (filter === "ERROR" ? !!entry.error : entry.plan?.classification === filter)

/** The JSON and CSV files of a folder or archive, any of which may hold the heroes. */
export const dataFilePaths = (paths: Iterable<string>) => [...paths].filter((path) => dataFile.test(path))

/** Every folder of a bundle, sorted; picture paths may be written from any of them. */
export function imageBaseFolders(paths: Iterable<string>) {
  return [
    ...new Set(
      [...paths].flatMap((path) => {
        const parts = path.split("/").slice(0, -1)
        return parts.map((_, index) => parts.slice(0, index + 1).join("/"))
      }),
    ),
  ].sort()
}

export type DroppedSource = { kind: "zip"; file: File } | { kind: "data"; file: File } | { kind: "bundle" }

/**
 * What was dropped: one ZIP, one data file, or a bundle of a data file with its pictures. Throws when the drop holds
 * no data file, or archives that would have to be read one by one.
 */
export function droppedSource(dropped: ReadonlyMap<string, File>): DroppedSource {
  const single = dropped.size === 1 ? [...dropped.values()][0] : undefined
  if (single && zipFile.test(single.name)) return { kind: "zip", file: single }
  if (single && dataFile.test(single.name)) return { kind: "data", file: single }
  if (![...dropped.keys()].some((path) => dataFile.test(path)))
    throw new Error("Hãy thả JSON/CSV, một ZIP hoặc thư mục chứa dữ liệu và ảnh.")
  if ([...dropped.keys()].some((path) => zipFile.test(path)))
    throw new Error("Hãy thả từng ZIP riêng hoặc giải nén rồi chọn thư mục.")
  return { kind: "bundle" }
}
