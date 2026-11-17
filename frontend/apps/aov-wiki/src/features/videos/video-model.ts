export {
  videoPlayback,
  videoProviderName as providerName,
  videoThumbnail,
  videoWatchUrl,
} from "@aov/ui/lib/video-playback"

export type VideoSubjectKind = "HERO" | "SKILL" | "SKIN" | "ITEM" | "ENCHANTMENT" | "ARCANA" | "SPELL"
export type VideoPurpose =
  | "INTRO"
  | "GUIDE_BASIC"
  | "GUIDE_ADVANCED"
  | "SKILL_DEMO"
  | "SKIN_SHOWCASE"
  | "SKIN_TRAILER"
  | "LORE"
  | "PATCH_CHANGE"
  | "OTHER"

export interface PublicVideo {
  id: string
  subjectKind: VideoSubjectKind
  subjectId: string
  subjectKey: string | null
  purpose: VideoPurpose
  title: string
  note: string | null
  url: string
  provider: "YOUTUBE" | "FACEBOOK" | "TIKTOK" | "TWITCH" | "OTHER"
  providerVideoId: string | null
  startSeconds: number
  durationSeconds: number | null
  channelName: string | null
  publishedOn: string | null
  patchVariantId: string | null
}

const PURPOSE_TEXT: Record<VideoPurpose, readonly [string, string]> = {
  INTRO: ["Giới thiệu", "Introduction"],
  GUIDE_BASIC: ["Cách chơi cơ bản", "Basics"],
  GUIDE_ADVANCED: ["Combo & nâng cao", "Combos & advanced"],
  SKILL_DEMO: ["Minh họa kỹ năng", "Ability demo"],
  SKIN_SHOWCASE: ["Hiệu ứng", "Effects"],
  SKIN_TRAILER: ["Trailer", "Trailer"],
  LORE: ["Cốt truyện", "Lore"],
  PATCH_CHANGE: ["Thay đổi theo bản", "Patch changes"],
  OTHER: ["Khác", "Other"],
}

export function purposeLabel(purpose: VideoPurpose, locale: string) {
  return PURPOSE_TEXT[purpose][locale === "en-US" ? 1 : 0]
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(Math.floor(seconds % 60)).padStart(2, "0")
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`
}

/**
 * A video tagged with a patch applies from that patch on, so an older version hides it. A patch missing from the reader's
 * timeline is either unpublished or from another market, and hides the video too.
 */
export function videosAtVersion<T extends Pick<PublicVideo, "patchVariantId">>(
  videos: readonly T[],
  timeline: readonly { id: string }[],
  selectedId: string | null | undefined,
) {
  const position = new Map(timeline.map((patch, index) => [patch.id, index]))
  const selected = selectedId ? position.get(selectedId) : undefined
  return videos.filter((video) => {
    if (!video.patchVariantId) return true
    const from = position.get(video.patchVariantId)
    return from !== undefined && (selected === undefined || from <= selected)
  })
}

/** Splits a hero's videos by where the page shows them. Skin videos belong to the skin viewer. */
export function splitHeroVideos<T extends Pick<PublicVideo, "subjectKind" | "subjectKey" | "purpose">>(
  videos: readonly T[],
) {
  const general: T[] = []
  const bySkill = new Map<string, T[]>()
  for (const video of videos) {
    if (video.subjectKind === "HERO") general.push(video)
    else if (video.subjectKind === "SKILL" && video.subjectKey)
      bySkill.set(video.subjectKey, [...(bySkill.get(video.subjectKey) ?? []), video])
  }
  return { general, loreCount: general.filter((video) => video.purpose === "LORE").length, bySkill }
}

/** How a reader usually looks for a video: how to play first, background later. */
const PURPOSE_ORDER: readonly VideoPurpose[] = [
  "GUIDE_BASIC",
  "GUIDE_ADVANCED",
  "SKILL_DEMO",
  "PATCH_CHANGE",
  "INTRO",
  "SKIN_SHOWCASE",
  "SKIN_TRAILER",
  "LORE",
  "OTHER",
]

/** The videos on either side of one in a list. */
export function neighbours<T extends { id: string }>(playlist: readonly T[], id: string | null | undefined) {
  const index = playlist.findIndex((video) => video.id === id)
  return {
    index,
    previous: index > 0 ? playlist[index - 1] : null,
    next: index >= 0 && index < playlist.length - 1 ? playlist[index + 1] : null,
  }
}

/** Reads the status messages the YouTube player posts to the page; state 0 means the video has finished. */
export function isVideoEndedMessage(data: unknown) {
  if (typeof data !== "string") return false
  try {
    const message = JSON.parse(data) as { event?: unknown; info?: unknown }
    if (message.event === "onStateChange") return message.info === 0
    return message.event === "infoDelivery" && (message.info as { playerState?: unknown } | null)?.playerState === 0
  } catch {
    return false
  }
}

/** Purposes present, so filters only offer what would show something. */
export function purposesIn(videos: readonly Pick<PublicVideo, "purpose">[]) {
  const present = new Set(videos.map((video) => video.purpose))
  return PURPOSE_ORDER.filter((purpose) => present.has(purpose))
}

/** Groups videos by purpose and keeps the editor's order within each group. */
export function byPurpose<T extends Pick<PublicVideo, "purpose">>(videos: readonly T[]) {
  const rank = (video: T) => PURPOSE_ORDER.indexOf(video.purpose)
  return videos
    .map((video, index) => ({ video, index }))
    .sort((a, b) => rank(a.video) - rank(b.video) || a.index - b.index)
    .map(({ video }) => video)
}
