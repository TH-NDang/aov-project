import { useLayoutEffect, useRef } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { videoPicture } from "../lib/music-links"
import { MusicControls, MusicFolded } from "./music-controls"
import { music } from "./music-session"
import { MusicShelf } from "./music-shelf"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { useMusic } from "./use-music"
import "./music-deck.css"

/**
 * Keeps the end of every page above the player: a space as tall as the player stands after the page, and what is
 * scrolled to stops above it.
 */
function useCover(deck: React.RefObject<HTMLElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const element = deck.current
    const root = document.documentElement
    if (!element || !open) {
      root.style.removeProperty("--music-cover")
      return
    }
    const measure = () => {
      const { top } = element.getBoundingClientRect()
      root.style.setProperty("--music-cover", `${Math.max(0, Math.round(window.innerHeight - top))}px`)
    }
    const sizes = new ResizeObserver(measure)
    sizes.observe(element)
    window.addEventListener("resize", measure)
    measure()
    return () => {
      sizes.disconnect()
      window.removeEventListener("resize", measure)
      root.style.removeProperty("--music-cover")
    }
  }, [deck, open])
}

/**
 * The music player, beside every page: a YouTube frame with the controls of the list under it, in the bottom left
 * corner of a wide window and across the foot of a narrow one. Its player is made once in the host, which React leaves
 * alone, and goes on while the pages change. While a track is heard its video stays in sight, at least 200 pixels
 * high as YouTube asks of an embedded player; folded into a bar it is paused.
 */
export function MusicDeck() {
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const host = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => music.attach(host.current!), [])

  const open = useMusic((view) => view.open)
  const folded = useMusic((view) => view.folded)
  const shelf = useMusic((view) => view.shelf)
  const track = useMusic((view) => view.track)
  const player = useMusic((view) => view.player)
  const tapNeeded = useMusic((view) => view.tapNeeded)
  useCover(card, open)

  const started = player !== "CLOSED"
  return (
    <>
      <div className="hub-music-room" aria-hidden="true" />
      <section
        className="hub-music tn-night"
        data-open={open || undefined}
        data-folded={folded || undefined}
        aria-label={text("Trình phát nhạc", "Music player")}
        hidden={!open}
      >
        {shelf && !folded && <MusicShelf compact={compact} />}
        <div ref={card} className="hub-music-card">
          <div className="hub-music-screen" data-started={started || undefined}>
            {track && !started && <img className="hub-music-poster" src={videoPicture(track.video)} alt="" />}
            <div ref={host} className="hub-music-host" />
            {track && !started && (
              <button
                type="button"
                className="hub-music-start"
                onClick={() => music.toggle()}
                aria-label={text(`Phát ${track.title}`, `Play ${track.title}`)}
              >
                <StreamIcon name="play" size={28} />
              </button>
            )}
          </div>
          {tapNeeded && !folded && (
            <p className="hub-music-tap">{text("Chạm vào video để phát", "Tap the video to play")}</p>
          )}
          {folded ? <MusicFolded /> : <MusicControls compact={compact} />}
        </div>
      </section>
    </>
  )
}
