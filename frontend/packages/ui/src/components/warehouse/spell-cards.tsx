import { useWarehouseText } from "./warehouse-view"
import { cardChangeKinds, WarehouseBadges as CatalogChangeBadges } from "./warehouse-view"
import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@aov/ui/components/collapsible"
import { cn } from "@aov/ui/lib/utils"
import { SpellArtwork } from "./spell-artwork"
import { SpellCooldown } from "./spell-cooldown"
import { warehouseName, warehouseText, type SpellContent, type WarehouseEntry } from "@aov/ui/lib/warehouse-content"

export const availabilityLabels = { AVAILABLE: "Đang có", REMOVED: "Đã gỡ", UNKNOWN: "Chưa xác định" }
const gridClass = "grid grid-cols-3 gap-2"

export function SpellCollection<E extends WarehouseEntry<SpellContent>>({
  records,
  locale,
  selectedId,
  onOpen,
  revealLegacy = false,
}: {
  records: E[]
  locale: string
  selectedId: string
  onOpen: (entry: E) => void
  revealLegacy?: boolean
}) {
  const t = useWarehouseText()
  const [legacyOpen, setLegacyOpen] = useState(revealLegacy)
  const ordered = [...records].sort(
    (a, b) => (a.content.displayOrder ?? 0) - (b.content.displayOrder ?? 0) || a.code.localeCompare(b.code),
  )
  const current = ordered.filter((entry) => !isLegacy(entry))
  const legacy = ordered.filter(isLegacy)
  const selectedLegacy = legacy.some((entry) => entry.id === selectedId)
  useEffect(() => {
    if (selectedLegacy) setLegacyOpen(true)
  }, [selectedId, selectedLegacy])
  function cards(entries: E[]) {
    return entries.map((entry) => (
      <SpellCard
        key={entry.id}
        entry={entry}
        locale={locale}
        active={entry.id === selectedId}
        onOpen={() => onOpen(entry)}
      />
    ))
  }
  return (
    <div className="w-full max-w-2xl space-y-3">
      {current.length > 0 && <div className={gridClass}>{cards(current)}</div>}
      {legacy.length > 0 && (
        <Collapsible open={legacyOpen} onOpenChange={setLegacyOpen}>
          <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronDown
              aria-hidden
              className={cn("size-4 text-muted-foreground transition-transform", !legacyOpen && "-rotate-90")}
            />
            <span className="text-sm font-semibold">{t("Phụ trợ cũ", "Archived talents")}</span>
            <Badge variant="secondary" className="rounded-full tabular-nums">
              {legacy.length}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {legacyOpen ? t("Thu gọn", "Collapse") : t("Mở danh sách", "Expand list")}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={cn(gridClass, "pt-2")}>{cards(legacy)}</div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function isLegacy(entry: WarehouseEntry<SpellContent>) {
  return entry.content.legacy || entry.content.availability === "REMOVED"
}

function SpellCard({
  entry,
  locale,
  active,
  onOpen,
}: {
  entry: WarehouseEntry<SpellContent>
  locale: string
  active: boolean
  onOpen: () => void
}) {
  const t = useWarehouseText()
  const text = warehouseText(entry.content.translations, locale)
  const changeKinds = cardChangeKinds(entry.changeKinds)
  return (
    <div
      data-spell-card={entry.id}
      className={cn(
        "group relative flex min-w-0 flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-card px-1.5 py-2 text-center transition-colors hover:border-primary/40 hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        active && "bg-primary/5 ring-1 ring-primary/50",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t("Xem", "View")} ${warehouseName(entry, locale)}`}
        aria-pressed={active}
        className="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:outline-none"
      />
      <SpellArtwork
        iconAssetId={entry.content.iconAssetId}
        states={entry.content.states}
        defaultStateKey={entry.content.defaultStateKey}
        name={warehouseName(entry, locale)}
        locale={locale}
        card
      />
      <div className="flex flex-wrap justify-center gap-1 empty:hidden">
        {entry.content.availability !== "AVAILABLE" && (
          <Badge variant="outline" className="px-1.5 py-0 text-xs leading-4">
            {t(
              availabilityLabels[entry.content.availability],
              entry.content.availability === "REMOVED" ? "Retired" : "Unknown",
            )}
          </Badge>
        )}
        {entry.revision.state === "PUBLISHED" && !entry.revision.effectiveFromPatchVariantId && (
          <Badge variant="outline" className="px-1.5 py-0 text-xs leading-4">
            {t("Chưa rõ patch", "Patch unknown")}
          </Badge>
        )}
        {entry.revision.state === "DRAFT" && (
          <Badge variant="outline" className="px-1.5 py-0 text-xs leading-4">
            {entry.revision.effectiveFromPatchVariantId ? "Nháp" : "Nháp · Chưa gắn patch"}
          </Badge>
        )}
      </div>
      {text?.summary && (
        <p className="w-full truncate text-xs text-muted-foreground" title={text.summary}>
          {text.summary}
        </p>
      )}
      <div className="mt-auto flex w-full min-w-0 items-center justify-center gap-1 border-t border-border/50 pt-1.5 text-xs leading-4 text-muted-foreground">
        <SpellCooldown seconds={entry.content.cooldownSeconds} locale={locale} />
      </div>
      {!!changeKinds.length && (
        <div className="flex justify-center">
          <CatalogChangeBadges kinds={changeKinds} compact />
        </div>
      )}
    </div>
  )
}
