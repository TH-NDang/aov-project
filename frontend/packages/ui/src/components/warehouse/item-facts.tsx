import type { ReactNode } from "react"
import { cn } from "@aov/ui/lib/utils"
import {
  formatItemStatValue,
  ITEM_STAT_FILTERS,
  itemStatDefinition,
  type ItemTextContent,
  type ItemTextStat,
} from "@aov/ui/lib/item-description"
import { gameplayIcons } from "../gameplay-icons"
import { useWarehouseText } from "./warehouse-view"

function StatArt({ stat, size }: { stat: Pick<ItemTextStat, "key">; size: number }) {
  const definition = itemStatDefinition(stat.key)
  const Art = definition && gameplayIcons[definition.icon]
  return Art ? <Art size={size} className="shrink-0" /> : <span className="shrink-0" style={{ width: size }} />
}

function UniqueTag() {
  const t = useWarehouseText()
  return (
    <span className="rounded bg-muted px-1 text-xs font-normal whitespace-nowrap text-muted-foreground">
      {t("Duy nhất", "Unique")}
    </span>
  )
}

/** Every stat with its icon and value, one to a row so numbers line up for comparison. */
export function ItemStatList({ stats, locale }: { stats: ItemTextStat[]; locale: string }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-5">
      {stats.map((stat, index) => (
        <div key={index} className="flex min-w-0 items-center gap-2 border-b py-1.5">
          <StatArt stat={stat} size={22} />
          <dt className="min-w-0 flex-1 text-sm">
            <span className="flex flex-wrap items-center gap-x-1.5">
              {stat.label}
              {stat.unique && <UniqueTag />}
            </span>
            {stat.note && <span className="type-meta block">{stat.note}</span>}
          </dt>
          <dd className="text-sm font-semibold tabular-nums">{formatItemStatValue(stat, locale)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The stats of a card in one line of icons and numbers; the label stays available to hover and screen readers. */
export function ItemStatChips({
  stats,
  locale,
  limit = 4,
  className,
}: {
  stats: ItemTextStat[]
  locale: string
  limit?: number
  className?: string
}) {
  if (!stats.length) return null
  return (
    <span className={cn("flex flex-wrap gap-x-2 gap-y-0.5", className)}>
      {stats.slice(0, limit).map((stat, index) => (
        <span
          key={index}
          title={`${formatItemStatValue(stat, locale)} ${stat.label}`}
          className="inline-flex items-center gap-0.5 text-xs tabular-nums"
        >
          <StatArt stat={stat} size={14} />
          {formatItemStatValue(stat, locale)}
          <span className="sr-only">{stat.label}</span>
        </span>
      ))}
    </span>
  )
}

/** Passive effects with their names pulled out, followed by any flavour text. */
export function ItemPassiveList({
  content,
  renderText,
  language,
}: {
  content: Pick<ItemTextContent, "passives" | "notes">
  renderText: (value: string, locale: string) => ReactNode
  language: string
}) {
  const t = useWarehouseText()
  return (
    <div className="space-y-3">
      {content.passives.map((passive, index) => (
        <div key={index} className="space-y-0.5">
          {(passive.name || passive.unique) && (
            <h4 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {passive.name}
              {passive.unique && <UniqueTag />}
            </h4>
          )}
          <div className="type-body">{renderText(passive.text, language)}</div>
        </div>
      ))}
      {content.passives.some((passive) => passive.unique) && (
        <p className="type-meta">
          {t(
            "Duy nhất: nhiều món cùng nội tại này không cộng dồn.",
            "Unique: several items with this passive do not stack.",
          )}
        </p>
      )}
      {content.notes.map((note, index) => (
        <p key={index} className="type-meta italic">
          {note}
        </p>
      ))}
    </div>
  )
}

/** Stat chips for narrowing a catalog; several together mean an item must give all of them. */
export function ItemStatFilter({
  value,
  counts,
  onChange,
  className,
}: {
  value: readonly string[]
  /** How many items would match with this chip on. Chips that match nothing are left out unless already on. */
  counts: Readonly<Record<string, number>>
  onChange: (value: string[]) => void
  className?: string
}) {
  const t = useWarehouseText()
  const options = ITEM_STAT_FILTERS.filter((filter) => counts[filter.key] || value.includes(filter.key))
  if (!options.length) return null
  return (
    <div
      role="group"
      aria-label={t("Lọc theo chỉ số", "Filter by stat")}
      className={cn("flex flex-wrap gap-1", className)}
    >
      {options.map((filter) => {
        const active = value.includes(filter.key)
        const Art = gameplayIcons[filter.icon]
        return (
          <button
            key={filter.key}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border px-2 text-sm transition-colors",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-transparent bg-muted/60 text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(active ? value.filter((key) => key !== filter.key) : [...value, filter.key])}
          >
            <Art size={18} />
            {t(filter.vi, filter.en)}
            <span className="text-xs tabular-nums text-muted-foreground">{counts[filter.key] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
