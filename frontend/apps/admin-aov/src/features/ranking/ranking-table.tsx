import { ArrowDown, ArrowUp, ArrowUpDown, Check, Flag } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import type { RankingDetail, RankingMetric, RankingValue } from "./ranking-api"
import {
  COUNTERS,
  FIGURE_COLUMNS,
  METRICS,
  RATE_COLUMNS,
  ROLE_LABELS,
  change,
  formatChange,
  formatValue,
  tierChange,
  type RankingRow,
  type RankingView,
  type SortKey,
} from "./ranking-model"
import type { OpenValue } from "./value-panel"

export function HeroFace({
  code,
  name,
  heads,
  className,
}: {
  code: string
  name: string
  heads: Map<string, string> | undefined
  className?: string
}) {
  const url = heads?.get(code)
  return url ? (
    <img src={url} alt="" loading="lazy" className={cn("shrink-0 rounded-md bg-muted object-cover", className)} />
  ) : (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-md bg-muted text-xs text-muted-foreground", className)}
    >
      {name.slice(0, 1)}
    </span>
  )
}

const TIER_STYLES: Record<string, string> = {
  T0: "bg-primary text-primary-foreground",
  T1: "bg-secondary text-foreground ring-1 ring-primary/60",
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        "inline-grid h-6 min-w-9 place-items-center rounded-md px-1.5 text-xs font-semibold tabular-nums",
        TIER_STYLES[tier] ?? "border border-border text-muted-foreground",
      )}
    >
      {tier}
    </span>
  )
}

function Change({ metric, delta }: { metric: RankingMetric; delta: number | null }) {
  if (delta == null) return null
  const good = METRICS[metric].higherIsBetter
  const tone =
    delta === 0
      ? "text-muted-foreground"
      : good
        ? delta > 0
          ? "text-[var(--aov-success)]"
          : "text-[var(--aov-danger)]"
        : "text-muted-foreground"
  return <span className={cn("block text-xs tabular-nums", tone)}>{formatChange(metric, delta)}</span>
}

function ValueButton({
  value,
  label,
  active,
  onOpen,
  children,
  className,
}: {
  value: RankingValue | undefined
  label: string
  active: boolean
  onOpen: () => void
  children: React.ReactNode
  className?: string
}) {
  const flagged = value?.needsReview
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={!value}
      onClick={onOpen}
      className={cn(
        "relative w-full rounded-md px-2 py-1 text-right tabular-nums transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:hover:bg-transparent",
        flagged && "bg-[var(--aov-warning-soft)] hover:bg-[var(--aov-warning-soft)]",
        active && "outline-2 outline-[var(--aov-accent)]",
        className,
      )}
    >
      {children}
      {flagged ? (
        <Flag aria-hidden className="absolute top-1 left-1 size-3 text-[var(--aov-warning)]" />
      ) : value?.reviewedAt ? (
        <Check aria-hidden className="absolute top-1 left-1 size-3 text-[var(--aov-success)]" />
      ) : null}
    </button>
  )
}

