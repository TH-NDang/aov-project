import { CatalogChangeBadges } from "./catalog-changes"
import { useState } from "react"
import { ChevronDown, CircleDot, Gem, Sparkles, Swords } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@aov/ui/components/collapsible"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-content"
import { arcanaCombatGroup, useArcanaStatColors } from "./arcana-stat-colors"
import { warehouseName, warehouseText, type ArcanaContent, type WarehouseEntry } from "./warehouse-types"
const colors = ["RED", "PURPLE", "GREEN"] as const
const colorDetails = {
  RED: { label: "Đỏ", prefixes: ["Đỏ", "Red"], icon: "text-rose-500", header: "bg-rose-500/5" },
  PURPLE: { label: "Tím", prefixes: ["Tím", "Purple"], icon: "text-violet-500", header: "bg-violet-500/5" },
  GREEN: { label: "Xanh", prefixes: ["Xanh", "Green"], icon: "text-emerald-500", header: "bg-emerald-500/5" },
}
const tierLabels = ["I", "II", "III"]
const combatGroups = [
  { key: "physical", label: "Công vật lý", icon: Swords, colorLabel: "Công vật lý" },
  { key: "magic", label: "Phép", icon: Sparkles, colorLabel: "Công phép" },
  { key: "neutral", label: "Trung tính", icon: CircleDot, colorLabel: "" },
] as const
const gridClass =
  "grid grid-cols-1 gap-2 @min-[460px]/arcana:grid-cols-2 @min-[720px]/arcana:grid-cols-3 @min-[960px]/arcana:grid-cols-4"

function compactArcanaName(name: string, color: ArcanaContent["color"], tier: number) {
  const prefix = new RegExp(
    `^(?:${colorDetails[color].prefixes.join("|")})\\s+(?:${tierLabels[tier - 1]}|${tier})\\s+`,
    "iu",
  )
  const shortened = name.replace(prefix, "").trim()
  return shortened && shortened !== name ? shortened.replace(/\s*\/\s*/g, " / ") : name
}

