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

/** The channel signs every title with its own name, which says nothing about the video. */
const CHANNEL_TAG = /\b(trai nghiem game|tng)\b/g
const PREVIEW = /\b(mctn|may chu thu nghiem|thu nghiem|sap ra mat|sap tang|sap giam|du kien|leak|xem truoc)\b/
const TEST_SERVER = /\b(mctn|may chu thu nghiem|thu nghiem|ban test)\b/
const OVERVIEW =
  /\b(cap nhat chinh thuc|cap nhat bo sung|chi tiet (ban )?cap nhat|thay doi meta mua|ban cap nhat (chinh thuc|bo sung)|\d+ (chinh sua|thay doi|sua) (tuong|bug))\b/
const REVIEW = /\b(review|trai nghiem|thuc te|danh gia)\b/
const HERO_PREFIX = /^(phien ban moi|cap nhat moi|chinh sua|buff|nerf|lam lai|rework)\s*[:\-–]\s*/
/** A title counting changes ("11 changes", "8 buffs") is about many heroes, not the one it names first. */
const MANY_HEROES = /\b(\d+\s*(tuong|chinh sua|buff|nerf)|hang chuc tuong)\b/
const SKIN = /\b(skin|trang phuc)\b/
const CHANGE_WORD = /\b(buff|nerf|sua|chinh sua|rework|lam lai|tang|giam|xoa|cai tien|dai tu|tro lai|hoan thien)\b/

/**
 * The heroes a title names, longest names first so "Kil'Groth" is not read as a shorter name hidden inside it. A name
 * found is blanked out before the next is looked for.
 */
function heroesIn(text: string, heroes: HeroName[]) {
  const names = heroes
    .flatMap((hero) => hero.names.map((name) => ({ hero, name: foldSearchText(name).trim() })))
    .filter((entry) => entry.name.length > 1)
    .sort((a, b) => b.name.length - a.name.length)
  const found: { id: string; name: string }[] = []
  let rest = text
  for (const entry of names) {
    const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u")
    if (!pattern.test(rest)) continue
    rest = rest.replace(pattern, "$1 $2")
    if (!found.some((hero) => hero.id === entry.hero.id)) found.push({ id: entry.hero.id, name: entry.hero.names[0] })
  }
  return found
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

  const title = foldSearchText(video.title).replace(CHANNEL_TAG, " ").replace(/\s+/g, " ").trim()
  const side = at < releaseAt ? "before" : "after"
  const testServer = TEST_SERVER.test(title)
  const aboutSkins = SKIN.test(title) && !CHANGE_WORD.test(title)
  const prefix = title.match(HERO_PREFIX)
  if (prefix && side === "after" && !testServer && !aboutSkins && !MANY_HEROES.test(title)) {
    const named = heroesIn(title.slice(prefix[0].length), heroes)
    // A title naming two heroes is about something they share, such as an item, not one hero's change.
    if (named.length === 1)
      return { video, purpose: "PATCH_CHANGE", heroId: named[0].id, heroName: named[0].name, side }
  }
  if (side === "before" && PREVIEW.test(title) && (testServer || !SKIN.test(title)))
    return { video, purpose: "PATCH_PREVIEW", side }
  if (side === "after" && !testServer && !aboutSkins && REVIEW.test(title))
    return { video, purpose: "PATCH_REVIEW", side }
  if (OVERVIEW.test(title) && Math.abs(at - releaseAt) <= 3 * DAY) return { video, purpose: "PATCH_OVERVIEW", side }
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
