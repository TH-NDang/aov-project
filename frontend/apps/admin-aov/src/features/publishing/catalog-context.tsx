import { control } from "./fields"
import { CalendarDays, GitCompareArrows, RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { type PublicationOverview } from "./publication-overview"
export interface CatalogFilter {
  seasonId: string
  variantId: string
}
export function CatalogContext({
  data,
  value,
  onChange,
}: {
  data: PublicationOverview
  value: CatalogFilter
  onChange: (filter: CatalogFilter) => void
}) {
  const allowed = value.seasonId
    ? new Set(data.variants.filter((v) => v.seasonId === value.seasonId).map((v) => v.id))
    : null
  const filtered = !!(value.seasonId || value.variantId)
  return (
    <section
      aria-label="Lọc thay đổi gameplay"
      className="grid items-end gap-3 rounded-xl border bg-muted/10 p-3 sm:grid-cols-[1fr_1fr_auto] sm:p-4"
    >
      <label className="grid gap-2 text-sm">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          Mùa có thay đổi
        </span>
        <select
          aria-label="Mùa có thay đổi"
          className={control}
          value={value.seasonId}
          onChange={(e) => onChange({ seasonId: e.target.value, variantId: "" })}
        >
          <option value="">Tất cả mùa</option>
          {data.seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm">
        <span className="flex items-center gap-2">
          <GitCompareArrows className="size-4 text-muted-foreground" />
          Patch có thay đổi
        </span>
        <select
          aria-label="Patch có thay đổi"
          className={control}
          value={value.variantId}
          onChange={(e) => onChange({ ...value, variantId: e.target.value })}
        >
          <option value="">Tất cả patch</option>
          {data.variants
            .filter((v) => !allowed || allowed.has(v.id))
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.patchCode}
                {!value.seasonId && v.seasonId
                  ? ` · ${data.seasons.find((season) => season.id === v.seasonId)?.displayName ?? ""}`
                  : ""}
                {data.rulesets.length > 1 ? ` · ${data.rulesets.find((r) => r.id === v.rulesetId)?.code ?? ""}` : ""}
                {v.status === "DRAFT" ? " · Bản nháp" : ""}
              </option>
            ))}
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={!filtered}
        className="w-full sm:w-auto"
        onClick={() => onChange({ seasonId: "", variantId: "" })}
      >
        <RotateCcw className="size-4" />
        Bỏ lọc
      </Button>
      <p role="status" className="text-xs leading-5 text-muted-foreground sm:col-span-3">
        {filtered
          ? "Chỉ hiển thị tướng có thay đổi gameplay đã ghi nhận trong mùa hoặc patch đang chọn."
          : "Hiển thị toàn bộ tướng và lần cập nhật gameplay gần nhất đã ghi nhận."}
      </p>
    </section>
  )
}
