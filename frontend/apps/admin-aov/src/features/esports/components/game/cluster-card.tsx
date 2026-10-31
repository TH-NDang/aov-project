import type { ReactNode } from "react"
import { cn } from "@aov/ui/lib/utils"
import type { GameView } from "../../model/game-view"
import { clusterKills, type EventCluster, type ItemRef, type TimelineEvent } from "../../model/timeline"
import { TimeTag } from "../primitives"
import { EventLine } from "./event-line"

export type ItemLookups = {
  itemIcon: (item: ItemRef) => string | null | undefined
  itemTier: (item: ItemRef) => number | null | undefined
}

export function clusterTitle(cluster: EventCluster) {
  const kills = clusterKills(cluster)
  const total = kills.BLUE + kills.RED
  if (total > 1) return `Giao tranh · ${kills.BLUE}–${kills.RED}`
  if (cluster.events.length > 1) return `${cluster.events.length} diễn biến liên tiếp`
  return null
}

/** Everything that happened around one moment, drawn as kill-feed lines; used in hover cards, the feed and dialogs. */
export function ClusterCard({
  cluster,
  game,
  lookups,
  activeId,
  onSelect,
  footer,
  clock = (event) => event.at,
  videoTime,
  size = 32,
}: {
  cluster: EventCluster
  game: GameView
  lookups: ItemLookups
  activeId?: string | null
  onSelect?: (event: TimelineEvent) => void
  footer?: ReactNode
  /** Game clock to show for an event; events on the video axis convert back here. */
  clock?: (event: TimelineEvent) => number
  /** Broadcast position of an event, shown under its game clock. */
  videoTime?: (event: TimelineEvent) => number | null
  size?: number
}) {
  const title = clusterTitle(cluster)
  const first = clock(cluster.events[0])
  const last = clock(cluster.events.at(-1)!)
  return (
    <div className="space-y-2">
      <p className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="esp-num rounded bg-muted px-1.5 py-0.5">
          <TimeTag kind="game" seconds={first} />
          {last > first && (
            <>
              {" – "}
              <TimeTag kind="game" seconds={last} />
            </>
          )}
        </span>
        {title && <span className="text-muted-foreground">{title}</span>}
      </p>
      <ul className="space-y-1">
        {cluster.events.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(event)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition",
                onSelect && "hover:bg-muted",
                activeId === event.id && "bg-[var(--esp-gold-soft)]",
              )}
            >
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                <TimeTag kind="game" seconds={clock(event)} />
                {videoTime && <TimeTag kind="video" seconds={videoTime(event)} className="block text-xs" />}
              </span>
              <EventLine
                event={event}
                game={game}
                itemIcon={lookups.itemIcon}
                itemTier={lookups.itemTier}
                size={size}
              />
            </button>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  )
}
