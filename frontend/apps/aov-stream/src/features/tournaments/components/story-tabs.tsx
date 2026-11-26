import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { clock } from "../../../lib/tournament-model"
import type { WatchMatch } from "../../../lib/watch-types"
import { gameWords, shortName } from "../../../lib/watch-words"
import { StoryWinner } from "./story-cell"
import "./story-tabs.css"

/** The tab an arrow key leads to from the one that has the focus. */
function tabBy(key: string, at: number, count: number) {
  if (key === "ArrowLeft") return (at - 1 + count) % count
  if (key === "ArrowRight") return (at + 1) % count
  if (key === "Home") return 0
  return key === "End" ? count - 1 : null
}

/**
 * The games of a video without times. A tab chooses whose line-ups stand beside the video; the video only changes with
 * it when the game has one of its own. The winners shown are those of the games before the chosen one.
 */
export function StoryTabs({ match, phone }: { match: WatchMatch; phone: boolean }): ReactNode {
  const { text } = useStreamLocale()
  const { chapters } = match.story
  const chosen = useWatch((view) => view.chosen)
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const row = list.current
    const tab = row?.querySelector<HTMLElement>("[aria-selected=true]")
    if (row && tab) row.scrollLeft = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2
  }, [chosen, phone])
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")]
    const to = tabBy(
      event.key,
      tabs.findIndex((tab) => tab === event.target),
      tabs.length,
    )
    if (to == null) return
    event.preventDefault()
    tabs[to]?.focus()
  }
  return (
    <div
      ref={list}
      className="tn-story-tabs"
      data-phone={phone || undefined}
      role="tablist"
      aria-label={text("Các ván của trận", "The games of the match")}
      onKeyDown={move}
    >
      {chapters.map((chapter) => {
        const { index, number, length, winner } = chapter
        const known = index < chosen && winner
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === chosen}
            tabIndex={index === chosen ? 0 : -1}
            onClick={() => watch.choose(index)}
          >
            {known && <StoryWinner match={match} chapter={chapter} />}
            <span>
              {gameWords(number, text)}
              <small>
                {known && (
                  <span className="sr-only">
                    {text(`${shortName(match, winner)} thắng, `, `${shortName(match, winner)} won, `)}
                  </span>
                )}
                {length == null ? "–" : clock(length)}
              </small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
