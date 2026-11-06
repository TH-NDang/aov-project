import { useEffect, useRef } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import {
  formatDuration,
  isVideoEndedMessage,
  providerName,
  videoPlayback,
  videoThumbnail,
  type PublicVideo,
} from "./video-model"

const SUBSCRIBE_ATTEMPTS = 8

export const canPlayHere = (video: PublicVideo) => !!videoPlayback(video, window.location.hostname)

/**
 * The player is only created when the reader asks for it, so a page with many videos stays light. Give it a `key` per
 * video: reusing one iframe for a new source would add an entry to the browser history.
 *
 * @param onEnded called when the video finishes; YouTube and video files report this, other players do not
 */
export function VideoPlayer({ video, onEnded }: { video: PublicVideo; onEnded?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const finished = useRef(onEnded)
  const playback = videoPlayback(video, window.location.hostname)
  const reportsEnd = playback?.kind === "frame" && video.provider === "YOUTUBE"
  const source = reportsEnd
    ? `${playback.src}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
    : playback?.src

  useEffect(() => {
    finished.current = onEnded
  })

  useEffect(() => {
    const element = frame.current
    if (!element || !reportsEnd || !source) return

    const origin = new URL(source).origin
    let timer: ReturnType<typeof setInterval> | undefined
    let ended = false

    // The player ignores messages until its own script has started, so ask again until it answers.
    const subscribe = () => {
      let attempts = 0
      clearInterval(timer)
      timer = setInterval(() => {
        element.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), origin)
        if (++attempts >= SUBSCRIBE_ATTEMPTS) clearInterval(timer)
      }, 1000)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== element.contentWindow) return
      clearInterval(timer)
      if (ended || !isVideoEndedMessage(event.data)) return
      ended = true
      finished.current?.()
    }

    element.addEventListener("load", subscribe)
    window.addEventListener("message", onMessage)
    return () => {
      clearInterval(timer)
      element.removeEventListener("load", subscribe)
      window.removeEventListener("message", onMessage)
    }
  }, [reportsEnd, source])

  if (!playback) return null
  if (playback.kind === "file")
    return (
      <video
        className="wiki-video-frame"
        src={playback.src}
        title={video.title}
        controls
        autoPlay
        playsInline
        onEnded={() => finished.current?.()}
      />
    )
  return (
    <iframe
      ref={frame}
      className="wiki-video-frame"
      data-portrait={playback.portrait || undefined}
      src={source}
      title={video.title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}

export function VideoThumbnail({ video, compact }: { video: PublicVideo; compact?: boolean }) {
  const thumbnail = videoThumbnail(video)
  const playable = canPlayHere(video)
  return (
    <span className="wiki-video-thumb" data-compact={compact || undefined}>
      {thumbnail ? (
        <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className="wiki-video-thumb-provider">{providerName(video) || "Video"}</span>
      )}
      <span className="wiki-video-thumb-action" data-icon={playable ? "play" : "link"} aria-hidden="true">
        <WikiIcon name={playable ? "play" : "external"} size={compact ? 16 : 22} />
      </span>
      {!compact && video.durationSeconds && (
        <span className="wiki-video-duration">{formatDuration(video.durationSeconds)}</span>
      )}
    </span>
  )
}
