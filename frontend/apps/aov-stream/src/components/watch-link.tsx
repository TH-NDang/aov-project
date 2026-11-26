import type { MouseEvent, ReactNode } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { targetOf, watchHref } from "../lib/watch-routes"
import { watch } from "./watch-session"

/** What a link says that was pressed to be watched: the page of the match then opens its room by itself. */
const TO_PLAY = { play: true }

/**
 * Leads into the video of a match, at a game, a second of it or a second of the video. Where that video is open beside
 * the page already, it goes there and the page stays.
 */
export function WatchLink({
  seriesId,
  game,
  at,
  second,
  label,
  className,
  children,
}: {
  seriesId: string
  game?: number
  at?: number
  second?: number
  label?: string
  className?: string
  children: ReactNode
}): ReactNode {
  const wide = usePageLayout() === "wide"
  const press = (event: MouseEvent) => {
    const { match, player, length } = watch.view()
    if (!wide || match?.seriesId !== seriesId || player === "CLOSED") return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = targetOf(match, { game: game ?? null, at: at ?? null, second: second ?? null }, length)
    if (!target) return
    event.preventDefault()
    watch.go(target)
  }
  return (
    <Link
      to={watchHref(seriesId, { game, at, second })}
      state={TO_PLAY}
      className={className}
      title={label}
      aria-label={label}
      onClick={press}
    >
      {children}
    </Link>
  )
}
