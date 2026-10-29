/** A stoppage inside the broadcast: the game clock holds at `atSeconds` for `durationSeconds` of video. */
export type VodPause = { atSeconds: number; durationSeconds: number }

/** Maps the in-game clock onto one official broadcast video that may contain several games and pauses. */
export type VodSync = { url: string; startSecond: number | null; pauses: VodPause[] }

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"])

export function youtubeVideoId(url?: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== "https:" || !YOUTUBE_HOSTS.has(parsed.hostname)) return null
    const id = parsed.hostname.endsWith("youtu.be")
      ? parsed.pathname.slice(1).split("/")[0]
      : parsed.pathname === "/watch"
        ? parsed.searchParams.get("v")
        : parsed.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)\/?$/)?.[1]
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** Reads `t=` / `start=` from a pasted YouTube link (e.g. `?t=1h02m03s` or `&t=3723`). */
export function youtubeLinkTime(url?: string | null): number | null {
  if (!url) return null
  try {
    const parsed = new URL(url.trim())
    const value = parsed.searchParams.get("t") ?? parsed.searchParams.get("start")
    if (!value) return null
    if (/^\d+s?$/.test(value)) return Number.parseInt(value, 10)
    const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
    if (!match || !match[0]) return null
    return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
  } catch {
    return null
  }
}

export const youtubeWatchUrl = (videoId: string, seconds?: number | null) =>
  `https://www.youtube.com/watch?v=${videoId}${seconds != null && seconds >= 0 ? `&t=${Math.floor(seconds)}s` : ""}`

export const youtubeThumbnail = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

const sortedPauses = (pauses: VodPause[]) =>
  pauses.filter((pause) => pause.durationSeconds > 0 && pause.atSeconds >= 0).sort((a, b) => a.atSeconds - b.atSeconds)

/** Video position for a game second, or null while the game start has not been synced. */
export function gameToVideo(sync: VodSync, gameSecond: number): number | null {
  if (sync.startSecond == null) return null
  const paused = sortedPauses(sync.pauses)
    .filter((pause) => pause.atSeconds < gameSecond)
    .reduce((total, pause) => total + pause.durationSeconds, 0)
  return sync.startSecond + gameSecond + paused
}

/** Game clock shown at a video position; clamps to 0 before the game starts and holds during pauses. */
export function videoToGame(sync: VodSync, videoSecond: number): number | null {
  if (sync.startSecond == null) return null
  let remaining = videoSecond - sync.startSecond
  if (remaining <= 0) return 0
  for (const pause of sortedPauses(sync.pauses)) {
    if (remaining <= pause.atSeconds) return remaining
    if (remaining <= pause.atSeconds + pause.durationSeconds) return pause.atSeconds
    remaining -= pause.durationSeconds
  }
  return remaining
}

/** Play triangle forced to text presentation; Windows otherwise draws U+25B6 as a blue emoji tile. */
export const VIDEO_MARK = String.fromCodePoint(0x25b6, 0xfe0e)

/** `m:ss` under an hour, `h:mm:ss` otherwise. */
export function formatClock(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--:--"
  const total = Math.max(0, Math.floor(value))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, "0")
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`
}

/** Accepts `90`, `1:30`, `1:02:03`; returns null for anything else. */
export function parseClock(value: string): number | null {
  const input = value.trim()
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(input)) return null
  const parts = input.split(":").map(Number)
  if (parts.slice(1).some((part) => part >= 60)) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}
