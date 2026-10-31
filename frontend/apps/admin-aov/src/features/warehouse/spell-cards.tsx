import { CatalogChangeBadges } from "./catalog-changes"
import { useState } from "react"
import { ChevronDown, Clock3 } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@aov/ui/components/collapsible"
import { cn } from "@aov/ui/lib/utils"
import { SpellArtwork } from "./spell-artwork"
import { warehouseName, warehouseText, type SpellContent, type WarehouseEntry } from "./warehouse-types"

export const availabilityLabels = { AVAILABLE: "Đang có", REMOVED: "Đã gỡ", UNKNOWN: "Chưa xác định" }
const gridClass = "grid grid-cols-3 gap-2"

export function SpellCollection({
  records,
  locale,
  selectedId,
  onOpen,
  revealLegacy = false,
}: {
  records: WarehouseEntry<SpellContent>[]
  locale: string
  selectedId: string
  onOpen: (entry: WarehouseEntry<SpellContent>) => void
  revealLegacy?: boolean
}) {
  const [legacyOpen, setLegacyOpen] = useState(revealLegacy)
  const current = records.filter((entry) => !isLegacy(entry))
  const legacy = records.filter(isLegacy)
  function cards(entries: WarehouseEntry<SpellContent>[]) {
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
            <span className="text-sm font-semibold">Phụ trợ cũ</span>
            <Badge variant="secondary" className="rounded-full tabular-nums">
              {legacy.length}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">{legacyOpen ? "Thu gọn" : "Mở danh sách"}</span>
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
  const text = warehouseText(entry.content.translations, locale)
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
        aria-label={`Xem ${warehouseName(entry, locale)}`}
        aria-pressed={active}
        className="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:outline-none"
      />
      <div className="flex h-16 w-full items-center justify-center">
        <SpellArtwork
          iconAssetId={entry.content.iconAssetId}
          states={entry.content.states}
          defaultStateKey={entry.content.defaultStateKey}
          name={warehouseName(entry, locale)}
          locale={locale}
          compact
        />
      </div>
      <div className="w-full min-w-0 space-y-1">
        <p className="truncate text-xs leading-4 font-semibold" title={text?.name || entry.code}>
          {text?.name || entry.code}
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          <Badge
            variant={entry.content.availability === "AVAILABLE" ? "secondary" : "outline"}
            className="px-1.5 py-0 text-xs leading-4"
          >
            {availabilityLabels[entry.content.availability]}
          </Badge>
          {isLegacy(entry) && !entry.revision.effectiveFromPatchVariantId && (
            <Badge variant="outline" className="px-1.5 py-0 text-xs leading-4">
              Chưa rõ patch
            </Badge>
          )}
          {entry.revision.state === "DRAFT" && (
            <Badge variant="outline" className="px-1.5 py-0 text-xs leading-4">
              Nháp
            </Badge>
          )}
        </div>
      </div>
      {text?.summary && (
        <p className="w-full truncate text-xs text-muted-foreground" title={text.summary}>
          {text.summary}
        </p>
      )}
      <div className="mt-auto flex w-full min-w-0 items-center justify-center gap-1 border-t border-border/50 pt-1.5 text-xs leading-4 text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <Clock3 aria-hidden className="size-3 shrink-0" />
          <span
            className="truncate"
            title={
              entry.content.cooldownSeconds == null
                ? "Chưa rõ hồi chiêu"
                : `${entry.content.cooldownSeconds} giây hồi chiêu`
            }
          >
            {entry.content.cooldownSeconds == null ? "Chưa rõ hồi chiêu" : `${entry.content.cooldownSeconds} giây`}
          </span>
        </span>
        <span aria-hidden className="shrink-0">
          ·
        </span>
        <span className="min-w-0 truncate">
          {entry.content.unlockType === "ACCOUNT_CREATION"
            ? "Khi tạo tài khoản"
            : entry.content.unlockLevel == null
              ? "Chưa rõ Lv mở khóa"
              : `Lv ${entry.content.unlockLevel}`}
        </span>
      </div>
      {entry.changeKinds?.some((kind) => kind !== "DATA_BASELINE") && (
        <div className="flex justify-center">
          <CatalogChangeBadges kinds={entry.changeKinds ?? []} compact hideBaseline />
        </div>
      )}
    </div>
  )
}
