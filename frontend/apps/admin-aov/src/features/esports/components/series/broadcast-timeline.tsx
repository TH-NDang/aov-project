import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import type { Selection } from "@aov/community-contracts"
import { Ban, Crosshair, Flag, Lock, Maximize2, Minimize2, Play, ZoomIn, ZoomOut } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import type { BroadcastChapter } from "../../model/broadcast-timeline"
import type { GameView } from "../../model/game-view"
import { chapterAt, chapterClock, sourceOf, type GameChapter } from "../../model/series-vod"
import { clusterEvents, eventSide, leadEvent, type EventCluster, type TimelineEvent } from "../../model/timeline"
import { formatClock } from "../../model/vod"
import { ClusterCard, clusterTitle, type ItemLookups } from "../game/cluster-card"
import { describeEvent } from "../game/event-text"
import { MarkerPill } from "../game/marker-pill"
import { HeroIcon, TeamLogo, TimeTag, VIDEO_MARK } from "../primitives"

/** Pill width in pixels; markers closer than this on screen merge into one cluster per row. */
const PILL_PX = 76
/** Row centres inside the detail track (px): blue kills/items, objectives and notes, red kills/items. */
const ROW_TOP = { BLUE: 48, MID: 84, RED: 120 } as const

function tickStep(duration: number, width: number) {
  const target = duration / Math.max(2, Math.floor(width / 85))
  return [30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400].find((step) => step >= target) ?? 28800
}

const rowOf = (event: TimelineEvent) =>
  event.kind === "OBJECTIVE" || event.kind === "NOTE" ? "MID" : (eventSide(event) ?? "MID")

/**
 * Timeline of the whole broadcast. The overview always shows the full video with every game as a chapter; the
 * detail track below can be zoomed and scrolled, with blue and red rows for kills and items and a middle row for
 * objectives, so a single moment is readable without hovering.
 */
