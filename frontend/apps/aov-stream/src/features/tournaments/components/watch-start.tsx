import type { ReactNode } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { asksAhead } from "../../../components/on-demand"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { startActions, startWords, type StartAction } from "../../../lib/watch-start"
import type { WatchMatch, WatchTarget } from "../../../lib/watch-types"
import { roomInside } from "./room-inside"
import "./watch-start.css"

/**
 * What the head of a match offers to watch: the one thing to do, and beside it at most one other. Nothing of the video
 * is loaded before one of them is pressed.
 */
export function WatchStart({
  match,
  waiting,
  address,
  onOpened,
}: {
  match: WatchMatch | null
  /** The games that tell what can be watched are on their way. */
  waiting: boolean
  /** The place the address of the page names. */
  address: WatchTarget | null
  onOpened(): void
}): ReactNode | null {
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const open = useWatch((view) => !!match && view.match?.seriesId === match.seriesId)
  const shrunk = useWatch((view) => view.shrunk)
  // The way back says how far the small player has come, so it is read again with every second of it.
  useWatch((view) => (open && view.shrunk ? view.place : null))
  if (!match) return waiting ? <span className="tn-start-wait" aria-hidden="true" /> : null
  const actions = startActions(match, {
    stop: watch.remembered(match.seriesId),
    open,
    shrunk,
    address,
    length: watch.kept(),
  })
  if (!actions.length) return null
  const press = (action: StartAction) => {
    if (action.kind === "BACK") watch.expand()
    else watch.open(match, action.target, action.length)
    onOpened()
  }
  return (
    <div className="tn-start" {...asksAhead(roomInside)}>
      {actions.map((action, index) => {
        const { title, line } = startWords(action, match, text, compact, watch.view())
        return (
          <button
            key={index}
            type="button"
            className={index ? "tn-start-more" : "tn-start-main"}
            onClick={() => press(action)}
          >
            {!index && (
              <span className="tn-start-sign" data-play={action.kind !== "BACK" || undefined}>
                <StreamIcon name={action.kind === "BACK" ? "expand" : "play"} size={22} />
              </span>
            )}
            <span>
              <b>{title}</b> {line && <small>{line}</small>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
