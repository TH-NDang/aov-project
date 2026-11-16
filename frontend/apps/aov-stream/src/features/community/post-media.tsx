import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { videoEmbed } from "./post-media-model"

/** A post's video: the YouTube player inline, a card that opens the video elsewhere for other platforms. */
export function PostVideo({ url, title }: { url: string; title: string }) {
  const { text } = useStreamLocale()
  const embed = videoEmbed(url)
  if (!embed) return null
  if (embed.kind === "youtube")
    return (
      <div className="cp-post-video">
        <iframe
          src={embed.src}
          title={title}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    )
  return (
    <a className="cp-post-video-link" href={embed.href} target="_blank" rel="noreferrer">
      <span className="cp-post-video-play" aria-hidden="true">
        <StreamIcon name="play" size={22} />
      </span>
      <span>
        <strong>{text(`Xem video trên ${embed.platform}`, `Watch the video on ${embed.platform}`)}</strong>
        <small>{embed.href}</small>
      </span>
      <StreamIcon name="external" size={14} />
    </a>
  )
}

/** Up to four images in a grid that adapts to how many there are. */
export function PostImages({ urls, alt }: { urls: string[]; alt: string }) {
  const { text } = useStreamLocale()
  if (!urls.length) return null
  return (
    <div className="cp-post-images" data-count={Math.min(urls.length, 4)}>
      {urls.slice(0, 4).map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={text(`${alt} · ảnh ${index + 1}`, `${alt} · image ${index + 1}`)} loading="lazy" />
        </a>
      ))}
    </div>
  )
}
