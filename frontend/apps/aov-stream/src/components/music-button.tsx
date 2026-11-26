import { music } from "./music-session"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { useMusic } from "./use-music"
import "./music-button.css"

/** The way to the music from the bar: it opens the player with its lists, and shows when a track is heard. */
export function MusicButton() {
  const { text } = useStreamLocale()
  const playing = useMusic(({ player }) => player === "PLAYING" || player === "WAITING")
  const shelf = useMusic((view) => view.open && !view.folded && view.shelf)
  const label = playing ? text("Nhạc đang phát", "Music is playing") : text("Nghe nhạc", "Listen to music")
  return (
    <button
      type="button"
      className="hub-icon-button hub-music-button"
      data-playing={playing || undefined}
      aria-label={label}
      title={label}
      aria-expanded={shelf}
      onClick={() => {
        if (shelf) return music.setShelf(false)
        music.show()
        music.setShelf(true)
      }}
    >
      {playing ? (
        <span className="hub-music-button-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <StreamIcon name="music" size={18} />
      )}
    </button>
  )
}
