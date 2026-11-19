import { formatClock } from "@/lib/clock"
import type { GameView } from "../../model/game-view"
import { chapterAt, chapterClock, type GameChapter } from "../../model/series-vod"
import { TeamLogo, VIDEO_MARK } from "../primitives"
import { ROW_TOP } from "./timeline-rows"

/** What the track draws under its markers: the three rows, a line at each labelled second and a band per game. */
export function TrackBackground({
  ticks,
  chapters,
  views,
  focusedGameId,
  chapterTitle,
  pct,
}: {
  ticks: number[]
  chapters: GameChapter[]
  views: Record<string, GameView>
  focusedGameId: string | undefined
  chapterTitle: (chapter: GameChapter) => string
  pct: (second: number) => string
}) {
  return (
    <>
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
            data-focused={chapter.gameId === focusedGameId || undefined}
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
    </>
  )
}

/**
 * What the track draws over its markers: the playhead, the label of a marker being dragged or else of the second
 * under the pointer, and the time labels.
 */
export function TrackReadouts({
  current,
  chapters,
  drag,
  scrub,
  ticks,
  pct,
}: {
  current: number
  chapters: GameChapter[]
  drag: { from: number; second: number } | null
  scrub: number | null
  ticks: number[]
  pct: (second: number) => string
}) {
  const here = chapterAt(chapters, current)
  const dragged = drag ? (chapterAt(chapters, drag.second) ?? null) : null
  const pointed = scrub === null ? null : chapterAt(chapters, scrub)
  return (
    <>
      <div className="esp-bt-playhead" style={{ left: pct(current) }}>
        <span className="esp-num">
          {here
            ? `V${here.number} ⏱ ${formatClock(chapterClock(here, current))}`
            : `${VIDEO_MARK} ${formatClock(current)}`}
        </span>
      </div>
      {drag ? (
        <span className="esp-bt-scrub esp-num" data-moving style={{ left: pct(drag.second) }} role="status">
          {VIDEO_MARK} {formatClock(drag.from)} → {formatClock(drag.second)}
          {dragged?.live &&
            drag.second >= dragged.start &&
            ` · V${dragged.number} ⏱ ${formatClock(chapterClock(dragged, drag.second))}`}
        </span>
      ) : (
        scrub !== null && (
          <span className="esp-bt-scrub esp-num" style={{ left: pct(scrub) }}>
            {VIDEO_MARK} {formatClock(scrub)}
            {pointed && ` · V${pointed.number} ⏱ ${formatClock(chapterClock(pointed, scrub))}`}
          </span>
        )
      )}
      <div className="esp-track-ticks esp-num" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} style={{ left: pct(tick) }}>
            {formatClock(tick)}
          </span>
        ))}
      </div>
    </>
  )
}
