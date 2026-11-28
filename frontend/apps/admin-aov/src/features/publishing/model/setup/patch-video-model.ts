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
const PREVIEW =
  /\b(mctn|may chu thu nghiem|thu nghiem|sap ra mat|sap tang|sap giam|du kien|leak|xem truoc|chuan bi|he lo)\b/
const TEST_SERVER = /\b(mctn|may chu thu nghiem|thu nghiem|ban test)\b/
const OVERVIEW =
  /\b(cap nhat chinh thuc|cap nhat bo sung|chi tiet (ban )?cap nhat|thay doi meta mua|ban cap nhat (chinh thuc|bo sung))\b/
const REVIEW = /\b(review|trai nghiem|thuc te|danh gia)\b/
const HERO_PREFIX = /^(phien ban moi|cap nhat moi|chinh sua moi|chinh sua|buff|nerf|lam lai|rework)\s*[:\-–]\s*/
/** A title counting changes ("11 changes", "9 heroes buffed") lists many heroes; it is not about the one it names first. */
const LIST =
  /\b(([2-9]|\d{2,})\s*(chinh sua|thay doi|sua|buff|nerf)|([2-9]|\d{2,}) tuong (chinh sua|sua|buff|nerf|duoc|bi|tang|giam)|hang chuc tuong)\b/
/** Rankings ("Top 5 heroes that counter …") and videos about the Chinese edition are not about this patch. */
const OFF_TOPIC = /\b(top \d+ (tuong|trang phuc|skin|meo|cach|chinh sua)|vgvd|vuong gia vinh dieu)\b/
/** A pro player named like a hero, or a map change, is not a hero's change. */
const NOT_A_HERO = /\b(tuyen thu|sua map|map moi)\b/
/**
 * The channel's uploads reach the editor without YouTube's shorts mark, so a short is told by its length: a minute, or up
 * to three with the hashtags shorts carry. A hero clip of two minutes is a video.
 */
const SHORT_SECONDS = { plain: 60, tagged: 180 }
const HASHTAG = /#\p{L}/u
const SKIN = /\b(skin|trang phuc)\b/
const CHANGE_WORD = /\b(buff|nerf|sua|chinh sua|rework|lam lai|tang|giam|xoa|cai tien|dai tu|tro lai|hoan thien)\b/
/** Without a "new version:" lead, only a plain change word makes a title about one hero's change. */
const HERO_CHANGE_WORD = /\b(buff|nerf|sua|chinh sua|rework|lam lai|giam|xoa|cai tien|dai tu)\b/
/** Notes go out a few days before the patch, so a summary can come that early; after it, only the first days. */
const OVERVIEW_DAYS = { before: 5, after: 3 }

