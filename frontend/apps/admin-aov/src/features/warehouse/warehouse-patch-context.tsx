import { control } from "../publishing/fields"
import { usePublicationOverview } from "../publishing/publication-overview"

export function WarehousePatchContext({
  rulesetId,
  value,
  onChange,
  disabled = false,
  allowUnknownPatch = false,
  label = "Ghi nhận dữ liệu tại patch",
  emptyLabel,
  hint,
}: {
  rulesetId: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  allowUnknownPatch?: boolean
  label?: string
  emptyLabel?: string
  hint?: string
}) {
  const overview = usePublicationOverview()
  const variants =
    overview.data?.variants
      .filter((variant) => variant.rulesetId === rulesetId && variant.status === "PUBLISHED")
      .sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal) ?? []
  return (
    <label className="grid gap-1.5 rounded-lg border bg-muted/20 p-3 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className={control}
        aria-label={label}
        value={value ?? ""}
        disabled={disabled || overview.isPending}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">
          {emptyLabel ?? (allowUnknownPatch ? "Chưa xác định · hồ sơ lưu trữ" : "Chưa xác định · giữ bản nháp")}
        </option>
        {value && !variants.some((variant) => variant.id === value) && <option value={value}>Mốc đã chọn</option>}
        {variants.map((variant) => {
          const season = overview.data?.seasons.find((season) => season.id === variant.seasonId)
          return (
            <option key={variant.id} value={variant.id}>
              {season?.displayName ? `${season.displayName} · ` : ""}
              {variant.patchCode}
            </option>
          )
        })}
      </select>
      <span className="text-xs leading-5 text-muted-foreground">
        {hint ??
          (allowUnknownPatch
            ? "Có thể xuất bản hồ sơ lưu trữ chưa rõ patch. Dữ liệu này không áp dụng cho gameplay hiện tại."
            : "Mốc dữ liệu nền đã xác minh. Chọn patch không có nghĩa mọi mục đều thay đổi từ patch trước.")}
      </span>
      {overview.isError && <span className="text-xs text-destructive">Chưa tải được các mốc patch.</span>}
    </label>
  )
}
