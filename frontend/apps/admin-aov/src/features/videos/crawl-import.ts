import type { VideoPurpose, VideoStatus, VideoSubject, VideoSubjectKind } from "./video-model"
import { normalize } from "@/lib/text"

/** Files produced by the lienquan-youtube-crawl analysis (`analysis/results/catalog`). */
export interface CrawlVideo {
  id: string
  title: string
  date?: string | null
  type: string
  source_type?: string
  duration?: number | null
  views?: number | null
}

export interface CrawlSkin {
  id: string
  hero_id: string | null
  hero?: string
  name: string
  videos: CrawlVideo[]
}

export interface CrawlStory extends CrawlVideo {
  heroes: string[]
}

export type CrawlStories = Partial<Record<"lore" | "comic" | "animation" | "fanmade", CrawlStory[]>>
export type CrawlHeroVideos = Record<string, Partial<Record<"spotlight" | "guide", CrawlVideo[]>>>

export interface CrawlFiles {
  skins?: CrawlSkin[]
  stories?: CrawlStories
  heroVideos?: CrawlHeroVideos
}

export interface ImportVideo {
  subjectKind: VideoSubjectKind
  subjectId: string
  subjectKey: string | null
  purpose: VideoPurpose
  title: string
  url: string
  durationSeconds: number | null
  publishedOn: string | null
  displayOrder: number | null
  status: VideoStatus
}

export interface UnmatchedEntry {
  kind: "HERO" | "SKIN"
  source: string
  videos: number
}

export interface ImportPlan {
  rows: ImportVideo[]
  counts: {
    skinPublished: number
    skinDraft: number
    storyPublished: number
    storyDraft: number
    suggestions: number
    ignoredTypes: number
    storiesWithoutHero: number
  }
  unmatched: UnmatchedEntry[]
}

/** Crawl hero ids that differ from wiki codes and are not recorded as legacy aliases. */
const HERO_CODES: Record<string, readonly string[]> = {
  "lu-bo": ["lu-bu"],
  richter: ["riktor"],
  jinna: ["jinnar"],
  "dieu-thuyen": ["diaochan"],
  "trieu-van": ["zanis"],
  flowborn: ["flowborn-ad", "flowborn-mid"],
}

/** Skin video types worth attaching, best first. A promo is usually a short teaser, so it waits for review. */
const SKIN_TYPES: Record<string, { purpose: VideoPurpose; rank: number; review?: true }> = {
  skin_showcase: { purpose: "SKIN_SHOWCASE", rank: 0 },
  skin_vfx_film: { purpose: "SKIN_SHOWCASE", rank: 1 },
  skin_trailer: { purpose: "SKIN_TRAILER", rank: 2 },
  skin_select_screen: { purpose: "SKIN_SHOWCASE", rank: 3 },
  skin_promo: { purpose: "SKIN_TRAILER", rank: 4, review: true },
}

const MAX_TITLE = 300
const MIN_PARTIAL_NAME = 4

/** Compares names without accents, case or punctuation. */
export function foldName(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Removes decoration and the channel suffix that official titles repeat. */
export function cleanVideoTitle(title: string) {
  const text = title
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/\s*[-–|]\s*Garena Liên Quân Mobile\s*$/iu, "")
    .replace(/\s+/g, " ")
    .trim()
  return (text || title.trim()).slice(0, MAX_TITLE)
}

/** One typo is forgiven for longer names: the crawl spells some skins differently from the wiki. */
function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export function matchSkin(name: string, skins: readonly VideoSubject[]) {
  const wanted = foldName(name)
  if (!wanted) return null
  const names = skins.map((skin) => ({ skin, names: [skin.name, ...skin.aliases].map(foldName).filter(Boolean) }))

  const exact = names.find(({ names }) => names.includes(wanted))
  if (exact) return { skin: exact.skin, exact: true }

  const near = names.find(({ names }) =>
    names.some(
      (other) =>
        (Math.min(other.length, wanted.length) >= MIN_PARTIAL_NAME &&
          (other.includes(wanted) || wanted.includes(other))) ||
        (Math.min(other.length, wanted.length) >= 6 && withinOneEdit(other, wanted)),
    ),
  )
  return near ? { skin: near.skin, exact: false } : null
}

function heroIndex(subjects: readonly VideoSubject[]) {
  const index = new Map<string, VideoSubject>()
  for (const subject of subjects) {
    if (subject.kind !== "HERO") continue
    index.set(subject.code, subject)
    for (const alias of subject.aliases) if (!index.has(alias)) index.set(alias, subject)
  }
  return index
}

function row(
  subject: Pick<VideoSubject, "kind" | "id" | "key">,
  video: CrawlVideo,
  purpose: VideoPurpose,
  status: VideoStatus,
  displayOrder: number | null,
): ImportVideo {
  return {
    subjectKind: subject.kind,
    subjectId: subject.id,
    subjectKey: subject.key,
    purpose,
    title: cleanVideoTitle(video.title),
    url: `https://www.youtube.com/watch?v=${video.id}`,
    durationSeconds: video.duration && video.duration > 0 ? Math.round(video.duration) : null,
    publishedOn: video.date || null,
    displayOrder,
    status,
  }
}

/**
 * Decides what to attach from the crawl (ADR-019): only what can be matched confidently is published, doubtful matches
 * wait for review, and everything else is left out and reported.
 */
