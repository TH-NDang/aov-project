import { useEffect, useMemo, useRef } from "react"
import { ExternalLink, Maximize2, Pencil, Trash2 } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { GameView } from "../../model/game-view"
import {
  KIND_LABELS,
  clusterEvents,
  type EventCluster,
  type TimelineEvent,
  type TimelineKind,
} from "../../model/timeline"
import { formatClock } from "../../model/vod"
import { TimeTag, VideoMark } from "../primitives"
import { clusterTitle, type ItemLookups } from "./cluster-card"
import { EventLine } from "./event-line"

export type FeedFilter = "ALL" | TimelineKind

/** Moments a few seconds apart read as one fight or one shopping trip. */
const FEED_WINDOW = 5

export function EventFeed({
  game,
  events,
  at,
  activeId,
  filter,
  onFilter,
  follow,
  lookups,
  hiddenItems = 0,
  showAllItems = false,
  onShowAllItems,
  onSelect,
  onOpen,
  videoLink,
  videoAt,
  onEdit,
  onDelete,
  className,
}: {
  game: GameView
  events: TimelineEvent[]
  at: number
  activeId: string | null
  filter: FeedFilter
  onFilter: (filter: FeedFilter) => void
  /** Keeps the latest past moment in view while the video plays. */
  follow: boolean
  lookups: ItemLookups
  /** Lower-tier purchases hidden from the feed, offered behind a toggle. */
  hiddenItems?: number
  showAllItems?: boolean
  onShowAllItems?: (value: boolean) => void
  onSelect: (event: TimelineEvent) => void
  onOpen: (cluster: EventCluster) => void
  videoLink: (event: TimelineEvent) => string | null
  /** Position of a moment in the broadcast video, when the game is synced to it. */
  videoAt?: (event: TimelineEvent) => number | null
  onEdit?: (event: TimelineEvent) => void
  onDelete?: (event: TimelineEvent) => void
  className?: string
}) {
  const list = useRef<HTMLOListElement>(null)
  const counts = events.reduce<Record<string, number>>((total, event) => {
    total[event.kind] = (total[event.kind] ?? 0) + 1
    return total
  }, {})
  const groups = useMemo(
    () =>
      clusterEvents(
        events.filter((event) => filter === "ALL" || event.kind === filter),
        FEED_WINDOW,
      ),
    [events, filter],
  )
  const currentGroup = [...groups].reverse().find((group) => group.start <= at)?.id ?? null

  useEffect(() => {
    if (!follow || !currentGroup || !list.current) return
    const item = list.current.querySelector<HTMLElement>(`[data-group="${CSS.escape(currentGroup)}"]`)
    if (!item) return
    const top = item.offsetTop - list.current.offsetTop
    if (top < list.current.scrollTop || top > list.current.scrollTop + list.current.clientHeight - item.clientHeight)
      list.current.scrollTo({ top: Math.max(0, top - list.current.clientHeight / 3), behavior: "smooth" })
  }, [currentGroup, follow])

  return (
    <section
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card", className)}
      aria-label="Diễn biến"
    >
      <div className="flex items-center gap-1 overflow-x-auto border-b px-2 py-2">
        {(["ALL", "KILL", "OBJECTIVE", "ITEM", "NOTE"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition",
              filter === value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {value === "ALL" ? "Tất cả" : KIND_LABELS[value]}
            <span className="esp-num opacity-60">{value === "ALL" ? events.length : (counts[value] ?? 0)}</span>
          </button>
        ))}
      </div>
      <p className="flex items-center gap-3 border-b px-3 py-1 text-[10px] text-muted-foreground">
        <span>⏱ giờ trong trận</span>
        <span>
          <VideoMark /> vị trí trên video
        </span>
      </p>
      {onShowAllItems && (hiddenItems > 0 || showAllItems) && (
        <label className="flex items-center gap-2 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={showAllItems} onChange={(event) => onShowAllItems(event.target.checked)} />
          Hiện cả trang bị cấp 1–2{!showAllItems && ` (${hiddenItems} đang ẩn)`}
        </label>
      )}
      <ol ref={list} className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((group) => {
          const title = clusterTitle(group)
          return (
            <li
              key={group.id}
              data-group={group.id}
              className="esp-feed-item border-b px-2 py-1.5 last:border-b-0"
              data-current={group.id === currentGroup}
              data-future={group.start > at}
            >
              {title && (
                <div className="flex items-center gap-2 px-1 pb-1 text-[11px] font-semibold text-muted-foreground">
                  <span className="esp-num">
                    <TimeTag kind="game" seconds={group.start} /> – <TimeTag kind="game" seconds={group.end} />
                  </span>
                  <span className="text-foreground">{title}</span>
                </div>
              )}
              <ul>
                {group.events.map((event) => {
                  const link = videoLink(event)
                  return (
                    <li key={event.id} data-event={event.id} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect(event)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-muted/70",
                          activeId === event.id && "bg-[var(--esp-gold-soft)]",
                        )}
                        aria-label={`Tới ${formatClock(event.at)} trong trận`}
                      >
                        <span className="flex w-14 shrink-0 flex-col text-xs font-semibold text-muted-foreground">
                          <TimeTag kind="game" seconds={event.at} className="text-foreground" />
                          {videoAt && (
                            <TimeTag kind="video" seconds={videoAt(event)} className="text-[10px] font-normal" />
                          )}
                        </span>
                        <EventLine
                          event={event}
                          game={game}
                          itemIcon={lookups.itemIcon}
                          itemTier={lookups.itemTier}
                          size={28}
                        />
                      </button>
                      <span className="flex shrink-0 items-center opacity-50 transition group-hover:opacity-100">
                        <button
                          type="button"
                          className="grid size-6 place-items-center rounded hover:bg-muted"
                          onClick={() => onOpen(group)}
                          aria-label="Xem chi tiết"
                          title="Xem chi tiết"
                        >
                          <Maximize2 size={12} />
                        </button>
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="grid size-6 place-items-center rounded hover:bg-muted"
                            title="Mở đúng thời điểm trên YouTube"
                            aria-label="Mở trên YouTube"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            className="grid size-6 place-items-center rounded hover:bg-muted"
                            onClick={() => onEdit(event)}
                            aria-label="Sửa sự kiện"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            className="grid size-6 place-items-center rounded hover:bg-muted hover:text-destructive"
                            onClick={() => onDelete(event)}
                            aria-label="Xóa sự kiện"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
        {!groups.length && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {events.length ? "Không có sự kiện trong nhóm này." : "Chưa ghi diễn biến cho ván này."}
          </li>
        )}
      </ol>
    </section>
  )
}
