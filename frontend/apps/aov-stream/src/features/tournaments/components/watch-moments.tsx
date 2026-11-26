import { useCallback, useEffect, useMemo, useRef } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { clock } from "../../../lib/tournament-model"
import { rowsOf } from "../../../lib/watch-rows"
import type { Chapter, MomentRow, WatchMatch } from "../../../lib/watch-types"
import { rowWords, shortName } from "../../../lib/watch-words"
import "./watch-moments.css"

/** A list the reader has moved is left alone this long. */
const LEFT_ALONE = 10_000

/** Says on a box that scrolls whether more of it stands above and below, for the fades of its sheet. */
export function useEdges<T extends HTMLElement>() {
  return useCallback((box: T | null) => {
    if (!box) return
    const read = () => {
      const { scrollTop, scrollHeight, clientHeight } = box
      box.toggleAttribute("data-above", scrollTop > 2)
      box.toggleAttribute("data-below", scrollHeight - clientHeight - scrollTop > 2)
    }
    read()
    box.addEventListener("scroll", read, { passive: true })
    const size = new ResizeObserver(read)
    size.observe(box)
    const rows = new MutationObserver(read)
    rows.observe(box, { childList: true, subtree: true })
    return () => {
      box.removeEventListener("scroll", read)
      size.disconnect()
      rows.disconnect()
    }
  }, [])
}

function Row({ match, chapter, row, now }: { match: WatchMatch; chapter: Chapter; row: MomentRow; now: boolean }) {
  const { text } = useStreamLocale()
  const words = rowWords(row, match, text)
  const team = row.team ? shortName(match, row.team) : ""
  const own = !!team && words.startsWith(`${team} `)
  const at = clock(row.from)
  const label = text(`Phát lại ${at}: ${words}`, `Replay ${at}: ${words}`)
  const replay = () => {
    if (chapter.video && row.second != null) watch.go({ video: chapter.video, second: row.second })
  }
  return (
    <li>
      <button
        type="button"
        className="tn-room-moment"
        data-now={now || undefined}
        title={label}
        aria-label={label}
        onClick={replay}
      >
        <time>{at}</time>
        <span>
          {own ? (
            <>
              <b>{team}</b>
              {words.slice(team.length)}
            </>
          ) : (
            words
          )}
        </span>
      </button>
    </li>
  )
}

/**
 * What has happened in a game up to where the video is, a row for what one team did in a row; each plays again. After
 * the game (`again`) it lists all of it. Where the page scrolls instead of the list the latest stands on top.
 */
export function WatchMoments({
  match,
  chapter,
  again = false,
  scrolls,
}: {
  match: WatchMatch
  chapter: Chapter
  again?: boolean
  scrolls: boolean
}) {
  const { text } = useStreamLocale()
  const rows = useMemo(() => rowsOf(chapter), [chapter])
  const passed = useWatch((view) => {
    const at = view.place?.clock ?? 0
    return again ? rows.length : rows.filter((row) => row.from <= at).length
  })
  const list = useRef<HTMLOListElement | null>(null)
  const moved = useRef(-LEFT_ALONE)
  const edges = useEdges<HTMLOListElement>()
  const attach = useCallback(
    (element: HTMLOListElement | null) => {
      list.current = element
      return edges(element)
    },
    [edges],
  )
  // The latest stays in view as rows are added and as the window changes.
  useEffect(() => {
    const box = list.current
    if (!box || !scrolls || again) return
    const follow = () => {
      if (performance.now() - moved.current >= LEFT_ALONE) box.scrollTop = box.scrollHeight
    }
    follow()
    const size = new ResizeObserver(follow)
    size.observe(box)
    return () => size.disconnect()
  }, [passed, scrolls, again])
  if (!passed) return null

  const shown = rows.slice(0, passed)
  const ordered = scrolls || again ? shown : [...shown].reverse()
  const touch = () => {
    moved.current = performance.now()
  }
  return (
    <section className="tn-room-story" data-again={again || undefined}>
      {again && <h3>{text(`Xem lại ván ${chapter.number}`, `Game ${chapter.number} again`)}</h3>}
      <ol
        ref={attach}
        className="tn-room-moments"
        aria-label={again ? undefined : text("Diễn biến", "What has happened")}
        onWheel={touch}
        onTouchMove={touch}
        onKeyDown={touch}
        // A press on the bar of the list itself, not on a row of it.
        onPointerDown={(event) => event.target === event.currentTarget && touch()}
      >
        {ordered.map((row) => (
          <Row key={rows.indexOf(row)} match={match} chapter={chapter} row={row} now={!again && row === shown.at(-1)} />
        ))}
      </ol>
    </section>
  )
}
