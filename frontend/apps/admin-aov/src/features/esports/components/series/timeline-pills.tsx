import type { Dispatch, SetStateAction } from "react"
import { Maximize2, Play } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { formatClock } from "@/lib/clock"
import type { RetimeTarget } from "../../model/broadcast-timeline"
import type { GameView } from "../../model/game-view"
import { chapterAt, chapterClock, sourceOf, type GameChapter } from "../../model/series-vod"
import { leadEvent, type EventCluster, type TimelineEvent } from "../../model/timeline"
import { ClusterCard, clusterTitle, type ItemLookups } from "../game/cluster-card"
import { describeEvent } from "../game/event-text"
import { MarkerPill } from "../game/marker-pill"
import { PILL_PX, ROW_TOP } from "./timeline-rows"
import type { MarkerDrag } from "./use-marker-drag"

/**
 * The moments on the track, one pill per cluster of moments too close to tell apart at this zoom. Hovering a pill
 * opens its card with the moments in it; a pill of a single moment of the focused game can be dragged.
 */
export function EventPills({
  clusters,
  chapters,
  views,
  lookups,
  duration,
  current,
  activeId,
  isDimmed,
  editingGameId,
  markers,
  card,
  onCard,
  onSelect,
  onOpen,
}: {
  clusters: EventCluster[]
  chapters: GameChapter[]
  views: Record<string, GameView>
  lookups: ItemLookups
  duration: number
  current: number
  activeId: string | null
  isDimmed: (event: TimelineEvent) => boolean
  /** The game recorded in, whose pills say how they move. */
  editingGameId: string | undefined
  markers: Pick<MarkerDrag, "marker" | "shownAt" | "drag">
  /** The cluster whose card is open. */
  card: string | null
  onCard: Dispatch<SetStateAction<string | null>>
  onSelect: (event: TimelineEvent) => void
  onOpen: (cluster: EventCluster) => void
}) {
  return (
    <>
      {clusters.map((cluster) => {
        const lead = leadEvent(cluster)
        const source = sourceOf(cluster.id)
        const view = views[source.gameId]
        if (!view) return null
        const title = clusterTitle(cluster)
        const text = describeEvent(lead, view)
        // Several moments drawn as one pill have no single second to move; zooming in separates them.
        const only = cluster.events.length === 1 ? sourceOf(cluster.events[0].id) : null
        const target: RetimeTarget | null = only ? { kind: "event", gameId: only.gameId, id: only.id } : null
        const pill = markers.marker(target, cluster.start, () => onSelect(cluster.events[0]), cluster.id)
        const left = (markers.shownAt(pill.key, cluster.start) / duration) * 100
        return (
          <HoverCard
            key={cluster.id}
            openDelay={80}
            closeDelay={120}
            open={card === cluster.id && !markers.drag}
            onOpenChange={(open) => onCard((shown) => (open ? cluster.id : shown === cluster.id ? null : shown))}
          >
            <HoverCardTrigger asChild>
              <button
                type="button"
                {...pill.props}
                className="esp-pill"
                data-at={cluster.start}
                data-side={cluster.side ?? undefined}
                data-kind={lead.kind}
                data-active={cluster.events.some((event) => event.id === activeId)}
                data-dim={cluster.events.every(isDimmed)}
                data-past={cluster.start <= current}
                style={{
                  left: `clamp(${PILL_PX / 2}px, ${left}%, calc(100% - ${PILL_PX / 2}px))`,
                  top: ROW_TOP[cluster.lane as keyof typeof ROW_TOP] ?? ROW_TOP.MID,
                }}
                aria-label={`${formatClock(cluster.start)} · ${title ?? `${text.title}: ${text.detail}`}`}
                onDragStart={(event) => event.preventDefault()}
              >
                <MarkerPill cluster={cluster} game={view} lookups={lookups} />
                {cluster.events.length > 1 && <span className="esp-marker-count">{cluster.events.length}</span>}
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side={cluster.lane === "RED" ? "bottom" : "top"}
              className="w-[400px] max-w-[calc(100vw-2rem)] p-3"
            >
              <ClusterCard
                cluster={cluster}
                game={view}
                lookups={lookups}
                activeId={activeId}
                onSelect={onSelect}
                videoTime={(event) => event.at}
                clock={(event) => {
                  const chapter = chapterAt(chapters, event.at)
                  return chapter ? chapterClock(chapter, event.at) : event.at
                }}
                size={28}
                footer={
                  <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background"
                      onClick={() => onSelect(cluster.events[0])}
                    >
                      <Play size={12} /> Tới mốc này
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                      onClick={() => onOpen(cluster)}
                    >
                      <Maximize2 size={12} /> Xem chi tiết
                    </button>
                    {editingGameId !== undefined && source.gameId === editingGameId && (
                      <span className="text-xs text-muted-foreground">
                        {pill.canMove ? "Kéo mốc để đổi giây" : "Phóng to để kéo từng mốc"}
                      </span>
                    )}
                  </div>
                }
              />
            </HoverCardContent>
          </HoverCard>
        )
      })}
    </>
  )
}
