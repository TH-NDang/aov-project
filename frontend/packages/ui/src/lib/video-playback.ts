export type VideoProvider = "YOUTUBE" | "FACEBOOK" | "TIKTOK" | "TWITCH" | "OTHER"

export interface VideoSource {
  url: string
  provider: VideoProvider
  providerVideoId: string | null
  startSeconds: number
}

export type VideoPlayback = { kind: "frame"; src: string; portrait: boolean } | { kind: "file"; src: string }

const PROVIDER_NAMES: Record<VideoProvider, string> = {
  YOUTUBE: "YouTube",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  TWITCH: "Twitch",
  OTHER: "",
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "youtu.be", "youtube-nocookie.com"])
const YOUTUBE_PATHS = new Set(["embed", "shorts", "live", "v"])
const YOUTUBE_ID = /^[\w-]{11}$/
/** Twitch pages that share the shape of a channel link. */
const TWITCH_PAGES = new Set([
  "directory",
  "downloads",
  "jobs",
  "login",
  "search",
  "settings",
  "signup",
  "turbo",
  "videos",
])

export function videoProviderName(video: Pick<VideoSource, "provider">) {
  return PROVIDER_NAMES[video.provider]
}

function parseUrl(url: string) {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null
  } catch {
    return null
  }
}

const hostOf = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m|music)\./, "")
const onDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

function youtubeSource(url: URL, host: string) {
  const segments = url.pathname.split("/").filter(Boolean)
  const candidate =
    host === "youtu.be"
      ? segments[0]
      : segments.length === 1 && segments[0] === "watch"
        ? url.searchParams.get("v")
        : segments.length >= 2 && YOUTUBE_PATHS.has(segments[0])
          ? segments[1]
          : null
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null
}

function startFromLink(url: URL) {
  const value = url.searchParams.get("t") ?? url.searchParams.get("start")
  const clock = value?.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  if (!value || !clock) return 0
  return Number(clock[1] ?? 0) * 3600 + Number(clock[2] ?? 0) * 60 + Number(clock[3] ?? 0)
}

/**
 * Reads a pasted link the way the backend will store it, so a form can show what will happen before saving. The backend
 * still decides what is stored.
 */
export function readVideoLink(text: string): VideoSource | null {
  const url = parseUrl(text)
  if (!url) return null

  const host = hostOf(url)
  if (YOUTUBE_HOSTS.has(host)) {
    const id = youtubeSource(url, host)
    return {
      url: id ? `https://www.youtube.com/watch?v=${id}` : text.trim(),
      provider: "YOUTUBE",
      providerVideoId: id,
      startSeconds: startFromLink(url),
    }
  }
  const provider: VideoProvider =
    onDomain(host, "facebook.com") || onDomain(host, "fb.watch")
      ? "FACEBOOK"
      : onDomain(host, "tiktok.com")
        ? "TIKTOK"
        : onDomain(host, "twitch.tv")
          ? "TWITCH"
          : "OTHER"
  return { url: text.trim(), provider, providerVideoId: null, startSeconds: 0 }
}

function twitchTime(seconds: number) {
  if (seconds <= 0) return ""
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `&time=${hours}h${minutes}m${Math.floor(seconds % 60)}s`
}

function twitchFrame(url: URL, host: string, startSeconds: number, parent: string) {
  const query = `parent=${encodeURIComponent(parent)}&autoplay=true`
  const segments = url.pathname.split("/").filter(Boolean)
  const clip = host === "clips.twitch.tv" ? segments[0] : segments[1] === "clip" ? segments[2] : null
  if (clip) return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip)}&${query}`
  if (segments[0] === "videos" && /^\d+$/.test(segments[1] ?? ""))
    return `https://player.twitch.tv/?video=v${segments[1]}&${query}${twitchTime(startSeconds)}`
  if (segments.length === 1 && /^\w{3,25}$/.test(segments[0]) && !TWITCH_PAGES.has(segments[0].toLowerCase()))
    return `https://player.twitch.tv/?channel=${encodeURIComponent(segments[0])}&${query}`
  return null
}

/**
 * How a video can be watched inside the page, or null when its link can only be opened on its own site. Short links that
 * need a redirect to reveal the video, such as vm.tiktok.com, cannot be resolved from the browser and stay links.
 *
 * @param pageHostname host of the current page; Twitch refuses to play on a host it was not told about
 */
export function videoPlayback(video: VideoSource, pageHostname: string): VideoPlayback | null {
  const url = parseUrl(video.url)
  if (!url) return null

  const host = hostOf(url)
  if (video.provider === "YOUTUBE") {
    const query = new URLSearchParams({ autoplay: "1", rel: "0" })
    if (video.providerVideoId) {
      if (video.startSeconds > 0) query.set("start", String(video.startSeconds))
      return {
        kind: "frame",
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.providerVideoId)}?${query}`,
        portrait: false,
      }
    }
    const list = url.searchParams.get("list")
    if (!list) return null
    query.set("list", list)
    return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/videoseries?${query}`, portrait: false }
  }
  if (video.provider === "FACEBOOK") {
    const reel = /^\/(?:[^/]+\/)?(?:reel|share\/r)(?:\/|$)/.test(url.pathname)
    const isVideo = host === "fb.watch" || reel || /^\/(?:[^/]+\/)?(?:videos|watch|share\/v)(?:\/|$)/.test(url.pathname)
    if (!isVideo) return null
    const query = new URLSearchParams({ href: url.href, show_text: "false", autoplay: "true" })
    return { kind: "frame", src: `https://www.facebook.com/plugins/video.php?${query}`, portrait: reel }
  }
  if (video.provider === "TIKTOK") {
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1]
    return id
      ? { kind: "frame", src: `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0&description=0`, portrait: true }
      : null
  }
  if (video.provider === "TWITCH") {
    const src = pageHostname ? twitchFrame(url, host, video.startSeconds, pageHostname) : null
    return src ? { kind: "frame", src, portrait: false } : null
  }
  // A page cannot load an insecure file once it is served over https.
  if (url.protocol === "https:" && /\.(?:mp4|webm|ogv|m4v)$/i.test(url.pathname))
    return { kind: "file", src: video.startSeconds > 0 ? `${url.href}#t=${video.startSeconds}` : url.href }
  return null
}

/** Whether a chosen start point has any effect on this video. */
export function videoCanSeek(video: VideoSource, pageHostname: string) {
  const playback = videoPlayback({ ...video, startSeconds: 1 }, pageHostname)
  return !!playback && /[?&#](?:start|t|time)=/.test(playback.src)
}

export function videoThumbnail(video: Pick<VideoSource, "providerVideoId">, size: "mq" | "hq" = "hq") {
  return video.providerVideoId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(video.providerVideoId)}/${size}default.jpg`
    : null
}

export function videoWatchUrl(video: Pick<VideoSource, "url" | "providerVideoId" | "startSeconds">) {
  return video.providerVideoId && video.startSeconds > 0 ? `${video.url}&t=${video.startSeconds}s` : video.url
}
