import { Database, GitFork } from "lucide-react"
import { control } from "../../publishing/components/fields"
import { usePublicationOverview } from "../../publishing/api/publication-overview"
import type { WarehouseBaselineMode } from "../model/warehouse-types"

export function WarehousePatchContext({
  rulesetId,
  value,
  onChange,
  disabled = false,
  compact = false,
  allowUnknownPatch = false,
  baselineMode,
  label = "Áp dụng từ patch",
  emptyLabel,
  hint,
  inline = false,
}: {
  rulesetId: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  compact?: boolean
  allowUnknownPatch?: boolean
  baselineMode?: WarehouseBaselineMode
  label?: string
  emptyLabel?: string
  hint?: string
  /** Sits under a label of the page's own: no frame and no visible title, which only the screen reader keeps. */
  inline?: boolean
}) {
  const overview = usePublicationOverview()
  const variants =
    overview.data?.variants
      .filter((variant) => variant.rulesetId === rulesetId && variant.status === "PUBLISHED")
      .sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal) ?? []
  const baselineLabel =
    baselineMode === "inherited"
      ? "Chưa rõ patch · giữ theo bản nhập dữ liệu trước"
      : "Chưa rõ patch · bản nhập dữ liệu"
  const unknownLabel = allowUnknownPatch
    ? "Chưa rõ patch · hồ sơ lưu trữ"
    : baselineMode
      ? baselineLabel
      : "Chưa rõ patch · giữ bản nháp"
  if (compact) {
    const variant = variants.find((option) => option.id === value)
    const season = variant && overview.data?.seasons.find((option) => option.id === variant.seasonId)
    return (
      <p role="status" className="type-body">
        {value
          ? [season?.displayName, variant?.patchCode ?? "Patch đã chọn"].filter(Boolean).join(" · ")
          : (emptyLabel ?? unknownLabel)}
        {overview.isError && <span className="type-meta block">Chưa tải được danh sách patch.</span>}
      </p>
    )
  }
  return (
    <label className={inline ? "grid gap-1.5" : "grid gap-1.5 rounded-lg border bg-muted/20 p-3 text-sm"}>
      <span className={inline ? "sr-only" : "font-medium"}>{label}</span>
      <select
        className={control}
        aria-label={label}
        value={value ?? ""}
        disabled={disabled || overview.isPending}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{emptyLabel ?? unknownLabel}</option>
        {value && !variants.some((variant) => variant.id === value) && <option value={value}>Patch đã chọn</option>}
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
      {baselineMode && !value && !allowUnknownPatch && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary" role="status">
          {baselineMode === "inherited" ? <GitFork className="size-3.5" /> : <Database className="size-3.5" />}
          {baselineLabel}
        </span>
      )}
      <span className="text-xs leading-5 text-muted-foreground">
        {hint ??
          (allowUnknownPatch
            ? "Có thể xuất bản hồ sơ lưu trữ chưa rõ patch. Dữ liệu này không áp dụng cho gameplay hiện tại."
            : baselineMode === "inherited"
              ? "Giữ theo bản nhập dữ liệu đã xuất bản, vốn chưa rõ patch. Sửa nội dung hoặc bản dịch không tính là thay đổi gameplay."
              : baselineMode
                ? "Bản nhập dữ liệu chưa rõ patch vẫn xuất bản được. Nó chỉ ghi số liệu lúc nhập, không phải xác nhận mục được thêm ở mùa hiện tại. Khi có nguồn, ghi thêm lịch sử ở patch phù hợp."
                : "Chỉ chọn patch khi có nguồn xác nhận. Thay đổi gameplay cần patch cụ thể; ngày nhập dữ liệu không phải ngày cập nhật trong game.")}
      </span>
      {overview.isError && <span className="text-xs text-destructive">Chưa tải được danh sách patch.</span>}
    </label>
  )
}
