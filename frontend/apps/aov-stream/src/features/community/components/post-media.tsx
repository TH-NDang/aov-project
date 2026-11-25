import { useEffect, useRef, useState } from "react"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { videoEmbed, videoPoster, type VideoEmbed } from "../model/post-media-model"
import { PostViewer } from "./post-viewer"
import "./post-media.css"

/**
 * A post's video. A YouTube video shows its own picture with a play mark and loads the player only when pressed, so a
 * feed of videos stays light and never shows an empty black frame; other platforms get a card that opens the video in
 * a new tab. `title` names the video for assistive technology; the post shows it as its heading.
 */
export function PostVideo({ url, title }: { url: string; title: string }) {
  const { text } = useStreamLocale()
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
            aria-label={text(`Phát video: ${title}`, `Play video: ${title}`)}
            onClick={() => setPlaying(true)}
          >
            <Poster embed={embed} />
            <span className="cp-video-play" aria-hidden="true">
              <StreamIcon name="play" size={24} />
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
        <strong>{text(`Xem video trên ${embed.platform}`, `Watch the video on ${embed.platform}`)}</strong>
        <small>{embed.href}</small>
      </span>
      <StreamIcon name="external" size={14} />
    </a>
  )
}

/** The sharp picture of a video. YouTube answers one it does not have with a 120px blank, which the safe one replaces. */
function Poster({ embed }: { embed: VideoEmbed }) {
  const [size, setSize] = useState<"hq720" | "hqdefault">("hq720")
  return (
    <img
      src={videoPoster(embed, size)!}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={(event) => size === "hq720" && event.currentTarget.naturalWidth <= 120 && setSize("hqdefault")}
      onError={() => setSize("hqdefault")}
    />
  )
}

/** Up to four images: one whole, two side by side, or the first large with the others in a column beside it. */
export function PostImages({ urls, alt }: { urls: string[]; alt: string }) {
  const { text } = useStreamLocale()
  const [viewing, setViewing] = useState<number | null>(null)
  const shown = urls.slice(0, 4)
  if (!shown.length) return null
  return (
    <div className="cp-post-images" data-count={shown.length}>
      {shown.map((url, index) => (
        <button
          key={`${url}-${index}`}
          type="button"
          aria-label={text(`Xem ảnh ${index + 1} trong ${shown.length}`, `View image ${index + 1} of ${shown.length}`)}
          onClick={() => setViewing(index)}
        >
          <img src={url} alt={text(`${alt} · ảnh ${index + 1}`, `${alt} · image ${index + 1}`)} loading="lazy" />
        </button>
      ))}
      {viewing != null && <PostViewer urls={shown} alt={alt} at={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