const fold = (value: string) =>
  foldSearchText(value)
    .replace(/[’‘ʼ`]/g, "'")
    .replace(CHANNEL_TAG, " ")
    .replace(/\s+/g, " ")
    .trim()

/**
 * The heroes a title names, longest names first so "Kil'Groth" is not read as a shorter name hidden inside it. A name
 * found is blanked out before the next is looked for.
 */
function heroesIn(text: string, heroes: HeroName[]) {
  const names = heroes
    .flatMap((hero) => hero.names.map((name) => ({ hero, name: fold(name) })))
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
 * The one hero whose change a folded title is about, or null. A title naming two heroes is about something they share,
 * such as an item; one about skins or counting many changes is not one hero's change either.
 */
function heroChangeIn(title: string, heroes: HeroName[]) {
  if (LIST.test(title) || OFF_TOPIC.test(title) || TEST_SERVER.test(title) || NOT_A_HERO.test(title)) return null
  if (SKIN.test(title) && !CHANGE_WORD.test(title)) return null
  const prefix = title.match(HERO_PREFIX)
  if (!prefix && !HERO_CHANGE_WORD.test(title)) return null
  const named = heroesIn(prefix ? title.slice(prefix[0].length) : title, heroes)
  return named.length === 1 ? named[0] : null
}

/**
 * Guesses what a channel video is to a patch from its title and when it went up. Shorts, streams and videos outside the
 * window are left out; so is anything the title does not place, since a wrong guess costs an editor more than a miss.
 * The window stops at the neighbouring releases, so a video between two patches is never read as before the earlier one.
 * A hero's video is read as a change only after the release here; `suggestPatchVideos` also places the ones before it.
 */
export function classifyPatchVideo(
  video: ChannelVideo,
  releaseAt: number,
  heroes: HeroName[],
  nextReleaseAt?: number | null,
  previousReleaseAt?: number | null,
): PatchVideoGuess | null {
  if (isShort(video)) return null
  const at = Date.parse(video.publishedAt)
  if (!inWindow(at, releaseAt, nextReleaseAt, previousReleaseAt)) return null

  const title = fold(video.title)
  if (OFF_TOPIC.test(title)) return null
  const testServer = TEST_SERVER.test(title)
  const summary = OVERVIEW.test(title) || LIST.test(title)
  if (at < releaseAt) {
    if (testServer || (PREVIEW.test(title) && !SKIN.test(title)))
      return { video, purpose: "PATCH_PREVIEW", side: "before" }
    // A review before the release plays the patch that is live, the one before this.
    if (REVIEW.test(title)) return null
    if (summary && at >= releaseAt - OVERVIEW_DAYS.before * DAY)
      return { video, purpose: "PATCH_OVERVIEW", side: "before" }
    if (LIST.test(title)) return { video, purpose: "PATCH_PREVIEW", side: "before" }
    return null
  }
  // A test-server video after the release is already about the next patch.
  if (testServer) return null
  const hero = heroChangeIn(title, heroes)
  if (hero) return { video, purpose: "PATCH_CHANGE", heroId: hero.id, heroName: hero.name, side: "after" }
  if (REVIEW.test(title) && !(SKIN.test(title) && !CHANGE_WORD.test(title)))
    return { video, purpose: "PATCH_REVIEW", side: "after" }
  if (summary && at <= releaseAt + OVERVIEW_DAYS.after * DAY) return { video, purpose: "PATCH_OVERVIEW", side: "after" }
  return null
}

function isShort(video: ChannelVideo) {
  if (video.shortForm || video.broadcast) return true
  if (video.durationSeconds === null) return false
  return video.durationSeconds <= (HASHTAG.test(video.title) ? SHORT_SECONDS.tagged : SHORT_SECONDS.plain)
}

function inWindow(at: number, releaseAt: number, nextReleaseAt?: number | null, previousReleaseAt?: number | null) {
  const from = Math.max(releaseAt - SUGGESTION_WINDOW.beforeDays * DAY, previousReleaseAt ?? Number.NEGATIVE_INFINITY)
  const until = Math.min(releaseAt + SUGGESTION_WINDOW.afterDays * DAY, nextReleaseAt ?? Number.POSITIVE_INFINITY)
  return !Number.isNaN(at) && at >= from && at < until
}

/**
 * The guesses for one patch across a channel's videos, oldest first. Before the release, the channel already plays each
 * changed hero on the test server; such a video is read as that hero's change when the patch's own summaries, previews
 * or reviews name the hero, so a hero video is not tied to a patch that leaves the hero alone.
 */
export function suggestPatchVideos(
  videos: ChannelVideo[],
  releaseAt: number,
  heroes: HeroName[],
  nextReleaseAt?: number | null,
  previousReleaseAt?: number | null,
): PatchVideoGuess[] {
  const guesses = videos.map((video) => classifyPatchVideo(video, releaseAt, heroes, nextReleaseAt, previousReleaseAt))
  const listed = new Set(
    guesses.flatMap((guess) =>
      guess && guess.purpose !== "PATCH_CHANGE" ? heroesIn(fold(guess.video.title), heroes).map((hero) => hero.id) : [],
    ),
  )
  return videos
    .map((video, index): PatchVideoGuess | null => {
      const guess = guesses[index]
      if (guess || isShort(video)) return guess
      const at = Date.parse(video.publishedAt)
      if (at >= releaseAt || !inWindow(at, releaseAt, nextReleaseAt, previousReleaseAt)) return null
      const hero = heroChangeIn(fold(video.title), heroes)
      return hero && listed.has(hero.id)
        ? { video, purpose: "PATCH_CHANGE", heroId: hero.id, heroName: hero.name, side: "before" }
        : null
    })
    .filter((guess): guess is PatchVideoGuess => !!guess)
    .sort((a, b) => Date.parse(a.video.publishedAt) - Date.parse(b.video.publishedAt))
}

/** When a market's release starts: its exact moment, or the start of its day on the market's clock. */
export function releaseInstant(
  release: { effectiveAt: string | null; effectiveOn: string | null },
  utcOffsetHours: number,
) {
  if (release.effectiveOn) return Date.parse(`${release.effectiveOn}T00:00:00Z`) - utcOffsetHours * 3_600_000
  return release.effectiveAt ? Date.parse(release.effectiveAt) : null
}
