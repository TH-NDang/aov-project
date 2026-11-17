import { useEffect, useRef, useState, type ReactNode } from "react"
import { LocalTime } from "@aov/ui/components/local-time"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/public-overlay"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiIcon } from "../../components/wiki-icon"
import { VideoPlayer, VideoThumbnail } from "./video-player"
import {
  formatDuration,
  neighbours,
  providerName,
  purposeLabel,
  videoPlayback,
  videoWatchUrl,
  type PublicVideo,
} from "./video-model"

const AUTO_NEXT_KEY = "wiki-video-auto-next"
const PUBLISHED_DAY: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }

function useAutoNext() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(AUTO_NEXT_KEY) !== "off"
    } catch {
      return true
    }
  })
  const update = (next: boolean) => {
    setEnabled(next)
    try {
      localStorage.setItem(AUTO_NEXT_KEY, next ? "on" : "off")
    } catch {
      // Private browsing can refuse storage; the choice then lasts until the page closes.
    }
  }
  return [enabled, update] as const
}

/**
 * Watches a video at a useful size with the rest of its list beside it, so moving between videos never reflows the page
 * underneath. On a phone the same content becomes a drawer with the player held at the top.
 */
export function VideoTheater({
  video,
  playlist,
  heading,
  patchName,
  onSelect,
  onClose,
}: {
  video: PublicVideo | null
  playlist: readonly PublicVideo[]
  heading: string
  patchName?: (video: PublicVideo) => ReactNode
  onSelect: (video: PublicVideo) => void
  onClose: () => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [autoNext, setAutoNext] = useAutoNext()
  const activeRow = useRef<HTMLButtonElement>(null)
  const opener = useRef<Element | null>(null)

  // The title stays readable while the dialog animates away, after the player itself has gone.
  const [shown, setShown] = useState(video)
  if (video && video !== shown) setShown(video)

  const { index, previous, next } = neighbours(playlist, shown?.id)
  const playback = shown ? videoPlayback(shown, window.location.hostname) : null
  const portrait = playback?.kind === "frame" && playback.portrait
  const provider = shown ? providerName(shown) : ""
  const patch = shown ? patchName?.(shown) : undefined

  useEffect(() => {
    if (!video) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']"))
        return
      const target = event.key === "ArrowRight" ? next : previous
      if (!target) return
      event.preventDefault()
      onSelect(target)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [video, next, previous, onSelect])

  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: "nearest" })
  }, [shown?.id])

  return (
    <Dialog open={!!video} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="wiki-video-theater"
        data-single={playlist.length < 2 || undefined}
        showCloseButton={false}
        onOpenAutoFocus={() => {
          opener.current = document.activeElement
        }}
        onCloseAutoFocus={(event) => {
          // A shortcut elsewhere on the page gets focus back by default, which does not scroll: the reader stays put.
          if (!opener.current?.closest("[data-video-card]")) return
          // A card returns to the video last watched, which may be another card in the same gallery.
          const card = shown && document.querySelector<HTMLElement>(`[data-video-card="${CSS.escape(shown.id)}"]`)
          if (!card) return
          event.preventDefault()
          card.focus({ preventScroll: true })
          card.scrollIntoView({ block: "nearest" })
        }}
      >
        {shown && (
          <>
            <div className="wiki-video-theater-bar">
              <span className="wiki-video-theater-heading">{heading}</span>
              {playlist.length > 1 && index >= 0 && (
                <span className="wiki-video-theater-count">
                  {index + 1}/{playlist.length}
                </span>
              )}
              <DialogClose className="wiki-video-theater-close" aria-label={text("Đóng video", "Close video")}>
                <WikiIcon name="close" size={18} />
              </DialogClose>
            </div>

            <div className="wiki-video-theater-stage" data-portrait={portrait || undefined}>
              {video && (
                <VideoPlayer
                  key={video.id}
                  video={video}
                  onEnded={() => {
                    if (autoNext && next) onSelect(next)
                  }}
                />
              )}
            </div>

            <div className="wiki-video-theater-details">
              <DialogTitle className="wiki-video-theater-title">{shown.title}</DialogTitle>
              <DialogDescription className="wiki-video-meta" asChild>
                <span>
                  <span>{purposeLabel(shown.purpose, locale)}</span>
                  {patch && (
                    <span className="wiki-video-patch">
                      {text("Từ bản", "From")} {patch}
                    </span>
                  )}
                  {shown.channelName && <span>{shown.channelName}</span>}
                  {shown.publishedOn && (
                    <span>
                      <LocalTime value={shown.publishedOn} format={PUBLISHED_DAY} locale={locale} />
                    </span>
                  )}
                  {shown.durationSeconds && <span>{formatDuration(shown.durationSeconds)}</span>}
                </span>
              </DialogDescription>
              {shown.note && <p className="wiki-video-note">{shown.note}</p>}
              <div className="wiki-video-actions">
                {playlist.length > 1 && (
                  <>
                    <button type="button" disabled={!previous} onClick={() => previous && onSelect(previous)}>
                      <WikiIcon name="chevronLeft" size={14} />
                      {text("Trước", "Previous")}
                    </button>
                    <button type="button" disabled={!next} onClick={() => next && onSelect(next)}>
                      {text("Tiếp", "Next")}
                      <WikiIcon name="chevronRight" size={14} />
                    </button>
                  </>
                )}
                <a href={videoWatchUrl(shown)} target="_blank" rel="noreferrer">
                  <WikiIcon name="external" size={14} />
                  {provider
                    ? `${text("Mở trên", "Open on")} ${provider}`
                    : text("Mở liên kết gốc", "Open original link")}
                </a>
              </div>
            </div>

            {playlist.length > 1 && (
              <section className="wiki-video-theater-list" aria-label={text("Danh sách phát", "Playlist")}>
                <label className="wiki-video-theater-auto">
                  <input type="checkbox" checked={autoNext} onChange={(event) => setAutoNext(event.target.checked)} />
                  {text("Tự phát video tiếp theo", "Play next automatically")}
                </label>
                <ul>
                  {playlist.map((row) => {
                    const active = row.id === shown.id
                    return (
                      <li key={row.id}>
                        <button
                          ref={active ? activeRow : undefined}
                          type="button"
                          aria-current={active || undefined}
                          aria-label={`${text("Phát", "Play")}: ${row.title}`}
                          onClick={() => onSelect(row)}
                        >
                          <VideoThumbnail video={row} compact />
                          <span className="wiki-skin-video-text">
                            <span className="wiki-video-title">{row.title}</span>
                            <span className="wiki-video-meta">
                              <span>{active ? text("Đang phát", "Playing") : purposeLabel(row.purpose, locale)}</span>
                              {row.durationSeconds && <span>{formatDuration(row.durationSeconds)}</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
