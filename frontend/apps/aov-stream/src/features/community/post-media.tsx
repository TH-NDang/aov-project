import { useEffect, useRef, useState } from "react"
import { StreamIcon } from "../../components/stream-icon"
import { videoEmbed, videoPoster } from "./post-media-model"

/**
 * A post's video. A YouTube video shows its own picture with a play mark and loads the player only when pressed, so a
 * feed of videos stays light and never shows an empty black frame; other platforms get a card that opens the video in
 * a new tab. `title` names the video for assistive technology; the post shows it as its heading.
 */
export function PostVideo({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  // The pressed poster gives way to the player; keyboard focus moves into it.
  useEffect(() => {
    if (playing) frame.current?.focus()
  }, [playing])
  const embed = videoEmbed(url)
  if (!embed) return null
  if (embed.kind === "youtube")
    return (
      <div className="cp-post-video">
        {playing ? (
          <iframe
            ref={frame}
            src={`${embed.src}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="cp-video-poster"
            aria-label={`Phát video: ${title}`}
            onClick={() => setPlaying(true)}
          >
            <img src={videoPoster(embed)!} alt="" loading="lazy" />
            <span className="cp-video-play" aria-hidden="true">
              <StreamIcon name="play" size={26} />
            </span>
            <span className="cp-video-source" aria-hidden="true">
              YouTube
            </span>
          </button>
        )}
      </div>
    )
  return (
    <a className="cp-post-video-link" href={embed.href} target="_blank" rel="noreferrer">
      <span className="cp-post-video-play" aria-hidden="true">
        <StreamIcon name="play" size={20} />
      </span>
      <span>
        <strong>Xem video trên {embed.platform}</strong>
        <small>{embed.href}</small>
      </span>
      <StreamIcon name="external" size={14} />
    </a>
  )
}

/** Up to four images in a grid that adapts to how many there are. */
export function PostImages({ urls, alt }: { urls: string[]; alt: string }) {
  if (!urls.length) return null
  return (
    <div className="cp-post-images" data-count={Math.min(urls.length, 4)}>
      {urls.slice(0, 4).map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={`${alt} · ảnh ${index + 1}`} loading="lazy" />
        </a>
      ))}
    </div>
  )
}
