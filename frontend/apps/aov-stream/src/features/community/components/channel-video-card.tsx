import { useState } from "react"
import type { YouTubeVideo } from "@aov/community-contracts"
import { timeAgo } from "../../../components/community-ui"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { compactCount, videoLength, videoPicture } from "../model/channel-model"
import "./channel-video-card.css"

type CardProps = { video: YouTubeVideo; playing: boolean; onPlay: (video: YouTubeVideo) => void }

/**
 * An upload of the channel. The newest one is the `feature`: its picture fills the width and its title lies over the
 * picture; the others sit in a grid with the title below. A short has a tall card of its own, in a row that swipes.
 */
export function ChannelVideoCard({ video, playing, onPlay, feature = false }: CardProps & { feature?: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const when = timeAgo(video.publishedAt, Date.now(), undefined, languageTag)
  const views =
    video.viewCount != null
      ? text(
          `${compactCount(video.viewCount, languageTag)} lượt xem`,
          `${compactCount(video.viewCount, languageTag)} views`,
        )
      : null
  return (
    <button
      type="button"
      className="pf-video"
      data-feature={feature || undefined}
      data-playing={playing || undefined}
      aria-pressed={playing}
      aria-label={text(`Phát video: ${video.title}`, `Play video: ${video.title}`)}
      onClick={() => onPlay(video)}
    >
      <span className="pf-video-picture">
        <Picture videoId={video.id} sharp={feature} />
        <Corner video={video} />
        {playing ? (
          <span className="pf-video-now">{text("Đang phát", "Playing")}</span>
        ) : (
          feature && (
            <span className="pf-video-play" aria-hidden="true">
              <StreamIcon name="play" size={22} />
            </span>
          )
        )}
      </span>
      <span className="pf-video-text">
        <span className="pf-video-title">{video.title}</span>
        <span className="pf-video-meta">{[when, views].filter(Boolean).join(" · ")}</span>
      </span>
    </button>
  )
}

export function ShortCard({ video, playing, onPlay }: CardProps) {
  const { text, languageTag } = useStreamLocale()
  return (
    <button
      type="button"
      className="pf-short"
      data-playing={playing || undefined}
      aria-pressed={playing}
      aria-label={text(`Phát short: ${video.title}`, `Play short: ${video.title}`)}
      onClick={() => onPlay(video)}
    >
      <Picture videoId={video.id} sharp={false} />
      <span className="pf-short-text">
        <span className="pf-short-title">{video.title}</span>
        {video.viewCount != null && (
          <span className="pf-short-views">
            <StreamIcon name="eye" size={12} />
            {compactCount(video.viewCount, languageTag)}
          </span>
        )}
      </span>
    </button>
  )
}

/** A stream that is on, or one announced, says so; any other video shows its length. */
function Corner({ video }: { video: YouTubeVideo }) {
  const { text } = useStreamLocale()
  if (video.broadcast === "LIVE") return <span className="pf-video-live">{text("Trực tiếp", "Live")}</span>
  if (video.broadcast === "UPCOMING") return <span className="pf-video-length">{text("Sắp phát", "Upcoming")}</span>
  return video.durationSeconds ? <span className="pf-video-length">{videoLength(video.durationSeconds)}</span> : null
}

/** The 1280px picture where one exists; YouTube answers a missing one with a 120px blank, which the small one replaces. */
function Picture({ videoId, sharp }: { videoId: string; sharp: boolean }) {
  const [size, setSize] = useState<"hq720" | "mqdefault">(sharp ? "hq720" : "mqdefault")
  return (
    <img
      src={videoPicture(videoId, size)}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={(event) => size === "hq720" && event.currentTarget.naturalWidth <= 120 && setSize("mqdefault")}
      onError={() => size === "hq720" && setSize("mqdefault")}
    />
  )
}
