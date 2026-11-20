import type { ReactNode } from "react"
import { Hourglass, Layers } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import {
  formatItemStatValue,
  itemEffectFacts,
  ITEM_STAT_FILTERS,
  type ItemTextContent,
  type ItemTextStat,
} from "@aov/ui/lib/item-description"
import { ItemStatIcon } from "./item-stat-icons"
import { useWarehouseText } from "./warehouse-view"

function StatArt({ stat, size }: { stat: Pick<ItemTextStat, "key">; size: number }) {
  return <ItemStatIcon group={statFilterKey(stat)} size={size} className="shrink-0" />
}

/** The reader-facing stat group a stat belongs to (`ITEM_STAT_FILTERS`), for pages that mark each group. */
function statFilterKey(stat: Pick<ItemTextStat, "key">) {
  return ITEM_STAT_FILTERS.find((filter) => stat.key && filter.stats.includes(stat.key))?.key
}

function PassiveTag({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 text-xs font-medium whitespace-nowrap",
        strong ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}

/** A figure pulled out of an effect, such as its cooldown, as a small chip under its text. */
function EffectFact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background/60 px-2 py-0.5 text-xs text-foreground tabular-nums [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
      {icon}
      {children}
    </span>
  )
}

function UniqueTag() {
  const t = useWarehouseText()
  return <PassiveTag>{t("Duy nhất", "Unique")}</PassiveTag>
}

/** Every stat with its icon and value, one to a row so numbers line up for comparison. */
export function ItemStatList({
  stats,
}: {
  stats: ItemTextStat[]
  /** @deprecated Stats are written as the game writes them, so the locale no longer changes them. */
  locale?: string
}) {
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
          <dd className="text-sm font-semibold tabular-nums">{formatItemStatValue(stat)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The stats of a card in one line of icons and numbers; the label stays available to hover and screen readers. */
export function ItemStatChips({
  stats,
  limit = 4,
  className,
}: {
  stats: ItemTextStat[]
  /** @deprecated Stats are written as the game writes them, so the locale no longer changes them. */
  locale?: string
  limit?: number
  className?: string
}) {
  if (!stats.length) return null
  return (
    <span className={cn("flex flex-wrap gap-x-2 gap-y-0.5", className)}>
      {stats.slice(0, limit).map((stat, index) => (
        <span
          key={index}
          title={`${formatItemStatValue(stat)} ${stat.label}`}
          className="item-stat-chip inline-flex items-center gap-0.5 text-xs tabular-nums"
        >
          <StatArt stat={stat} size={14} />
          {formatItemStatValue(stat)}
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
    <div className="space-y-2">
      {content.passives.map((passive, index) => {
        const facts = itemEffectFacts(passive.text)
        return (
          <div key={index} className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
            <h4 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {passive.name}
              <PassiveTag strong={passive.active}>
                {passive.active ? t("Kích hoạt", "Active") : t("Nội tại", "Passive")}
              </PassiveTag>
              {passive.unique && <UniqueTag />}
            </h4>
            <div className="type-body">{renderText(passive.text, language)}</div>
            {(facts.cooldownSeconds || facts.maxStacks) && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {facts.cooldownSeconds && (
                  <EffectFact icon={<Hourglass aria-hidden />}>
                    {t(`Hồi chiêu ${facts.cooldownSeconds} giây`, `Cooldown ${facts.cooldownSeconds} s`)}
                  </EffectFact>
                )}
                {facts.maxStacks && (
                  <EffectFact icon={<Layers aria-hidden />}>
                    {t(`Cộng dồn tối đa ${facts.maxStacks} lần`, `Stacks up to ${facts.maxStacks} times`)}
                  </EffectFact>
                )}
              </div>
            )}
          </div>
        )
      })}
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