export function ArcanaCollection({
  records,
  locale,
  selectedId,
  onOpen,
  revealLowerTiers = false,
}: {
  records: WarehouseEntry<ArcanaContent>[]
  locale: string
  selectedId: string
  onOpen: (entry: WarehouseEntry<ArcanaContent>) => void
  revealLowerTiers?: boolean
}) {
  const [openTiers, setOpenTiers] = useState<number[]>(revealLowerTiers ? [1, 2] : [])
  const statColor = useArcanaStatColors()
  function groups(entries: WarehouseEntry<ArcanaContent>[], tier: number) {
    return colors.map((color) => {
      const items = entries.filter((entry) => entry.content.color === color)
      if (!items.length) return null
      const details = colorDetails[color]
      const grouped = items.map((entry) => ({ entry, group: arcanaCombatGroup(entry.content) }))
      return (
        <section
          key={color}
          aria-label={`Ngọc ${details.label} bậc ${tierLabels[tier - 1]}`}
          className="overflow-hidden rounded-xl border border-border/70"
        >
          <header className={cn("flex items-center gap-2 border-b border-border/50 px-3 py-2", details.header)}>
            <Gem aria-hidden className={cn("size-4", details.icon)} />
            <h3 className="text-xs font-semibold">Ngọc {details.label}</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">{items.length} ngọc</span>
          </header>
          <div className="space-y-4 p-2">
            {combatGroups.map(({ key, label, icon: Icon, colorLabel }) => {
              const members = grouped.filter((item) => item.group === key)
              if (!members.length) return null
              return (
                <section
                  key={key}
                  className="space-y-2"
                  aria-label={`${label} · Ngọc ${details.label} bậc ${tierLabels[tier - 1]}`}
                >
                  <div className="flex items-center gap-2 px-1 pt-1">
                    <Icon
                      aria-hidden
                      className="size-3.5 text-muted-foreground"
                      style={{ color: statColor(colorLabel) }}
                    />
                    <h4 className="text-[11px] font-semibold">{label}</h4>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{members.length}</span>
                    <div aria-hidden className="h-px flex-1 bg-border/60" />
                  </div>
                  <div className={gridClass}>
                    {members.map(({ entry }) => (
                      <ArcanaCard
                        key={entry.id}
                        entry={entry}
                        locale={locale}
                        active={entry.id === selectedId}
                        statColor={statColor}
                        onOpen={() => onOpen(entry)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </section>
      )
    })
  }
  const highest = records.filter((entry) => entry.content.tier === 3)
  return (
    <div className="@container/arcana min-w-0 space-y-3">
      {highest.length > 0 && (
        <section className="space-y-3" aria-label="Ngọc bậc III">
          <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
            Ngọc bậc III <span className="ml-1 text-muted-foreground">{highest.length}</span>
          </h2>
          {groups(highest, 3)}
        </section>
      )}
      {[2, 1].map((tier) => {
        const entries = records.filter((entry) => entry.content.tier === tier)
        if (!entries.length) return null
        const open = openTiers.includes(tier)
        return (
          <Collapsible
            key={tier}
            open={open}
            onOpenChange={(value) =>
              setOpenTiers((current) => (value ? [...current, tier] : current.filter((item) => item !== tier)))
            }
          >
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-3 text-left hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronDown
                aria-hidden
                className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")}
              />
              <span className="text-sm font-semibold">Ngọc bậc {["I", "II"][tier - 1]}</span>
              <Badge variant="secondary" className="rounded-full tabular-nums">
                {entries.length}
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground">{open ? "Thu gọn" : "Mở danh sách"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-2">{groups(entries, tier)}</div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}

function ArcanaCard({
  entry,
  locale,
  active,
  statColor,
  onOpen,
}: {
  entry: WarehouseEntry<ArcanaContent>
  locale: string
  active: boolean
  statColor: ReturnType<typeof useArcanaStatColors>
  onOpen: () => void
}) {
  const text = warehouseText(entry.content.translations, locale)
  const name = warehouseName(entry, locale)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Xem ${name}`}
      aria-pressed={active}
      className={cn(
        "group flex min-w-0 cursor-pointer flex-col gap-2 rounded-lg border border-border/60 bg-card p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary bg-primary/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <HeroAsset
          id={entry.content.iconAssetId}
          alt=""
          frameAspectRatio={1}
          className="size-9 shrink-0 rounded-full border-0 bg-transparent"
        />
        <p className="line-clamp-2 min-w-0 text-[13px] leading-[18px] font-bold">
          {compactArcanaName(name, entry.content.color, entry.content.tier)}
        </p>
      </div>
      <dl className="mt-auto w-full space-y-1 border-t border-border/50 pt-2">
        {entry.content.stats.map((stat) => {
          const label = text?.statLabels?.[stat.key] || stat.key
          const color = statColor(label, stat.key)
          return (
            <div
              key={stat.key}
              className="flex items-baseline justify-between gap-2 text-[11px] leading-4"
              style={{ color }}
            >
              <dt className={cn("min-w-0 font-medium break-words", !color && "text-muted-foreground")}>{label}</dt>
              <dd className="shrink-0 font-bold tabular-nums">
                {stat.value > 0 ? "+" : ""}
                {stat.value}
                {stat.unit}
              </dd>
            </div>
          )
        })}
        {!entry.content.stats.length && <p className="text-xs text-muted-foreground">Chưa có chỉ số</p>}
      </dl>
      {(entry.revision.state === "DRAFT" || entry.changeKinds?.some((kind) => kind !== "DATA_BASELINE")) && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {entry.revision.state === "DRAFT" && (
            <Badge variant="outline" className="w-fit text-[10px]">
              Nháp
            </Badge>
          )}
          <span className="ml-auto">
            <CatalogChangeBadges kinds={entry.changeKinds ?? []} hideBaseline />
          </span>
        </div>
      )}
    </button>
  )
}
