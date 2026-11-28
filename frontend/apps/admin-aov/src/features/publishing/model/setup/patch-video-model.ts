import { foldSearchText } from "@aov/ui/lib/search-text"

/** One upload of a channel, as the community channel reader returns it (ADR-034). */
export interface ChannelVideo {
  id: string
  title: string
  publishedAt: string
  durationSeconds: number | null
  broadcast: "LIVE" | "UPCOMING" | null
  shortForm: boolean
}

export interface HeroName {
  id: string
  names: string[]
}

export type PatchVideoPurpose = "PATCH_PREVIEW" | "PATCH_OVERVIEW" | "PATCH_REVIEW" | "PATCH_CHANGE"

/** What a channel video probably is for a patch; the editor checks it before it is saved. */
export interface PatchVideoGuess {
  video: ChannelVideo
  purpose: PatchVideoPurpose
  /** The hero a PATCH_CHANGE video is about. */
  heroId?: string
  heroName?: string
  side: "before" | "after"
}

const DAY = 86_400_000
/** How far around a release a channel's videos are read: test-server previews come days ahead, reviews weeks after. */
export const SUGGESTION_WINDOW = { beforeDays: 14, afterDays: 21 }

const PREVIEW = /\b(mctn|may chu thu nghiem|thu nghiem|sap ra mat|sap tang|sap giam|du kien|leak|xem truoc)\b/
const OVERVIEW =
  /\b(cap nhat chinh thuc|cap nhat bo sung|chi tiet (ban )?cap nhat|thay doi meta|ban cap nhat|tong hop|chinh thuc)\b/
const REVIEW = /\b(review|trai nghiem|thuc te|danh gia)\b/
const HERO_PREFIX = /^(phien ban moi|cap nhat moi|chinh sua|buff|nerf|lam lai|rework)\s*[:\-–]\s*/

/** Longest names first, so "Kil'Groth" is not read as a shorter name hidden inside it. */
function heroIn(text: string, heroes: HeroName[]) {
  const names = heroes
    .flatMap((hero) => hero.names.map((name) => ({ hero, name: foldSearchText(name).trim() })))
    .filter((entry) => entry.name.length > 1)
    .sort((a, b) => b.name.length - a.name.length)
  for (const entry of names) {
    const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(text))
      return { id: entry.hero.id, name: entry.hero.names[0] }
  }
  return null
}

/**
 * Guesses what a channel video is to a patch from its title and when it went up. Shorts, streams and videos outside the
 * window are left out; so is anything the title does not place, since a wrong guess costs an editor more than a miss.
 */
export function classifyPatchVideo(
  video: ChannelVideo,
  releaseAt: number,
  heroes: HeroName[],
  nextReleaseAt?: number | null,
): PatchVideoGuess | null {
  if (video.shortForm || video.broadcast) return null
  const at = Date.parse(video.publishedAt)
  const until = Math.min(releaseAt + SUGGESTION_WINDOW.afterDays * DAY, nextReleaseAt ?? Number.POSITIVE_INFINITY)
  if (Number.isNaN(at) || at < releaseAt - SUGGESTION_WINDOW.beforeDays * DAY || at >= until) return null

  const title = foldSearchText(video.title).replace(/\s+/g, " ").trim()
  const side = at < releaseAt ? "before" : "after"
  const prefix = title.match(HERO_PREFIX)
  if (prefix && side === "after") {
    const hero = heroIn(title.slice(prefix[0].length), heroes)
    if (hero) return { video, purpose: "PATCH_CHANGE", heroId: hero.id, heroName: hero.name, side }
  }
  if (side === "before" && PREVIEW.test(title)) return { video, purpose: "PATCH_PREVIEW", side }
  if (OVERVIEW.test(title) && Math.abs(at - releaseAt) <= 3 * DAY) return { video, purpose: "PATCH_OVERVIEW", side }
  if (side === "after" && REVIEW.test(title)) return { video, purpose: "PATCH_REVIEW", side }
  return null
}

/** When a market's release starts: its exact moment, or the start of its day on the market's clock. */
export function releaseInstant(
  release: { effectiveAt: string | null; effectiveOn: string | null },
  utcOffsetHours: number,
) {
  if (release.effectiveOn) return Date.parse(`${release.effectiveOn}T00:00:00Z`) - utcOffsetHours * 3_600_000
  return release.effectiveAt ? Date.parse(release.effectiveAt) : null
}
