import { useWarehouseText, WarehouseAsset } from "./warehouse-view"
import { availabilityLabels } from "./spell-cards"
import { SpellCooldown } from "./spell-cooldown"
import { warehouseText, type WarehouseMetadata } from "@aov/ui/lib/warehouse-content"
import type { WarehouseContents, WarehouseTranslation, WarehouseStat } from "@aov/ui/lib/warehouse-content"
type SecondaryKind = Exclude<keyof WarehouseContents, "items">
type SecondaryContent = Partial<
  WarehouseContents["spells"] & WarehouseContents["enchantments"] & WarehouseContents["arcana"]
> & { translations: WarehouseTranslation[]; stats?: WarehouseStat[] }

export function SecondaryAttributes({
  kind,
  content,
  branches,
  locale,
  part,
  showPlacement = true,
}: {
  kind: SecondaryKind
  content: SecondaryContent
  branches: WarehouseMetadata[]
  locale: string
  part: "mechanics" | "stats" | "states"
  showPlacement?: boolean
}) {
  const t = useWarehouseText()
  const rows: [string, string | number][] = []
  if (part === "states") {
    return content.states?.length ? (
      <ul className="space-y-1">
        {content.states.map((state, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <WarehouseAsset id={state.iconAssetId} className="size-7 rounded-full" frameAspectRatio={1} />
            {warehouseText(state.translations, locale)?.name || state.key}
            {state.key === content.defaultStateKey && <span className="type-meta">{t("Mặc định", "Default")}</span>}
          </li>
        ))}
      </ul>
    ) : (
      <p className="type-meta">{t("Chưa có trạng thái.", "No states recorded.")}</p>
    )
  }
  if (part === "stats") {
    const labels = warehouseText(content.translations, locale)?.statLabels
    for (const stat of content.stats ?? [])
      rows.push([labels?.[stat.key] || stat.key, `${stat.value.toLocaleString(locale)}${stat.unit ?? ""}`])
  } else if (kind === "enchantments") {
    const branch = branches.find((entry) => entry.code === content.branchCode)
    rows.push(
      [
        t("Hệ", "Branch"),
        (branch && warehouseText(branch.translations, locale)?.name) ||
          content.branchCode ||
          t("Chưa chọn", "Unassigned"),
      ],
      [t("Cấp", "Tier"), content.tier ?? "—"],
    )
    if (showPlacement)
      rows.push([
        t("Vị trí trong cấp", "Position in tier"),
        content.position == null ? t("Chưa xếp", "Unplaced") : content.position + 1,
      ])
  } else if (kind === "arcana") {
    rows.push(
      [
        t("Màu ngọc", "Color"),
        content.color
          ? { RED: t("Đỏ", "Red"), PURPLE: t("Tím", "Purple"), GREEN: t("Xanh", "Green") }[content.color]
          : "—",
      ],
      [t("Cấp", "Tier"), content.tier ?? "—"],
    )
  } else {
    if (content.availability !== "AVAILABLE")
      rows.push([
        t("Khả dụng", "Availability"),
        t(
          availabilityLabels[content.availability ?? "UNKNOWN"],
          content.availability === "REMOVED" ? "Retired" : "Unknown",
        ),
      ])
    if (content.maxCharges != null) rows.push([t("Số lần tích trữ", "Maximum charges"), content.maxCharges])
    if (content.chargeRechargeSeconds != null)
      rows.push([t("Thời gian tích", "Recharge time"), `${content.chargeRechargeSeconds} s`])
    if (showPlacement && content.displayOrder != null)
      rows.push([t("Thứ tự hiển thị", "Display order"), content.displayOrder])
    if (content.legacy) rows.push([t("Phân loại", "Classification"), t("Phụ trợ cũ", "Archived talent")])
  }
  const showCooldown = kind === "spells" && part === "mechanics"
  return rows.length || showCooldown ? (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {showCooldown && (
        <div className="self-center">
          <dt className="sr-only">{t("Hồi chiêu", "Cooldown")}</dt>
          <dd className="type-body">
            <SpellCooldown seconds={content.cooldownSeconds} locale={locale} />
          </dd>
        </div>
      )}
      {rows.map(([label, value], index) => (
        <div key={index} className="min-w-0">
          <dt className="type-meta">{label}</dt>
          <dd className="type-body break-words">{value}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="type-meta">{t("Chưa có chỉ số.", "No stats recorded.")}</p>
  )
}
