import { useMemo, useSyncExternalStore } from "react"
import { formatClock } from "@/lib/clock"
import type { GameView } from "../../../model/game-view"
import type { GameChapter } from "../../../model/series-vod"
import { trackTicks, type Tick, type TimelineRow } from "../../../model/track-layout"
import { TeamLogo } from "../../primitives"
import type { Pct } from "./track-spine"
import type { TimelineView } from "./use-timeline-view"

const ROWS: readonly TimelineRow[] = ["BLUE", "SPINE", "RED"]
const SIDES = ["BLUE", "RED"] as const
/** Room a name of the band takes: the game, and each letter after it. */
const NAME_PX = 44
const LETTER_PX = 6.5
/** Room of a crest in front of its game. */
const CREST_PX = 22
/** Half the width of a tick's text. */
const HALF_TICK_PX = { game: 18, video: 28 }
/** Room kept between the texts of two ticks. */
const TICK_GAP_PX = 4

/**
 * The ticks whose text would cover the text of one before it, by their place in the list, as where the clocks of two
 * games that clash run over each other. The earlier text stays, and the line of every tick does.
 */
function crowdedTicks(ticks: Tick[], pxPerSecond: number, duration: number) {
  const crowded = new Set<number>()
  let end = Number.NEGATIVE_INFINITY
  ticks.forEach((tick, index) => {
    const width = 2 * HALF_TICK_PX[tick.clock]
    const x = tick.second * pxPerSecond
    const left = tick.second <= 0 ? x : tick.second >= duration ? x - width : x - width / 2
    if (left < end + TICK_GAP_PX) crowded.add(index)
    else end = left + width
  })
  return crowded
}

