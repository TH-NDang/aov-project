import { AlertCircle } from "lucide-react"
import type { ImportEntry, ImportField } from "../../model/import/hero-import-types"
import { importFieldLabel } from "../../model/import/import-labels"
import { importWarningKey, importWarningText } from "../../model/import/import-warnings"
import { IMPORT_STATUS, ImportValue } from "./import-review"

/**
 * One row of the import review: its selection, warnings, the pictures it will upload and the fields it changes. The
 * folded parts render their content only while open, which the parent remembers per row.
 */
export function ImportEntryCard({
  entry,
  index,
  fields,
  selectable,
  onSelect,
  imagesOpen,
  onImagesToggle,
  changesOpen,
  onChangesToggle,
}: {
  entry: ImportEntry
  index: number
  fields: ImportField[] | undefined
  selectable: boolean
  onSelect: (selected: boolean) => void
  imagesOpen: boolean
  onImagesToggle: (open: boolean) => void
  changesOpen: boolean
  onChangesToggle: (open: boolean) => void
}) {
  const changedFields =
    fields?.filter(
      (f) =>
        entry.plan &&
        (JSON.stringify(entry.plan.before[f.key]) !== JSON.stringify(entry.plan.after[f.key]) ||
          (entry.imageUrls?.[f.key] && (entry.input.policies[f.key] === "OVERWRITE" || !entry.plan.before[f.key]))),
    ) ?? []
  return (
    <article className={`overflow-hidden rounded-lg border ${entry.error ? "border-destructive/40" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 px-4 py-3">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={entry.selected}
            disabled={!selectable}
            onChange={(e) => onSelect(e.target.checked)}
          />
          {entry.input.code || `Dòng ${index + 1}`}
        </label>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs ${entry.result ? "border-(--aov-success)/30 text-(--aov-success)" : "text-muted-foreground"}`}
        >
          {entry.result || (entry.error ? "Cần xử lý" : entry.plan && IMPORT_STATUS[entry.plan.classification])}
        </span>
      </div>
      {entry.error && (
        <p role="alert" className="px-4 py-3 text-sm text-destructive">
          {entry.error}
        </p>
      )}
      {entry.plan?.warnings.map((w) => (
        <p key={importWarningKey(w)} className="flex gap-2 px-4 py-2 text-xs leading-relaxed text-muted-foreground">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {importWarningText(w)}
        </p>
      ))}
      {!!entry.relatedImages?.length && (
        <details className="border-t px-4 py-3 text-sm" onToggle={(event) => onImagesToggle(event.currentTarget.open)}>
          <summary className="cursor-pointer">Sẽ tải lên {entry.relatedImages.length} ảnh liên quan</summary>
          {imagesOpen && (
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {entry.relatedImages.map((image) => (
                <li key={`${image.section}-${image.index}-${image.field}`} className="break-all">
                  {image.section} · {image.field}: {image.source}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      {!!changedFields.length && (
        <details className="border-t" onToggle={(event) => onChangesToggle(event.currentTarget.open)}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Xem {changedFields.length} trường khác biệt
          </summary>
          {changesOpen && (
            <div className="divide-y">
              {changedFields.map((f) => (
                <div key={f.key} className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_2fr_2fr]">
                  <span className="font-medium">{importFieldLabel(f.key)}</span>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-muted-foreground">Trước</p>
                    <div className="max-h-64 overflow-auto rounded-md bg-muted/40 p-2">
                      <ImportValue value={entry.plan?.before[f.key]} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-muted-foreground">Sau khi nhập</p>
                    <div className="max-h-64 overflow-auto rounded-md bg-primary/5 p-2">
                      <ImportValue value={entry.imageUrls?.[f.key] ?? entry.plan?.after[f.key]} />
                    </div>
                    {entry.imageUrls?.[f.key] && (
                      <p className="mt-1 text-xs text-muted-foreground">Ảnh chỉ tải khi xác nhận lưu.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </details>
      )}
    </article>
  )
}
