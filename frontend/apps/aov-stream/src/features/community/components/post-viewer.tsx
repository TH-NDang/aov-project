import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import "./post-viewer.css"

/**
 * The pictures of a post over the whole screen, walked with the arrow keys, the buttons or a swipe. Escape, the close
 * button and a press beside the picture close it.
 */
export function PostViewer({
  urls,
  alt,
  at,
  onClose,
}: {
  urls: string[]
  alt: string
  /** The picture it opens at. */
  at: number
  onClose: () => void
}) {
  const { text } = useStreamLocale()
  const dialog = useRef<HTMLDialogElement>(null)
  const track = useRef<HTMLOListElement>(null)
  const [index, setIndex] = useState(at)
  useLayoutEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
    if (track.current) track.current.scrollLeft = at * track.current.clientWidth
    const { overflow } = document.documentElement.style
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = overflow
    }
  }, [at])
  useEffect(() => {
    track.current?.focus({ preventScroll: true })
  }, [])
  const go = (to: number) => {
    const row = track.current
    if (row && to >= 0 && to < urls.length) row.scrollTo({ left: to * row.clientWidth, behavior: "smooth" })
  }
  return (
    <dialog
      ref={dialog}
      className="pv"
      aria-label={text(`Ảnh của ${alt}`, `Images of ${alt}`)}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
        event.preventDefault()
        go(index + (event.key === "ArrowRight" ? 1 : -1))
      }}
    >
      <ol
        ref={track}
        className="pv-track"
        tabIndex={-1}
        onScroll={({ currentTarget: row }) => setIndex(Math.round(row.scrollLeft / row.clientWidth))}
      >
        {urls.map((url, position) => (
          <li
            key={`${url}-${position}`}
            onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
          >
            <img src={url} alt={text(`${alt} · ảnh ${position + 1}`, `${alt} · image ${position + 1}`)} />
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="pv-button pv-close"
        aria-label={text("Đóng", "Close")}
        onClick={() => dialog.current?.close()}
      >
        <StreamIcon name="close" size={22} />
      </button>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            className="pv-button pv-back"
            aria-label={text("Ảnh trước", "Previous image")}
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <StreamIcon name="chevronLeft" size={24} />
          </button>
          <button
            type="button"
            className="pv-button pv-next"
            aria-label={text("Ảnh sau", "Next image")}
            disabled={index === urls.length - 1}
            onClick={() => go(index + 1)}
          >
            <StreamIcon name="chevronRight" size={24} />
          </button>
          <p className="pv-count" aria-live="polite">
            {index + 1} / {urls.length}
          </p>
        </>
      )}
    </dialog>
  )
}
