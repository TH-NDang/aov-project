import { Bookmark, Database } from "lucide-react"
import { PatchTimelineRail } from "@aov/ui/components/patch-timeline-rail"
import { cn } from "@aov/ui/lib/utils"
import type { Variant } from "../../api/publication-overview"
import {
  UNSCOPED_NAME,
  countText,
  currentVariantId,
  isCurrent,
  openGroupId,
  patchLabel,
  patchYear,
  pinnedSelection,
  releaseText,
  type SeasonGroup,
  type TimelineProps,
} from "./timeline-model"

type TrackProps = TimelineProps & { groups: SeasonGroup[] }

/**
 * The seasons as stops on one line. Only the season being read opens into its patches, so a history of a hundred
 * patches stays one short row at every width; the other seasons are a name and a patch count, and the season that
 * holds the current patch keeps that patch beside its name for a one-tap way back.
 */
export function SeasonTrack(props: TrackProps) {
  const { groups, value } = props
  const open = openGroupId(props, groups)
  const current = currentVariantId(props)
  return (
    <PatchTimelineRail selection={value.variantId || value.seasonId} label="Chọn patch">
      {groups.map((group) =>
        open === null || group.id === open ? (
          <SeasonChapter key={group.id || "unscoped"} {...props} group={group} />
        ) : (
          <ClosedSeason key={group.id || "unscoped"} {...props} group={group} current={current} />
        ),
      )}
    </PatchTimelineRail>
  )
}

/** A group without a season is named by the years its patches cover when they are named by date. */
function groupName(group: SeasonGroup) {
  if (group.id) return group.name
  const years = group.variants.map((variant) => patchYear(variant.patchCode)).filter(Boolean)
  if (years.length !== group.variants.length || !years.length) return group.name
  const first = years[0]
  const last = years[years.length - 1]
  return first === last ? first! : `${first}–${last}`
}

const stop =
  "inline-flex h-9 shrink-0 cursor-pointer items-center whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-7"

function ClosedSeason(props: TrackProps & { group: SeasonGroup; current?: string }) {
  const { group, onChange, current } = props
  const name = groupName(group)
  const now = group.variants.find((variant) => variant.id === current)
  const newest = group.variants[group.variants.length - 1]
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        data-season
        aria-label={group.id ? `Lọc mùa ${group.name}` : `Mở patch ${UNSCOPED_NAME.toLowerCase()}`}
        aria-pressed={false}
        title={`${group.id ? group.name : UNSCOPED_NAME} · ${group.variants.length} patch${group.current ? " · Đang áp dụng" : ""}`}
        data-count={group.variants.length || undefined}
        disabled={!group.id && !newest}
        onClick={() =>
          group.id
            ? onChange({ seasonId: group.id, variantId: "" })
            : newest && onChange({ seasonId: "", variantId: newest.id })
        }
        className={cn(
          stop,
          "gap-1.5 rounded-md bg-background px-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
          // A season none of whose patches changed anything here still opens, but reads as quiet.
          !group.variants.length && "opacity-60 hover:opacity-100",
          "after:text-xs after:font-normal after:text-muted-foreground/70 after:tabular-nums after:content-[attr(data-count)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rotate-45 border border-current opacity-70",
            (now || group.current) && "border-transparent bg-(--aov-success) opacity-100",
          )}
        />
        {name}
      </button>
      {now && <PatchChip {...props} variant={now} season={name} compact />}
    </div>
  )
}

function SeasonChapter(props: TrackProps & { group: SeasonGroup }) {
  const { group, value, onChange } = props
  const name = groupName(group)
  const whole = !!group.id && value.seasonId === group.id && !value.variantId
  let year: string | null = null
  return (
    <div
      data-chapter
      className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/25 bg-background p-0.5 shadow-sm sm:gap-1.5"
    >
      {/* The season's name stays at the edge while its patches are swiped past. */}
      <span className="sticky left-0 z-10 shrink-0 rounded-md bg-background">
        <button
          type="button"
          data-season
          aria-label={`Lọc mùa ${group.name}`}
          title={group.current ? `${group.name} · Đang áp dụng` : group.name}
          aria-pressed={whole}
          disabled={!group.id}
          onClick={() => onChange({ seasonId: group.id, variantId: "" })}
          className={cn(
            stop,
            "type-label rounded-md px-2 disabled:cursor-default",
            whole ? "bg-primary text-primary-foreground" : "bg-primary/12 text-primary enabled:hover:bg-primary/20",
          )}
        >
          {name}
        </button>
      </span>
      {group.variants.map((variant) => {
        // A group spanning years marks where each new year starts, since its chips show only day and month.
        const next = group.id ? null : patchYear(variant.patchCode)
        const mark = next && year && next !== year ? next : null
        if (next) year = next
        return (
          <span key={variant.id} className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {mark && (
              <span aria-hidden className="type-meta px-0.5 tabular-nums">
                {mark}
              </span>
            )}
            <PatchChip {...props} variant={variant} season={name} />
          </span>
        )
      })}
    </div>
  )
}

function PatchChip(props: TrackProps & { variant: Variant; season: string; compact?: boolean }) {
  const { data, value, onChange, variant, season, compact } = props
  const pressed = value.variantId === variant.id
  const pinned = pinnedSelection(props, variant.id)
  const current = isCurrent(data, variant) || props.currentFilter?.variantId === variant.id
  const counts = countText(props, variant)
  return (
    <button
      type="button"
      data-patch
      aria-pressed={pressed}
      aria-label={`Lọc patch ${variant.patchCode}`}
      title={[
        `${season} · ${variant.patchCode}${variant.status === "DRAFT" ? " · Nháp" : ""}`,
        current ? "Đang áp dụng" : releaseText(data, variant),
        pinned ? "Đang xem · Giữ trên thanh khi chưa có thay đổi" : null,
        counts,
      ]
        .filter(Boolean)
        .join("\n")}
      onClick={() => onChange({ seasonId: variant.seasonId ?? "", variantId: variant.id })}
      className={cn(
        stop,
        "max-w-52 gap-1 rounded-md border px-2 text-xs tabular-nums sm:gap-1.5",
        pressed
          ? "border-primary bg-background font-medium text-primary ring-3 ring-primary/15"
          : "bg-background hover:bg-accent",
        compact && !pressed && "border-dashed text-muted-foreground",
        variant.status === "DRAFT" && "border-dashed",
        pinned && "border-dashed border-(--aov-info)/60 bg-(--aov-info-soft) text-(--aov-info)",
      )}
    >
      {current && <span className="size-1.5 shrink-0 rounded-full bg-(--aov-success)" aria-hidden />}
      {pinned && <Bookmark className="size-3" aria-label="Mốc đã chọn" />}
      <span className="truncate">{patchLabel(variant.patchCode)}</span>
      {variant.status === "DRAFT" && <span className="type-meta text-(--aov-warning)">Nháp</span>}
      {!compact && <CountBadge props={props} variant={variant} />}
      <span className="sr-only">
        {current ? " · Đang áp dụng" : ""}
        {counts ? ` · ${counts}` : ""}
      </span>
    </button>
  )
}

function CountBadge({ props, variant }: { props: TimelineProps; variant: Variant }) {
  const count = props.counts?.get(variant.id)
  if (props.showCounts === false) return null
  if (!count || (!count.changes && !count.baseline)) return null
  if (!count.changes) return <Database className="size-3 text-muted-foreground" aria-hidden />
  return (
    <span className="rounded-full bg-primary/15 px-1.5 text-xs leading-4 text-primary tabular-nums" aria-hidden>
      {count.changes}
    </span>
  )
}
