/** A YouTube video id: eleven letters, digits, dashes and underscores. */
const ID = /^[\w-]{11}$/

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
])
/** Paths whose next part is the id: a short, a stream, an embed and the old player. */
const BEFORE_ID = new Set(["shorts", "live", "embed", "v"])

/**
 * The video a reader pasted: a link to it on YouTube in any of its forms, or the bare id. Anything else, a channel or
 * a playlist without a video among them, is no video.
 */
export function videoIdOf(text: string): string | null {
  const pasted = text.trim()
  if (ID.test(pasted)) return pasted
  let url: URL
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(pasted) ? pasted : `https://${pasted}`)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split("/").filter(Boolean)
  const id =
    host === "youtu.be"
      ? parts[0]
      : !HOSTS.has(host)
        ? null
        : parts[0] === "watch"
          ? url.searchParams.get("v")
          : BEFORE_ID.has(parts[0] ?? "")
            ? parts[1]
            : null
  return id && ID.test(id) ? id : null
}

/** The page of a video on YouTube, for the reader who wants it there. */
export const watchOnYouTube = (video: string) => `https://www.youtube.com/watch?v=${video}`

/** A small picture of a video, 320 × 180, which YouTube keeps for every video. */
export const videoPicture = (video: string) => `https://i.ytimg.com/vi/${video}/mqdefault.jpg`
