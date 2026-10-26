import { Database, GitFork } from "lucide-react"
import { control } from "../publishing/fields"
import { usePublicationOverview } from "../publishing/publication-overview"
import type { WarehouseBaselineMode } from "./warehouse-types"

export function WarehousePatchContext({
  rulesetId,
  value,
  onChange,
  disabled = false,
  allowUnknownPatch = false,
  baselineMode,
  label = "Ngữ cảnh dữ liệu",
  emptyLabel,
  hint,
}: {
  rulesetId: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  allowUnknownPatch?: boolean
  baselineMode?: WarehouseBaselineMode
  label?: string
  emptyLabel?: string
  hint?: string
}) {
  const overview = usePublicationOverview()
  const variants =
    overview.data?.variants
      .filter((variant) => variant.rulesetId === rulesetId && variant.status === "PUBLISHED")
      .sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal) ?? []
  const baselineLabel =
    baselineMode === "inherited" ? "Dữ liệu nền kế thừa · chưa xác định patch" : "Dữ liệu nền · chưa xác định patch"
  const unknownLabel = allowUnknownPatch
    ? "Chưa xác định · hồ sơ lưu trữ"
    : baselineMode
      ? baselineLabel
      : "Chưa xác định · giữ bản nháp"
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
        <option value="">{emptyLabel ?? unknownLabel}</option>
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
              ? "Kế thừa dữ liệu nền chưa rõ patch của bản đã xuất bản. Sửa nội dung hoặc bản dịch không tự trở thành thay đổi gameplay."
              : baselineMode
                ? "Dữ liệu nền chưa rõ patch vẫn có thể xuất bản khi đủ thông tin. Đây là mốc quan sát ban đầu, không phải xác nhận mục được thêm ở mùa hiện tại. Khi có nguồn, bổ sung lịch sử tại patch phù hợp."
                : "Chỉ chọn patch khi có nguồn xác nhận. Thay đổi gameplay cần patch cụ thể; ngày nhập dữ liệu không phải ngày cập nhật trong game.")}
      </span>
      {overview.isError && <span className="text-xs text-destructive">Chưa tải được các mốc patch.</span>}
    </label>
  )
}
