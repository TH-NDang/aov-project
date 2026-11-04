import { HeroAsset } from "../publishing/hero-asset"
import { availabilityLabels } from "./spell-cards"
import { warehouseText, type WarehouseMetadata } from "./warehouse-types"
import type { SecondaryContent, SecondaryKind } from "./secondary-editor"

export function SecondaryAttributes({
  kind,
  content,
  branches,
  locale,
  part,
}: {
  kind: SecondaryKind
  content: SecondaryContent
  branches: WarehouseMetadata[]
  locale: string
  part: "mechanics" | "stats" | "states"
}) {
  const rows: [string, string | number][] = []
  if (part === "states") {
    return content.states?.length ? (
      <ul className="space-y-1">
        {content.states.map((state, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <HeroAsset id={state.iconAssetId} className="size-7 rounded-full" frameAspectRatio={1} />
            {warehouseText(state.translations, locale)?.name || state.key}
            {state.key === content.defaultStateKey && <span className="type-meta">Mặc định</span>}
          </li>
        ))}
      </ul>
    ) : (
      <p className="type-meta">Chưa có trạng thái.</p>
    )
  }
  if (part === "stats") {
    const labels = warehouseText(content.translations, locale)?.statLabels
    for (const stat of content.stats ?? [])
      rows.push([labels?.[stat.key] || stat.key, `${stat.value.toLocaleString(locale)}${stat.unit ?? ""}`])
  } else if (kind === "enchantments") {
    const branch = branches.find((entry) => entry.code === content.branchCode)
    rows.push(
      ["Hệ", (branch && warehouseText(branch.translations, locale)?.name) || content.branchCode || "Chưa chọn"],
      ["Cấp", content.tier ?? "—"],
      ["Vị trí trong cấp", content.position == null ? "Chưa xếp" : content.position + 1],
    )
  } else if (kind === "arcana") {
    rows.push(
      ["Màu ngọc", content.color ? { RED: "Đỏ", PURPLE: "Tím", GREEN: "Xanh" }[content.color] : "—"],
      ["Cấp", content.tier ?? "—"],
    )
  } else {
    rows.push(["Hồi chiêu", content.cooldownSeconds == null ? "—" : `${content.cooldownSeconds} s`])
    if (content.availability !== "AVAILABLE")
      rows.push(["Khả dụng", availabilityLabels[content.availability ?? "UNKNOWN"]])
    if (content.maxCharges != null) rows.push(["Số lần tích trữ", content.maxCharges])
    if (content.chargeRechargeSeconds != null) rows.push(["Thời gian tích", `${content.chargeRechargeSeconds} s`])
    if (content.displayOrder != null) rows.push(["Thứ tự hiển thị", content.displayOrder])
    if (content.legacy) rows.push(["Phân loại", "Phụ trợ cũ"])
  }
  return rows.length ? (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {rows.map(([label, value], index) => (
        <div key={index} className="min-w-0">
          <dt className="type-meta">{label}</dt>
          <dd className="type-body break-words">{value}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="type-meta">Chưa có chỉ số.</p>
  )
}