export function planCrawlImport(
  files: CrawlFiles,
  subjects: readonly VideoSubject[],
  { includeSuggestions = false }: { includeSuggestions?: boolean } = {},
): ImportPlan {
  const heroes = heroIndex(subjects)
  const heroTargets = (crawlId: string | null | undefined) => {
    if (!crawlId) return []
    const codes = HERO_CODES[crawlId] ?? [crawlId]
    return codes.map((code) => heroes.get(code)).filter((hero): hero is VideoSubject => !!hero)
  }
  const skinsByHero = new Map<string, VideoSubject[]>()
  for (const subject of subjects) {
    if (subject.kind !== "SKIN") continue
    skinsByHero.set(subject.id, [...(skinsByHero.get(subject.id) ?? []), subject])
  }

  const rows: ImportVideo[] = []
  const seen = new Set<string>()
  const add = (candidate: ImportVideo) => {
    const key = `${candidate.subjectKind}|${candidate.subjectId}|${candidate.subjectKey}|${candidate.url}`
    if (seen.has(key)) return false
    seen.add(key)
    rows.push(candidate)
    return true
  }
  const counts = {
    skinPublished: 0,
    skinDraft: 0,
    storyPublished: 0,
    storyDraft: 0,
    suggestions: 0,
    ignoredTypes: 0,
    storiesWithoutHero: 0,
  }
  const unmatched: UnmatchedEntry[] = []

  for (const skin of files.skins ?? []) {
    const wanted = skin.videos
      .filter((video) => {
        if (SKIN_TYPES[video.type]) return true
        counts.ignoredTypes++
        return false
      })
      .sort((a, b) => SKIN_TYPES[a.type].rank - SKIN_TYPES[b.type].rank || (b.views ?? 0) - (a.views ?? 0))
    if (!wanted.length) continue

    const owners = heroTargets(skin.hero_id)
    const match = owners
      .map((hero) => matchSkin(skin.name, skinsByHero.get(hero.id) ?? []))
      .find((candidate) => candidate !== null)
    if (!match) {
      unmatched.push({
        kind: "SKIN",
        source: `${skin.hero ?? skin.hero_id ?? "Chưa rõ tướng"} · ${skin.name}`,
        videos: wanted.length,
      })
      continue
    }

    wanted.forEach((video, displayOrder) => {
      const type = SKIN_TYPES[video.type]
      const status: VideoStatus = match.exact && !type.review ? "PUBLISHED" : "DRAFT"
      if (add(row(match.skin, video, type.purpose, status, displayOrder))) {
        if (status === "PUBLISHED") counts.skinPublished++
        else counts.skinDraft++
      }
    })
  }

  const unknownHeroes = new Map<string, number>()
  for (const [group, stories] of Object.entries(files.stories ?? {})) {
    const status: VideoStatus = group === "fanmade" ? "DRAFT" : "PUBLISHED"
    // The crawl lists newest first, but episodes read from the first one.
    const oldestFirst = [...(stories ?? [])].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    for (const story of oldestFirst) {
      if (!story.heroes?.length) {
        counts.storiesWithoutHero++
        continue
      }
      for (const crawlId of story.heroes) {
        const targets = heroTargets(crawlId)
        if (!targets.length) unknownHeroes.set(crawlId, (unknownHeroes.get(crawlId) ?? 0) + 1)
        for (const hero of targets) {
          if (add(row(hero, story, "LORE", status, null))) {
            if (status === "PUBLISHED") counts.storyPublished++
            else counts.storyDraft++
          }
        }
      }
    }
  }

  if (includeSuggestions) {
    for (const [crawlId, tabs] of Object.entries(files.heroVideos ?? {})) {
      for (const hero of heroTargets(crawlId)) {
        for (const video of tabs.spotlight ?? [])
          if (add(row(hero, video, "INTRO", "DRAFT", null))) counts.suggestions++
        for (const video of tabs.guide ?? [])
          if (add(row(hero, video, "GUIDE_BASIC", "DRAFT", null))) counts.suggestions++
      }
    }
  }

  for (const [source, videos] of unknownHeroes) unmatched.push({ kind: "HERO", source, videos })
  unmatched.sort((a, b) => b.videos - a.videos || a.source.localeCompare(b.source))

  return { rows, counts, unmatched }
}

/** Tells the crawl's JSON files apart by their shape, so they can be dropped in any order. */
export function readCrawlFile(value: unknown, into: CrawlFiles = {}): CrawlFiles {
  if (Array.isArray(value)) {
    if (value.length && value.every((entry) => Array.isArray((entry as CrawlSkin)?.videos)))
      return { ...into, skins: value as CrawlSkin[] }
    throw new Error("Tệp này không phải danh mục trang phục của dữ liệu thu thập.")
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (["lore", "comic", "animation"].some((key) => Array.isArray(record[key])))
      return { ...into, stories: record as CrawlStories }
    const first = Object.values(record)[0] as Record<string, unknown> | undefined
    if (first && (Array.isArray(first.spotlight) || Array.isArray(first.guide)))
      return { ...into, heroVideos: record as CrawlHeroVideos }
  }
  throw new Error("Không nhận ra tệp này. Hãy chọn skins.json, stories.json hoặc hero-videos.json.")
}

export function batches<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = []
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size))
  return result
}
