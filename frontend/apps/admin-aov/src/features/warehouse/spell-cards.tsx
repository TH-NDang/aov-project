import { CatalogChangeBadges } from "./catalog-changes"
import { useState } from "react"
import { ChevronDown, Clock3 } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@aov/ui/components/collapsible"
import { cn } from "@aov/ui/lib/utils"
import { SpellArtwork } from "./spell-artwork"
import { WarehouseCardHint } from "./warehouse-card-hint"
import { warehouseName, warehouseText, type SpellContent, type WarehouseEntry } from "./warehouse-types"

export const availabilityLabels = { AVAILABLE: "Đang có", REMOVED: "Đã gỡ", UNKNOWN: "Chưa xác định" }
const gridClass = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"

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
    <div className="space-y-5">
      {current.length > 0 && <div className={gridClass}>{cards(current)}</div>}
      {legacy.length > 0 && (
        <Collapsible open={legacyOpen} onOpenChange={setLegacyOpen}>
          <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-3 text-left hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring">
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
        "group relative flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-4 text-left transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        active && "bg-primary/5 ring-1 ring-primary/50",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem ${warehouseName(entry, locale)}`}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline-none"
      />
      <div className="flex items-start gap-3">
        <SpellArtwork
          iconAssetId={entry.content.iconAssetId}
          states={entry.content.states}
          defaultStateKey={entry.content.defaultStateKey}
          name={warehouseName(entry, locale)}
          locale={locale}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-semibold">{text?.name || entry.code}</p>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={entry.content.availability === "AVAILABLE" ? "secondary" : "outline"}
              className="text-[10px]"
            >
              {availabilityLabels[entry.content.availability]}
            </Badge>
            {isLegacy(entry) && !entry.revision.effectiveFromPatchVariantId && (
              <Badge variant="outline" className="text-[10px]">
                Chưa rõ patch
              </Badge>
            )}
            {entry.revision.state === "DRAFT" && (
              <Badge variant="outline" className="text-[10px]">
                Nháp
              </Badge>
            )}
          </div>
        </div>
      </div>
      {text?.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{text.summary}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 aria-hidden className="size-3.5" />
          {entry.content.cooldownSeconds == null ? "Chưa rõ hồi chiêu" : `${entry.content.cooldownSeconds} giây`}
        </span>
        <span>
          {entry.content.unlockType === "ACCOUNT_CREATION"
            ? "Khi tạo tài khoản"
            : entry.content.unlockLevel == null
              ? "Chưa rõ Lv mở khóa"
              : `Lv ${entry.content.unlockLevel}`}
        </span>
      </div>
      <div className="flex justify-end">
        <CatalogChangeBadges kinds={entry.changeKinds ?? []} />
        <WarehouseCardHint />
      </div>
    </div>
  )
}
