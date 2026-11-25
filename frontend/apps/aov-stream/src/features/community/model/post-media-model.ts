/** How a video link is shown: YouTube plays inline, other platforms open in a new tab. */
export type VideoEmbed = { kind: "youtube"; src: string } | { kind: "link"; platform: string; href: string }

const youtubeId = /^[\w-]{11}$/

/** The privacy-enhanced YouTube player for watch, short, live and youtu.be links; a link card otherwise. */
export function videoEmbed(url: string): VideoEmbed | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  const host = parsed.hostname.replace(/^(www|m)\./, "")
  let id: string | null = null
  if (host === "youtu.be") id = parsed.pathname.slice(1)
  else if (host === "youtube.com") {
    const [, section, value] = parsed.pathname.split("/")
    id =
      section === "watch" ? parsed.searchParams.get("v") : ["shorts", "live", "embed"].includes(section) ? value : null
  }
  if (id && youtubeId.test(id)) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` }
  const platform = host.endsWith("facebook.com")
    ? "Facebook"
    : host.endsWith("tiktok.com")
      ? "TikTok"
      : host.endsWith("twitch.tv")
        ? "Twitch"
        : host.endsWith("youtube.com")
          ? "YouTube"
          : host
  return { kind: "link", platform, href: parsed.toString() }
}

/**
 * The picture YouTube keeps for a video. `hqdefault` exists for every video; it is 4:3 with bars above and below a
 * 16:9 frame, which a 16:9 box with `object-fit: cover` crops away. `mqdefault` is smaller and 16:9 without bars,
 * for tiles of any shape. `hq720` is sharp at the width of a feed, and missing for a video that is not in HD.
 */
export function videoPoster(embed: VideoEmbed, size: "hqdefault" | "mqdefault" | "hq720" = "hqdefault") {
  return embed.kind === "youtube" ? `https://i.ytimg.com/vi/${embed.src.split("/").pop()}/${size}.jpg` : null
}
