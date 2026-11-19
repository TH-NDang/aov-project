import { Button } from "@aov/ui/components/button"
import type { ImportField } from "../../model/import/hero-import-types"
import { isImportable, matchesImportFilter } from "../../model/import/hero-import-model"
import { ImportEntryCard } from "./import-entry-card"
import { IMPORT_STATUS } from "./import-review"
import type { ImportReview } from "./use-import-review"

/** `rows` with `row` added when its part opened, or taken out when it closed. */
function toggled(rows: Set<number>, row: number, open: boolean) {
  const next = new Set(rows)
  if (open) next.add(row)
  else next.delete(row)
  return next
}

/** The last step of an import: the server's plan for every row, filtered by outcome, and saving the chosen ones. */
export function ImportReviewStep({
  review,
  fields,
  fileName,
  modeTitle,
  onEditMapping,
}: {
  review: ImportReview
  fields: ImportField[] | undefined
  fileName: string
  modeTitle: string | undefined
  onEditMapping: () => void
}) {
  const { entries, setEntries, filter, selectedCount } = review
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Duyệt kết quả trước khi lưu</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {fileName} · {modeTitle}. Chỉ lưu nháp, chưa xuất bản.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onEditMapping}>
          Sửa ánh xạ
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Lọc kết quả">
        {[["ALL", "Tất cả"], ...Object.entries(IMPORT_STATUS), ["ERROR", "Lỗi"]].map(([key, label]) => {
          const count = entries.filter((entry) => matchesImportFilter(entry, key)).length
          return (
            count > 0 && (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "secondary" : "ghost"}
                aria-pressed={filter === key}
                onClick={() => review.setFilter(key)}
              >
                {label} <span className="ml-1 text-muted-foreground">{count}</span>
              </Button>
            )
          )
        })}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={entries.some(isImportable) && entries.filter(isImportable).every((e) => e.selected)}
          onChange={(e) =>
            setEntries(entries.map((item) => ({ ...item, selected: isImportable(item) && e.target.checked })))
          }
        />
        Chọn tất cả bản ghi có thể nhập
      </label>
      <div className="space-y-3">
        {review.shown.map((entry) => {
          const i = entries.indexOf(entry)
          return (
            <ImportEntryCard
              key={i}
              entry={entry}
              index={i}
              fields={fields}
              selectable={isImportable(entry)}
              onSelect={(selected) => setEntries(entries.map((item, j) => (j === i ? { ...item, selected } : item)))}
              imagesOpen={review.expandedImages.has(i)}
              onImagesToggle={(open) => review.setExpandedImages((current) => toggled(current, i, open))}
              changesOpen={review.expandedEntries.has(i)}
              onChangesToggle={(open) => review.setExpandedEntries((current) => toggled(current, i, open))}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Đã chọn {selectedCount}/{entries.length} · {entries.filter((e) => e.result).length} đã gửi
        </p>
        <Button type="button" disabled={!selectedCount} onClick={() => void review.apply()}>
          Lưu {selectedCount} bản nháp
        </Button>
      </div>
    </>
  )
}
