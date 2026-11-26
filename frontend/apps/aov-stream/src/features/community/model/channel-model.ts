import type { YouTubeVideo, YouTubeVideoPage } from "@aov/community-contracts"

const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"])
/** YouTube's own pages, which are no channel's old vanity address. The service reads links the same way. */
const RESERVED = new Set([
  "watch",
  "shorts",
  "live",
  "embed",
  "playlist",
  "results",
  "feed",
  "redirect",
  "hashtag",
  "post",
  "v",
  "t",
  "gaming",
  "premium",
  "music",
  "kids",
  "account",
  "signin",
  "logout",
  "about",
  "attribution_link",
  "source",
  "sounds",
  "trending",
  "upload",
])
const NAME = /^[\p{L}\p{M}\p{N}_.-]{3,30}$/u

/**
 * Whether a link is one of a YouTube channel, which the site can show itself: `/@handle`, `/channel/UC…`, `/c/name`,
 * `/user/name` or an old `/name` address. A video, a playlist or another site opens where it points.
 */
export function isYouTubeChannel(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (!/^https?:$/.test(parsed.protocol) || !HOSTS.has(parsed.hostname.toLowerCase())) return false
  const [first, second] = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part)
      } catch {
        return ""
      }
    })
  if (!first) return false
  if (first.startsWith("@")) return NAME.test(first.slice(1))
  if (first === "channel") return /^UC[\w-]{22}$/.test(second ?? "")
  if (first === "c" || first === "user") return NAME.test(second ?? "")
  return !RESERVED.has(first.toLowerCase()) && NAME.test(first)
}

/** A length as a player shows it: `4:05`, `1:02:03`. */
export function videoLength(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  const [hours, minutes, rest] = [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60]
  const pad = (value: number) => String(value).padStart(2, "0")
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}

const compactFormats = new Map<string, Intl.NumberFormat>()

/** A count in the reader's locale, shortened the way YouTube shortens it: 1,5 Tr, 52 N, 1.5M, 52K. */
export function compactCount(value: number, locale: string) {
  let format = compactFormats.get(locale)
  if (!format)
    compactFormats.set(
      locale,
      (format = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 })),
    )
  return format.format(value)
}

/** The newest uploads, then each older part, without the videos a later part repeats. */
export function channelVideos(latest: YouTubeVideo[], older: YouTubeVideoPage[]) {
  const seen = new Set<string>()
  return [...latest, ...older.flatMap((page) => page.videos)].filter((video) => {
    if (seen.has(video.id)) return false
    seen.add(video.id)
    return true
  })
}

/** Shorts go to their own row; every other upload is a video. */
export function splitShorts(videos: YouTubeVideo[]) {
  return {
    videos: videos.filter((video) => !video.shortForm),
    shorts: videos.filter((video) => video.shortForm),
  }
}

/** The pictures YouTube keeps of a video: 1280×720 where it was uploaded in HD, 320×180 for every video. */
export function videoPicture(videoId: string, size: "hq720" | "mqdefault") {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${size}.jpg`
}

/** YouTube's own page that asks the reader to subscribe; subscribing is only possible there. */
export const subscribeUrl = (channelId: string) =>
  `https://www.youtube.com/channel/${encodeURIComponent(channelId)}?sub_confirmation=1`

export const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`

/** The privacy-enhanced player, started at once since the reader pressed the video. */
export const playerUrl = (videoId: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`
