import { useMemo, type ReactNode } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { staffOf, xOf } from "../../../lib/watch-bar"
import { startOf } from "../../../lib/watch-follow"
import { told } from "../../../lib/watch-place"
import type { Bar, Story, WatchMatch } from "../../../lib/watch-types"
import { gameWords } from "../../../lib/watch-words"
import { currentGame, LANES, StoryLanes, storyStyle, StoryTrack } from "./story-bar"
import { pressWords, StoryWinner } from "./story-cell"
import { playGame } from "./use-story-pointer"
import "./story-games.css"

/** The sides of the bar on a phone, and the height of the lane of a team. */
const SIDE = 12
const LANE = 16
/** Pixels under the line in which the pointer is still read. */
const FOOT = 6
/** Half the ring that stands for a place between two games. */
const RING = 5
/** Pixels past either end of the staff, where the games stand that it does not show. */
const AWAY = 10_000

/** The staff of one game as the bar that is drawn and read, and with the other games off its ends for the place. */
function staffBars(story: Story, current: number, width: number): { shown: Bar; all: Bar } {
  const cells = story.chapters.map((chapter) =>
    chapter.index === current
      ? staffOf(chapter, width)
      : { ...staffOf(chapter, 0), left: chapter.index < current ? -AWAY : AWAY },
  )
  const all = { cells, width, unit: 0, folded: false }
  return { shown: { ...all, cells: cells.filter(({ chapter }) => chapter.index === current) }, all }
}

/**
 * The story of a match on a phone: the games as tabs that play them, and under them the line of the game being
 * watched. What is read while a finger moves along the line stands in the place of the tabs.
 */
export function StoryGames({ match, width }: { match: WatchMatch; width: number }): ReactNode {
  const { text } = useStreamLocale()
  const { story, cuts } = match
  const current = useWatch(currentGame)
  const reached = useWatch((view) => view.reached)
  const done = useWatch((view) => view.done)
  const length = useWatch((view) => view.length)
  const track = Math.max(0, width - SIDE * 2 - LANES)
  const { shown, all } = useMemo(() => staffBars(story, current, track), [story, current, track])
  const placeOf = useMemo(
    () => (video: string, second: number) => {
      const { x, gap } = xOf(story, all, video, second)
      return { x: gap ? Math.min(track - RING, Math.max(RING, x)) : x, gap }
    },
    [story, all, track],
  )
  return (
    <div
      className="tn-story-games"
      role="group"
      aria-label={text("Các ván trong video", "The games in the video")}
      style={storyStyle({ top: 0, label: 0, space: 0, lane: LANE, foot: FOOT })}
    >
      <div className="tn-story-list">
        {story.chapters.map((chapter) => {
          const own = chapter.index === current
          const known = told(story, chapter, reached, done)
          const words = (
            <>
              {own ? gameWords(chapter.number, text) : chapter.number}
              {known && <StoryWinner match={match} chapter={chapter} />}
            </>
          )
          return chapter.video && startOf(chapter, cuts, length) != null ? (
            <button
              key={chapter.index}
              type="button"
              aria-current={own || undefined}
              aria-label={pressWords(match, chapter, length, known, text)}
              onClick={() => playGame(chapter, cuts)}
            >
              {words}
            </button>
          ) : (
            <span key={chapter.index} aria-current={own || undefined}>
              {words}
            </span>
          )
        })}
      </div>
      <div className="tn-story-staff">
        <StoryLanes match={match} />
        <StoryTrack match={match} bar={shown} placeOf={placeOf} lane={LANE} label={null} />
      </div>
    </div>
  )
}
