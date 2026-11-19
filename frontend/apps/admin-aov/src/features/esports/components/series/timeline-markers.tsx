import { Flag, Gem, Shield, Swords, Zap } from "lucide-react"
import { formatClock } from "@/lib/clock"
import type { BroadcastChapter } from "../../model/broadcast-timeline"
import type { GameView } from "../../model/game-view"
import { MARK_LABELS, type MarkPart } from "../../model/observation-marks"
import { chapterVideo, type GameChapter } from "../../model/series-vod"
import type { MarkerDrag } from "./use-marker-drag"

/** Marks of one team taken at the same second sit this many pixels apart instead of on top of each other. */
const MARK_STEP_PX = 15
const MARK_ICONS: Record<MarkPart, typeof Zap> = { spell: Zap, enchantments: Shield, arcana: Gem, equipment: Swords }

type Markers = Pick<MarkerDrag, "marker" | "shownAt">

/** The flag where each game starts on the video; moving it moves the game's moments with it. */
export function StartFlags({
  flags,
  markers,
  pct,
  onSeek,
}: {
  flags: BroadcastChapter[]
  markers: Markers
  pct: (second: number) => string
  onSeek: (second: number) => void
}) {
  return (
    <>
      {flags.map((flag) => {
        const start = markers.marker({ kind: "gameStart", gameId: flag.id }, flag.at, () => onSeek(flag.at))
        return (
          <button
            key={flag.id}
            type="button"
            {...start.props}
            data-edge="gameStart"
            data-chapter={flag.id}
            className="esp-bt-flag"
            style={{ left: pct(markers.shownAt(start.key, flag.at)) }}
            title={`${flag.label} · ${formatClock(flag.at)}${start.canMove ? " · kéo để đổi giây, sự kiện của ván dời theo" : ""}`}
            aria-label={`${flag.label} · ${formatClock(flag.at)}`}
          >
            <Flag size={10} strokeWidth={2.6} />
          </button>
        )
      })}
    </>
  )
}

/** The moments the broadcast showed a team's spells, emblems, arcana or equipment, in the games that have gone live. */
export function LoadoutMarks({
  chapters,
  views,
  markers,
  pct,
  onSeek,
}: {
  chapters: GameChapter[]
  views: Record<string, GameView>
  markers: Markers
  pct: (second: number) => string
  onSeek: (second: number) => void
}) {
  return (
    <>
      {chapters.map((chapter) => {
        const view = views[chapter.gameId]
        if (!chapter.live || !view) return null
        const marks = chapter.marks ?? []
        return marks.map((mark, index) => {
          const at = chapterVideo(chapter, mark.at)
          const target = {
            kind: "mark",
            gameId: chapter.gameId,
            side: mark.side,
            part: mark.part,
            at: mark.at,
          } as const
          const shown = markers.marker(target, at, () => onSeek(at))
          const team = view.sides[mark.side]
          const players = mark.lanes.flatMap((lane) => team.seats.find((seat) => seat.lane === lane)?.playerName ?? [])
          const who = mark.lanes.length >= team.seats.length ? "cả đội" : players.join(", ")
          const what = `Video hiện ${MARK_LABELS[mark.part]} · ${team.team.shortName} · ${who}`
          const beside = marks
            .slice(0, index)
            .filter((other) => other.side === mark.side && other.at === mark.at).length
          const Icon = MARK_ICONS[mark.part]
          return (
            <button
              key={shown.key}
              type="button"
              {...shown.props}
              data-mark={mark.part}
              data-side={mark.side}
              className="esp-bt-mark"
              style={{ left: pct(markers.shownAt(shown.key, at)), marginLeft: beside * MARK_STEP_PX }}
              aria-label={`Ván ${chapter.number} · ${what} · ${formatClock(mark.at)}`}
              title={`${what} · ⏱ ${formatClock(mark.at)}${shown.canMove ? " · kéo để đổi giây" : ""}`}
            >
              <Icon size={9} strokeWidth={2.6} />
            </button>
          )
        })
      })}
    </>
  )
}