function SortHeader({
  sortKey,
  view,
  onSort,
  children,
  align = "right",
  className,
}: {
  sortKey: SortKey
  view: RankingView
  onSort: (key: SortKey) => void
  children: React.ReactNode
  align?: "left" | "right" | "center"
  className?: string
}) {
  const active = view.sort === sortKey
  const Icon = !active ? ArrowUpDown : view.descending ? ArrowDown : ArrowUp
  return (
    <th
      scope="col"
      aria-sort={active ? (view.descending ? "descending" : "ascending") : "none"}
      className={cn(
        "px-1 py-2 whitespace-nowrap",
        align === "right" ? "text-right" : align === "center" && "text-center",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1 py-0.5 type-label hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        <Icon aria-hidden className="size-3.5" />
      </button>
    </th>
  )
}

/**
 * Every hero of a snapshot in one table, as the two game boards side by side. Each number opens its screenshot; a
 * flag marks values that wait for review and a tick those an editor already checked.
 */
export function RankingTable({
  detail,
  rows,
  view,
  heads,
  open,
  scope,
  onSort,
  onOpen,
}: {
  detail: RankingDetail
  rows: RankingRow[]
  view: RankingView
  heads: Map<string, string> | undefined
  open: OpenValue | null
  scope: string
  onSort: (key: SortKey) => void
  onOpen: (value: OpenValue) => void
}) {
  const revealed = useRevealedRows(rows, scope, 40)
  const names = new Map(detail.heroes.map((hero) => [hero.heroId, hero]))
  const isOpen = (heroId: string, metric: RankingMetric) => open?.heroId === heroId && open.metric === metric
  const comparing = rows[0]?.comparing ?? false

  return (
    <div className="max-h-[calc(100dvh-17rem)] min-h-80 overflow-auto rounded-lg border">
      <table className="w-full min-w-[1080px] border-separate border-spacing-0 type-body">
        <thead className="sticky top-0 z-20 bg-background">
          <tr className="type-meta text-muted-foreground">
            <th className="sticky left-0 z-30 bg-background" />
            <th colSpan={4} className="border-l px-2 pt-2 text-left">
              Bảng Tỷ lệ
            </th>
            <th className="border-l px-2 pt-2 text-left">Thắng nhiều khi gặp</th>
            <th colSpan={5} className="border-l px-2 pt-2 text-left">
              Bảng Chỉ số · trung bình mỗi trận
            </th>
          </tr>
          <tr className="[&>th]:border-b">
            <SortHeader
              sortKey="POSITION"
              view={view}
              onSort={onSort}
              align="left"
              className="sticky left-0 z-30 bg-background px-2"
            >
              Tướng · thứ tự trên game
            </SortHeader>
            <SortHeader sortKey="TIER" view={view} onSort={onSort} align="center">
              Tier
            </SortHeader>
            {RATE_COLUMNS.map((metric) => (
              <SortHeader key={metric} sortKey={metric} view={view} onSort={onSort}>
                {METRICS[metric].short} %
              </SortHeader>
            ))}
            <th scope="col" className="border-l px-2 py-2 text-left type-label text-muted-foreground">
              Chân dung
            </th>
            {FIGURE_COLUMNS.map((metric) => (
              <SortHeader key={metric} sortKey={metric} view={view} onSort={onSort}>
                {METRICS[metric].short}
              </SortHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {revealed.rows.map((row) => {
            const { hero } = row
            const tierDelta = tierChange(row)
            return (
              <tr key={hero.heroId} className="group [&>td]:border-b [&>td]:border-border/60">
                <td className="sticky left-0 z-10 bg-background px-2 py-1.5 group-hover:bg-muted">
                  <div className="flex min-w-48 items-center gap-2">
                    <span className="w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {hero.ratesPosition ?? "—"}
                    </span>
                    <HeroFace code={hero.heroCode} name={hero.nameOnScreen} heads={heads} className="size-8" />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-sm font-medium">{hero.nameOnScreen}</div>
                      <div className="type-meta text-muted-foreground">
                        {ROLE_LABELS[hero.roleOnScreen]}
                        {comparing && !row.previous && <span className="ml-1 text-[var(--aov-info)]">· mới</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="border-l px-1 py-1 text-center">
                  <ValueButton
                    value={row.values.TIER}
                    label={`${hero.nameOnScreen}, tier ${formatValue(row.values.TIER)}`}
                    active={isOpen(hero.heroId, "TIER")}
                    onOpen={() => onOpen({ heroId: hero.heroId, metric: "TIER" })}
                    className="text-center"
                  >
                    <TierBadge tier={row.values.TIER?.tier ?? null} />
                    {tierDelta ? (
                      <span
                        className={cn(
                          "block text-xs",
                          tierDelta > 0 ? "text-[var(--aov-success)]" : "text-[var(--aov-danger)]",
                        )}
                      >
                        {tierDelta > 0 ? "▲" : "▼"} từ {row.previous?.TIER?.tier}
                      </span>
                    ) : null}
                  </ValueButton>
                </td>
                {RATE_COLUMNS.map((metric) => (
                  <td key={metric} className="px-1 py-1">
                    <ValueButton
                      value={row.values[metric]}
                      label={`${hero.nameOnScreen}, ${METRICS[metric].label} ${formatValue(row.values[metric])}`}
                      active={isOpen(hero.heroId, metric)}
                      onOpen={() => onOpen({ heroId: hero.heroId, metric })}
                    >
                      {formatValue(row.values[metric])}
                      {comparing && <Change metric={metric} delta={change(row, metric)} />}
                    </ValueButton>
                  </td>
                ))}
                <td className="border-l px-2 py-1">
                  <div className="flex items-center gap-1">
                    {COUNTERS.map((metric) => {
                      const value = row.values[metric]
                      const counter = value?.heroId ? names.get(value.heroId) : undefined
                      return (
                        <button
                          key={metric}
                          type="button"
                          disabled={!value}
                          aria-pressed={isOpen(hero.heroId, metric)}
                          aria-label={`${hero.nameOnScreen} thắng nhiều khi gặp ${counter?.nameOnScreen ?? "chưa rõ"}`}
                          title={counter?.nameOnScreen ?? "Chưa rõ"}
                          onClick={() => onOpen({ heroId: hero.heroId, metric })}
                          className={cn(
                            "relative rounded-full p-0.5 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                            value?.needsReview && "ring-2 ring-[var(--aov-warning)]",
                            isOpen(hero.heroId, metric) && "outline-2 outline-[var(--aov-accent)]",
                          )}
                        >
                          <HeroFace
                            code={counter?.heroCode ?? ""}
                            name={counter?.nameOnScreen ?? "?"}
                            heads={heads}
                            className="size-7 rounded-full"
                          />
                        </button>
                      )
                    })}
                  </div>
                </td>
                {FIGURE_COLUMNS.map((metric, index) => (
                  <td key={metric} className={cn("px-1 py-1", index === 0 && "border-l")}>
                    <ValueButton
                      value={row.values[metric]}
                      label={`${hero.nameOnScreen}, ${METRICS[metric].label} ${formatValue(row.values[metric])}`}
                      active={isOpen(hero.heroId, metric)}
                      onOpen={() => onOpen({ heroId: hero.heroId, metric })}
                    >
                      {formatValue(row.values[metric])}
                      {comparing && <Change metric={metric} delta={change(row, metric)} />}
                    </ValueButton>
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rows.length && (
        <p className="p-6 text-center type-body text-muted-foreground">Không có tướng nào khớp bộ lọc.</p>
      )}
      <InfiniteScroll query={revealed.loader} label="Đang hiện thêm tướng" />
    </div>
  )
}