/** Names of the two teams as the chosen game seats them: the lanes are its sides. */
export function LaneHeads({ view }: { view: GameView | undefined }) {
  return (
    <div className="esp-lanes" data-timeline-lanes>
      {ROWS.map((row) => {
        if (row === "SPINE") return <div key={row} className="esp-lane" data-row={row} />
        const team = view?.sides[row].team
        return (
          <div key={row} className="esp-lane" data-row={row} data-side={row} title={team?.name}>
            {team && <TeamLogo team={team} size={20} />}
            <span className="esp-lane-name">{team?.shortName ?? (row === "BLUE" ? "Xanh" : "Đỏ")}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Where the next ticks begin changes a page at a time, so scrolling does not draw them again and again. */
function Ticks({ chapters, duration, view, pct }: Pick<GroundProps, "chapters" | "duration" | "view" | "pct">) {
  const page = useSyncExternalStore(view.shownNow.subscribe, () => Math.floor(view.shownNow.get().from / view.shown))
  const ticks = useMemo(
    () => trackTicks(chapters, duration, view.pxPerSecond, (page - 1) * view.shown, (page + 3) * view.shown),
    [chapters, duration, view.pxPerSecond, view.shown, page],
  )
  const crowded = useMemo(() => crowdedTicks(ticks, view.pxPerSecond, duration), [ticks, view.pxPerSecond, duration])
  // A text the edge of the view would cut is left out; its line stays.
  const cut = useSyncExternalStore(view.shownNow.subscribe, () => {
    const { from, to } = view.shownNow.get()
    return ticks
      .filter(({ second, clock }) => {
        const half = HALF_TICK_PX[clock] / view.pxPerSecond
        return (from > 0 && Math.abs(second - from) < half) || (to < duration && Math.abs(second - to) < half)
      })
      .map((tick) => tick.second)
      .join(" ")
  }).split(" ")
  // Where two games clash their clocks may tick at one second, so a second alone does not name a tick.
  return ticks.map((tick, index) => (
    <span key={`${tick.second}-${index}`} aria-hidden="true">
      <span className="esp-grid" style={{ left: pct(tick.second) }} />
      {!cut.includes(String(tick.second)) && !crowded.has(index) && (
        <span
          className="esp-tick"
          data-tick
          data-clock={tick.clock}
          data-end={tick.second <= 0 ? "first" : tick.second >= duration ? "last" : undefined}
          style={{ left: pct(tick.second) }}
        >
          {tick.text}
        </span>
      )}
    </span>
  ))
}

type Band = { chapter: GameChapter; phase: "draft" | "play"; from: number; to: number; words: string }

/**
 * The phases the band names. A game without its end is named as far as it may reach. Where the next game begins
 * before a game ends, the two clash and the next one names what follows, so that their names do not cover each other.
 */
function phaseBands(chapters: GameChapter[], views: Record<string, GameView>, duration: number): Band[] {
  return chapters.flatMap((chapter) => {
    const { draft, live, start, synced, ended, winner, gameId } = chapter
    if (!synced) return []
    const next = chapters.filter((other) => other.synced && other.from > chapter.from).map((other) => other.from)
    const open = Math.min(duration, ...next)
    const won = winner && views[gameId]?.sides[winner].team.shortName
    const played = ended ? `${formatClock(chapter.duration)}${won ? `, ${won} thắng` : ""}` : ""
    return [
      ...(draft
        ? [
            {
              chapter,
              phase: "draft" as const,
              from: draft.start,
              to: live ? Math.min(start, open) : open,
              words: "cấm chọn",
            },
          ]
        : []),
      ...(live
        ? [
            {
              chapter,
              phase: "play" as const,
              from: start,
              to: ended ? Math.min(chapter.end, open) : open,
              words: played,
            },
          ]
        : []),
    ]
  })
}

/**
 * What each phase is, held at the left edge while its beginning is scrolled away. Where a game has no room for more it
 * is only named, and a draft is left out.
 */
function Bands({ chapters, views, focused, duration, view, pct }: GroundProps) {
  const bands = useMemo(() => phaseBands(chapters, views, duration), [chapters, views, duration])
  const roomy = useSyncExternalStore(view.shownNow.subscribe, () => {
    const shown = view.shownNow.get()
    return bands
      .map(({ from, to, words, phase }) => {
        const seen = (Math.min(to, shown.to) - Math.max(from, shown.from)) * view.pxPerSecond
        if (seen >= NAME_PX + words.length * LETTER_PX) return "2"
        return phase === "play" && seen >= NAME_PX ? "1" : "0"
      })
      .join("")
  })
  return bands.map(({ chapter, phase, from, to, words }, index) =>
    roomy[index] !== "0" ? (
      <span
        key={`${chapter.gameId}-${phase}`}
        className="esp-band"
        data-focused={chapter === focused || undefined}
        style={{ left: pct(from), width: pct(Math.max(0, to - from)) }}
      >
        <span className="esp-band-name">
          <b>Ván {chapter.number}</b> {roomy[index] === "2" && words}
        </span>
      </span>
    ) : null,
  )
}

/**
 * The crests of a game whose sides the lane heads do not name, in front of where it begins and held at the left edge
 * while that is scrolled away: the blue lane may be the other team's there.
 */
function Crests({
  chapters,
  views,
  focused,
  pct,
  top,
}: Pick<GroundProps, "chapters" | "views" | "focused" | "pct" | "top">) {
  return chapters.map((chapter) => {
    const view = chapter.synced && chapter !== focused ? views[chapter.gameId] : undefined
    return SIDES.map((side) =>
      view ? (
        <span
          key={`${chapter.gameId}-${side}`}
          className="esp-lane-game"
          style={{
            left: `calc(${pct(chapter.from)} - ${CREST_PX}px)`,
            width: `calc(${pct(chapter.end - chapter.from)} + ${CREST_PX}px)`,
            top: top[side],
          }}
        >
          <span className="esp-lane-crest">
            <TeamLogo team={view.sides[side].team} size={16} />
          </span>
        </span>
      ) : null,
    )
  })
}

type GroundProps = {
  chapters: GameChapter[]
  views: Record<string, GameView>
  focused: GameChapter | null
  duration: number
  view: TimelineView
  pct: Pct
  top: Record<TimelineRow, number>
}

/** What stands still under the marks: the two lanes, the ticks, the names of the phases and the crests of other games. */
export function TrackGround(props: GroundProps) {
  return (
    <>
      {SIDES.map((side) => (
        <span
          key={side}
          className="esp-lane-ground"
          data-side={side}
          style={{ top: props.top[side] }}
          aria-hidden="true"
        />
      ))}
      <Ticks {...props} />
      <Bands {...props} />
      <Crests {...props} />
    </>
  )
}