export function BroadcastTimeline({
  duration,
  current,
  chapters,
  flags = [],
  events,
  views,
  chapterTitle,
  focusedGameId,
  activeId,
  isDimmed,
  lookups,
  label = "Dòng thời gian video",
  heroIcon,
  onSeek,
  onSelect,
  onOpen,
}: {
  duration: number
  current: number
  chapters: GameChapter[]
  flags?: BroadcastChapter[]
  /** Moments already converted to video seconds (see `broadcastEvents`). */
  events: TimelineEvent[]
  views: Record<string, GameView>
  chapterTitle: (chapter: GameChapter) => string
  focusedGameId: string | null
  activeId: string | null
  isDimmed: (event: TimelineEvent) => boolean
  lookups: ItemLookups
  label?: string
  /** Icon of a hero taken in a ban/pick turn. */
  heroIcon?: (hero: Selection) => string | null | undefined
  onSeek: (second: number) => void
  onSelect: (event: TimelineEvent) => void
  onOpen: (cluster: EventCluster) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(() => (duration > 3600 ? 4 : 1))
  const [width, setWidth] = useState(800)
  const [scroll, setScroll] = useState({ left: 0, visible: 1 })
  const [scrub, setScrub] = useState<number | null>(null)
  const pointer = useRef<{ x: number; drag: boolean } | null>(null)

  useEffect(() => {
    const element = track.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 800))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const scrollTo = (second: number, behavior: ScrollBehavior = "auto") => {
    const element = viewport.current
    if (!element) return
    const position = (second / duration) * (track.current?.clientWidth ?? 0)
    element.scrollTo?.({ left: position - element.clientWidth / 2, behavior })
  }
  // Keep the playhead in view after jumps and when the scale changes.
  const previous = useRef(current)
  useEffect(() => {
    const jumped = Math.abs(current - previous.current) > 2
    previous.current = current
    const element = viewport.current
    if (!jumped || !element) return
    const position = (current / duration) * (track.current?.clientWidth ?? 0)
    if (position < element.scrollLeft || position > element.scrollLeft + element.clientWidth) scrollTo(current)
  }, [current, duration])
  useEffect(() => scrollTo(current), [zoom])

  const mergeWindow = Math.max(3, (PILL_PX / width) * duration)
  const clusters = useMemo(() => clusterEvents(events, mergeWindow, rowOf), [events, mergeWindow])
  const step = tickStep(duration, width)
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, index) => index * step)
  if (ticks.at(-1) !== duration) {
    if (ticks.length > 1 && duration - ticks[ticks.length - 1] < step * 0.5) ticks.pop()
    ticks.push(duration)
  }
  const pct = (second: number) => `${Math.min(100, Math.max(0, (second / duration) * 100))}%`
  const here = chapterAt(chapters, current)
  const focused = chapters.find((chapter) => chapter.gameId === focusedGameId) ?? here

  const fitChapter = (chapter: GameChapter) => {
    const wanted = duration / ((chapter.end - chapter.from) * 1.15)
    const next = [1, 2, 4, 8, 16, 32].filter((value) => value <= wanted).at(-1) ?? 1
    setZoom(next)
    window.requestAnimationFrame?.(() => scrollTo((chapter.from + chapter.end) / 2))
  }

  const secondAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration)
  }
  const interactive = (target: EventTarget) => !!(target as HTMLElement).closest("[data-marker], [data-chapter]")
  // Mouse seeks and drags immediately; touch seeks on tap so swiping still scrolls the zoomed track.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactive(event.target)) return
    const touch = (event as { pointerType?: string }).pointerType === "touch"
    pointer.current = { x: event.clientX, drag: !touch }
    if (touch) return
    onSeek(secondAt(event.clientX))
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic or already-released pointers cannot be captured; dragging still works inside the track.
    }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactive(event.target)) return setScrub(null)
    const second = secondAt(event.clientX)
    setScrub(second)
    if (pointer.current?.drag) onSeek(second)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointer.current
    pointer.current = null
    if (start && !start.drag && Math.abs(event.clientX - start.x) < 8) onSeek(secondAt(event.clientX))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-auto flex items-center gap-2 text-muted-foreground">
          <TimeTag kind="video" seconds={current} className="font-semibold text-foreground" />
          {here ? (
            <span>
              Ván {here.number} <TimeTag kind="game" seconds={chapterClock(here, current)} />
            </span>
          ) : (
            <span>Ngoài ván đấu</span>
          )}
          <span className="hidden text-[10px] @2xl:inline">· trục ngang là vị trí trên video</span>
        </span>
        {focused && (
          <button type="button" className="esp-bt-button" onClick={() => fitChapter(focused)}>
            <Crosshair size={13} /> Vừa ván {focused.number}
          </button>
        )}
        <button type="button" className="esp-bt-button" onClick={() => setZoom(1)}>
          <Minimize2 size={13} /> Toàn video
        </button>
        <span className="flex items-center rounded-md border">
          <button
            type="button"
            className="p-1.5 hover:bg-muted disabled:opacity-40"
            aria-label="Thu nhỏ timeline"
            disabled={zoom === 1}
            onClick={() => setZoom((value) => Math.max(1, value / 2))}
          >
            <ZoomOut size={14} />
          </button>
          <span className="esp-num min-w-8 text-center" aria-label="Mức phóng timeline">
            {zoom}×
          </span>
          <button
            type="button"
            className="p-1.5 hover:bg-muted disabled:opacity-40"
            aria-label="Phóng to timeline"
            disabled={zoom === 32}
            onClick={() => setZoom((value) => Math.min(32, value * 2))}
          >
            <ZoomIn size={14} />
          </button>
        </span>
      </div>

      {/* Overview: the whole video, games as chapters, the zoomed window and the playhead. */}
      <div
        className="esp-bt-overview"
        aria-hidden="true"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const second = Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * duration)
          onSeek(second)
          scrollTo(second, "smooth")
        }}
      >
        {chapters.map((chapter) =>
          chapter.draft ? (
            <span
              key={`draft-${chapter.gameId}`}
              className="esp-bt-overview-draft"
              style={{ left: pct(chapter.draft.start), width: pct(chapter.start - chapter.draft.start) }}
            />
          ) : null,
        )}
        {chapters.map((chapter) => (
          <span
            key={chapter.gameId}
            className="esp-bt-overview-chapter"
            data-focused={chapter.gameId === focused?.gameId || undefined}
            data-synced={chapter.synced || undefined}
            style={{ left: pct(chapter.start), width: `calc(${pct(chapter.end - chapter.start)} + 1px)` }}
          >
            V{chapter.number}
          </span>
        ))}
        {events.map((event) =>
          event.kind === "KILL" || event.kind === "OBJECTIVE" ? (
            <span
              key={event.id}
              className="esp-bt-overview-tick"
              data-side={eventSide(event) ?? undefined}
              data-kind={event.kind}
              style={{ left: pct(event.at) }}
            />
          ) : null,
        )}
        {zoom > 1 && (
          <span
            className="esp-bt-overview-window"
            style={{ left: `${scroll.left * 100}%`, width: `${scroll.visible * 100}%` }}
          />
        )}
        <span className="esp-bt-overview-playhead" style={{ left: pct(current) }} />
      </div>

      <div
        ref={viewport}
        className="overflow-x-auto pt-5 pb-1"
        data-timeline-viewport
        onScroll={(event) => {
          const element = event.currentTarget
          setScroll({
            left: element.scrollLeft / Math.max(1, element.scrollWidth),
            visible: element.clientWidth / Math.max(1, element.scrollWidth),
          })
        }}
      >
        <div
          ref={track}
          className="esp-bt-track"
          style={{ width: `calc(${zoom * 100}% - 28px)` }}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.round(current)}
          aria-valuetext={formatClock(current)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (pointer.current = null)}
          onPointerLeave={() => setScrub(null)}
          onKeyDown={(event) => {
            const delta = event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : 0
            if (!delta) return
            event.preventDefault()
            event.stopPropagation()
            onSeek(Math.min(duration, Math.max(0, current + delta * (event.shiftKey ? 0.2 : 1))))
          }}
        >
          <div className="esp-bt-row" data-side="BLUE" aria-hidden="true" />
          <div className="esp-bt-row" data-row="MID" aria-hidden="true" />
          <div className="esp-bt-row" data-side="RED" aria-hidden="true" />
          {ticks.map((tick) => (
            <span key={`grid-${tick}`} className="esp-bt-grid" style={{ left: pct(tick) }} aria-hidden="true" />
          ))}

          {chapters.map((chapter) => {
            const view = views[chapter.gameId]
            return (
              <div
                key={chapter.gameId}
                className="esp-bt-band"
                data-focused={chapter.gameId === focused?.gameId || undefined}
                data-synced={chapter.synced || undefined}
                style={{ left: pct(chapter.start), width: pct(chapter.end - chapter.start) }}
              >
                <span className="esp-bt-band-label" title={chapter.synced ? undefined : "Chưa căn vị trí trong video"}>
                  <strong>Ván {chapter.number}</strong>
                  <span className="esp-num opacity-70" title="Thời lượng ván">
                    ⏱ {formatClock(chapter.duration)}
                  </span>
                  <span className="truncate opacity-80">{chapterTitle(chapter)}</span>
                </span>
                {view &&
                  (["BLUE", "RED"] as const).map((side) => (
                    <span
                      key={side}
                      className="esp-bt-band-team"
                      data-side={side}
                      style={{ top: ROW_TOP[side] }}
                      title={view.sides[side].team.name}
                    >
                      <TeamLogo team={view.sides[side].team} size={16} />
                    </span>
                  ))}
              </div>
            )
          })}

          {chapters.map((chapter) => {
            const draft = chapter.draft
            const view = views[chapter.gameId]
            if (!draft) return null
            // Turns belong to teams, not players: teammates still swap heroes until the lock.
            return (
              <div key={`draft-${chapter.gameId}`} className="contents">
                <div
                  className="esp-bt-draft"
                  data-live={chapter.live || undefined}
                  style={{ left: pct(draft.start), width: pct(chapter.start - draft.start) }}
                  aria-hidden="true"
                >
                  <span className="esp-bt-draft-label">Cấm chọn · V{chapter.number}</span>
                </div>
                {draft.turns.map((turn) =>
                  turn.atSecond == null || !turn.hero ? null : (
                    <button
                      key={turn.order}
                      type="button"
                      data-marker
                      data-side={turn.side}
                      data-kind={turn.kind}
                      className="esp-bt-turn"
                      style={{ left: pct(turn.atSecond), top: ROW_TOP[turn.side] }}
                      aria-label={`Ván ${chapter.number} · lượt ${turn.order} · ${turn.kind === "BAN" ? "cấm" : "chọn"} · ${view?.sides[turn.side].team.name ?? ""} · ${turn.hero.name ?? ""} · ${formatClock(turn.atSecond)}`}
                      title={`Lượt ${turn.order} · ${turn.kind === "BAN" ? "Cấm" : "Chọn"} · ${view?.sides[turn.side].team.shortName ?? ""} · ${turn.hero.name ?? ""}`}
                      onClick={() => onSeek(turn.atSecond!)}
                    >
                      <HeroIcon
                        hero={{ id: turn.hero.id, name: turn.hero.name ?? "", iconUrl: heroIcon?.(turn.hero) }}
                        size={22}
                        title=""
                        className="rounded-md"
                      />
                      {turn.kind === "BAN" && (
                        <span className="esp-bt-turn-ban">
                          <Ban size={8} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  ),
                )}
                {draft.locked != null && (
                  <button
                    type="button"
                    data-chapter={`lock-${chapter.gameId}`}
                    className="esp-bt-lock"
                    style={{ left: pct(draft.locked) }}
                    aria-label={`Chốt đội hình ván ${chapter.number} · ${formatClock(draft.locked)}`}
                    title={`Chốt đội hình ván ${chapter.number} · ${VIDEO_MARK} ${formatClock(draft.locked)}`}
                    onClick={() => onSeek(draft.locked!)}
                  >
                    <Lock size={10} strokeWidth={2.6} />
                  </button>
                )}
              </div>
            )
          })}

          {flags.map((flag) => (
            <button
              key={flag.id}
              type="button"
              data-chapter={flag.id}
              className="esp-bt-flag"
              style={{ left: pct(flag.at) }}
              title={`${flag.label} · ${formatClock(flag.at)}`}
              aria-label={`${flag.label} · ${formatClock(flag.at)}`}
              onClick={() => onSeek(flag.at)}
            >
              <Flag size={10} strokeWidth={2.6} />
            </button>
          ))}

          {clusters.map((cluster) => {
            const lead = leadEvent(cluster)
            const view = views[sourceOf(cluster.id).gameId]
            if (!view) return null
            const title = clusterTitle(cluster)
            const left = (cluster.start / duration) * 100
            const text = describeEvent(lead, view)
            return (
              <HoverCard key={cluster.id} openDelay={80} closeDelay={120}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    data-marker
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
                    onClick={() => onSelect(cluster.events[0])}
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
                      <div className="flex gap-2 border-t pt-2">
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
                      </div>
                    }
                  />
                </HoverCardContent>
              </HoverCard>
            )
          })}

          <div className="esp-bt-playhead" style={{ left: pct(current) }}>
            <span className="esp-num">
              {here
                ? `V${here.number} ⏱ ${formatClock(chapterClock(here, current))}`
                : `${VIDEO_MARK} ${formatClock(current)}`}
            </span>
          </div>
          {scrub !== null && (
            <span className="esp-bt-scrub esp-num" style={{ left: pct(scrub) }}>
              {VIDEO_MARK} {formatClock(scrub)}
              {chapterAt(chapters, scrub) &&
                ` · V${chapterAt(chapters, scrub)!.number} ⏱ ${formatClock(chapterClock(chapterAt(chapters, scrub)!, scrub))}`}
            </span>
          )}
          <div className="esp-track-ticks esp-num" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} style={{ left: pct(tick) }}>
                {formatClock(tick)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
