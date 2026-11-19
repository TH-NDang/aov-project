import assert from "node:assert/strict"
import { test } from "node:test"
import {
  batches,
  cleanVideoTitle,
  foldName,
  matchSkin,
  planCrawlImport,
  readCrawlFile,
  type CrawlVideo,
} from "../src/features/videos/crawl-import"
import {
  previewLink,
  purposesFor,
  reorder,
  subjectLabel,
  subjectMatches,
  type AdminVideo,
  type VideoSubject,
} from "../src/features/videos/video-model"
import { formatClock, parseClock } from "@/lib/clock"

const hero = (id: string, code: string, name: string, aliases: string[] = []): VideoSubject => ({
  kind: "HERO",
  id,
  key: null,
  code,
  name,
  aliases,
})
const skin = (heroId: string, key: string, name: string, aliases: string[] = []): VideoSubject => ({
  kind: "SKIN",
  id: heroId,
  key,
  code: heroId,
  name,
  aliases,
})
const clip = (id: string, type: string, views = 0): CrawlVideo => ({
  id,
  title: `${id} - Garena Liên Quân Mobile`,
  type,
  duration: 40,
  date: "2025-01-23",
  views,
})
const video = (id: string, displayOrder: number): AdminVideo =>
  ({ id, displayOrder, subjectKind: "SKIN", subjectId: "h1", subjectKey: "lan-su" }) as AdminVideo

const subjects = [
  hero("h1", "allain", "Allain"),
  skin("h1", "lan-su", "Lân Sư Vũ Thần"),
  skin("h1", "bugcat", "Mèo Bugcat"),
  hero("h2", "wukong", "Ngộ Không", ["ngo-khong"]),
  skin("h2", "ton", "Tôn Hành Giả"),
  hero("h3", "riktor", "Riktor"),
  hero("h4", "flowborn-ad", "Flowborn Công"),
  hero("h5", "flowborn-mid", "Flowborn Phép"),
]

test("names compare without accents or punctuation", () => {
  assert.equal(foldName("Lân Sư - Vũ Thần!"), "lan su vu than")
  assert.equal(foldName("D'Arcy Đại"), "d arcy dai")
})

test("titles lose decoration and the repeated channel name", () => {
  assert.equal(
    cleanVideoTitle("🔥 HIỆU ỨNG CHIÊU THỨC | ALLAIN LÂN SƯ VŨ THẦN 🔥- Garena Liên Quân Mobile"),
    "HIỆU ỨNG CHIÊU THỨC | ALLAIN LÂN SƯ VŨ THẦN",
  )
  assert.equal(cleanVideoTitle("🔥"), "🔥")
})

test("skin names match exactly, partly, or with one typo, and short or unrelated names do not match", () => {
  const skins = subjects.filter((subject) => subject.id === "h1" && subject.kind === "SKIN")
  assert.deepEqual(matchSkin("lân sư vũ thần", skins), { skin: skins[0], exact: true })
  assert.equal(matchSkin("Lân Sư", skins)?.exact, false)
  assert.equal(matchSkin("Mèo Bugcag", skins)?.skin.key, "bugcat")
  assert.equal(matchSkin("Mèo Bugcag", skins)?.exact, false)
  assert.equal(matchSkin("ngoài đời thực", skins), null)
  assert.equal(matchSkin("Lân", skins), null)
  assert.equal(matchSkin("", skins), null)
})

test("a skin alias counts as an exact match", () => {
  const skins = [skin("h1", "lan-su", "Lân Sư Vũ Thần", ["Lân Sư Cũ"])]
  assert.equal(matchSkin("Lân Sư Cũ", skins)?.exact, true)
})

test("exact skin matches are published, doubtful ones wait, and other types are left out", () => {
  const plan = planCrawlImport(
    {
      skins: [
        {
          id: "a",
          hero_id: "allain",
          name: "Lân Sư Vũ Thần",
          videos: [
            clip("trailer", "skin_trailer"),
            clip("showcase", "skin_showcase"),
            clip("promo", "skin_promo"),
            clip("event", "event_promo"),
          ],
        },
        { id: "b", hero_id: "allain", name: "Lân Sư", videos: [clip("partial", "skin_showcase")] },
      ],
    },
    subjects,
  )

  const statusOf = (id: string) => plan.rows.find((row) => row.url.endsWith(id))?.status
  assert.equal(statusOf("showcase"), "PUBLISHED")
  assert.equal(statusOf("trailer"), "PUBLISHED")
  assert.equal(statusOf("promo"), "DRAFT")
  assert.equal(statusOf("partial"), "DRAFT")
  assert.equal(statusOf("event"), undefined)
  assert.equal(plan.counts.ignoredTypes, 1)
  assert.equal(plan.counts.skinPublished, 2)
  assert.equal(plan.counts.skinDraft, 2)
  // The showcase leads even though the trailer came first in the file.
  const ordered = plan.rows
    .filter((row) => row.subjectKey === "lan-su")
    .sort((a, b) => a.displayOrder! - b.displayOrder!)
  assert.ok(ordered[0].url.endsWith("showcase"))
  assert.equal(ordered[0].purpose, "SKIN_SHOWCASE")
  assert.equal(ordered[0].durationSeconds, 40)
  assert.equal(ordered[0].publishedOn, "2025-01-23")
})

test("heroes are found by code, legacy alias and the crawl's known spellings", () => {
  const story = (id: string, heroes: string[]) => ({ ...clip(id, "lore"), heroes })
  const plan = planCrawlImport(
    {
      stories: {
        lore: [story("a", ["allain"]), story("b", ["ngo-khong"]), story("c", ["richter"]), story("d", ["flowborn"])],
        comic: [story("e", ["allain", "wukong"]), story("f", [])],
        fanmade: [story("g", ["allain"])],
      },
    },
    subjects,
  )

  const targets = (id: string) =>
    plan.rows
      .filter((row) => row.url.endsWith(id))
      .map((row) => row.subjectId)
      .sort()
  assert.deepEqual(targets("=a"), ["h1"])
  assert.deepEqual(targets("=b"), ["h2"])
  assert.deepEqual(targets("=c"), ["h3"])
  assert.deepEqual(targets("=d"), ["h4", "h5"])
  assert.deepEqual(targets("=e"), ["h1", "h2"])
  assert.equal(plan.counts.storiesWithoutHero, 1)
  assert.equal(plan.rows.find((row) => row.url.endsWith("=g"))?.status, "DRAFT")
  assert.ok(plan.rows.filter((row) => !row.url.endsWith("=g")).every((row) => row.status === "PUBLISHED"))
  assert.ok(plan.rows.every((row) => row.purpose === "LORE" && row.subjectKind === "HERO" && row.subjectKey === null))
})

test("story episodes are planned from the oldest", () => {
  const episode = (id: string, date: string) => ({ ...clip(id, "comic"), date, heroes: ["allain"] })
  const plan = planCrawlImport(
    {
      stories: { comic: [episode("tap3", "2024-03-01"), episode("tap1", "2024-01-01"), episode("tap2", "2024-02-01")] },
    },
    subjects,
  )
  assert.deepEqual(
    plan.rows.map((row) => row.url.split("=")[1]),
    ["tap1", "tap2", "tap3"],
  )
})

test("unmatched skins and heroes are reported instead of guessed", () => {
  const plan = planCrawlImport(
    {
      skins: [
        { id: "a", hero_id: "batman", name: "Hiệp Sĩ", videos: [clip("x", "skin_showcase")] },
        { id: "b", hero_id: null, name: "Không tướng", videos: [clip("y", "skin_showcase")] },
        { id: "c", hero_id: "allain", name: "như thế nào", videos: [clip("z", "skin_showcase")] },
        { id: "d", hero_id: "allain", name: "Chỉ có sự kiện", videos: [clip("w", "event_promo")] },
      ],
      stories: { lore: [{ ...clip("s", "lore"), heroes: ["batman"] }] },
    },
    subjects,
  )

  assert.equal(plan.rows.length, 0)
  assert.equal(plan.unmatched.filter((entry) => entry.kind === "SKIN").length, 3)
  assert.deepEqual(
    plan.unmatched.find((entry) => entry.kind === "HERO"),
    { kind: "HERO", source: "batman", videos: 1 },
  )
})

test("guide suggestions are optional and always wait for review", () => {
  const files = { heroVideos: { allain: { spotlight: [clip("i", "hero_spotlight")], guide: [clip("g", "guide")] } } }
  assert.equal(planCrawlImport(files, subjects).rows.length, 0)

  const plan = planCrawlImport(files, subjects, { includeSuggestions: true })
  assert.equal(plan.counts.suggestions, 2)
  assert.ok(plan.rows.every((row) => row.status === "DRAFT"))
  assert.deepEqual(plan.rows.map((row) => row.purpose).sort(), ["GUIDE_BASIC", "INTRO"])
})

test("the same video under one subject is planned once", () => {
  const story = { ...clip("same", "lore"), heroes: ["allain"] }
  const plan = planCrawlImport({ stories: { lore: [story], comic: [story] } }, subjects)
  assert.equal(plan.rows.length, 1)
  assert.equal(plan.counts.storyPublished, 1)
})

test("crawl files are told apart by shape", () => {
  const skins = [{ id: "a", hero_id: "allain", name: "A", videos: [] }]
  assert.deepEqual(readCrawlFile(skins).skins, skins)
  assert.ok(readCrawlFile({ lore: [] }).stories)
  assert.ok(readCrawlFile({ allain: { spotlight: [] } }).heroVideos)
  assert.ok(readCrawlFile({ lore: [] }, { skins }).skins, "earlier files are kept")
  assert.throws(() => readCrawlFile([{ name: "other" }]))
  assert.throws(() => readCrawlFile({ other: 1 }))
  assert.throws(() => readCrawlFile("text"))
})

test("batches split without losing rows", () => {
  assert.deepEqual(batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(batches([], 2), [])
})

test("clock text converts both ways", () => {
  assert.equal(parseClock("90"), 90)
  assert.equal(parseClock("1:30"), 90)
  assert.equal(parseClock("1:02:03"), 3723)
  assert.equal(parseClock("abc"), null)
  assert.equal(parseClock(""), null)
  assert.equal(formatClock(90), "1:30")
  assert.equal(formatClock(3723), "1:02:03")
  assert.equal(formatClock(5), "0:05")
})

test("a link preview says whether the link will play on the wiki", () => {
  const youtube = previewLink("https://youtu.be/yISPe_EM4sQ?t=90")
  assert.equal(youtube.videoId, "yISPe_EM4sQ")
  assert.equal(youtube.startSeconds, 90)
  assert.ok(youtube.thumbnail?.includes("yISPe_EM4sQ"))
  assert.equal(youtube.playable, true)
  assert.equal(youtube.seekable, true)

  const facebook = previewLink("https://www.facebook.com/x/videos/1")
  assert.equal(facebook.thumbnail, null)
  assert.equal(facebook.playable, true)
  assert.equal(facebook.seekable, false)

  const short = previewLink("https://vm.tiktok.com/ZMabc/")
  assert.equal(short.playable, false)
  assert.equal(short.source?.provider, "TIKTOK")

  assert.equal(previewLink("https://example.com/page").playable, false)
  assert.equal(previewLink("not a link").source, null)
})

test("moving a video rewrites orders even when they were equal", () => {
  const moved = reorder([video("a", 0), video("b", 0), video("c", 0)], "c", -1)
  assert.deepEqual(
    moved.map(({ video: row, displayOrder }) => [row.id, displayOrder]),
    [
      ["c", 1],
      ["b", 2],
    ],
  )
})

test("moving past either end does nothing", () => {
  assert.deepEqual(reorder([video("a", 0), video("b", 1)], "a", -1), [])
  assert.deepEqual(reorder([video("a", 0), video("b", 1)], "b", 1), [])
  assert.deepEqual(reorder([video("a", 0)], "missing", 1), [])
})

test("purposes offered depend on the subject but keep the current value", () => {
  assert.equal(purposesFor("SKIN")[0], "SKIN_SHOWCASE")
  assert.equal(purposesFor("HERO")[0], "GUIDE_BASIC")
  assert.ok(!purposesFor("SKIN").includes("LORE"))
  assert.ok(purposesFor("SKIN", "LORE").includes("LORE"))
})

test("a subject is named with its hero", () => {
  assert.equal(subjectLabel(subjects, video("a", 0)), "Allain · Lân Sư Vũ Thần")
  assert.equal(subjectLabel(subjects, { ...video("a", 0), subjectKind: "HERO", subjectKey: null }), "Allain")
  assert.equal(subjectLabel([], video("a", 0)), "Tướng chưa rõ · lan-su")
})

test("a subject is found by its name typed without accents, đ included", () => {
  const subject = hero("h1", "hero-17", "Điêu Thuyền", ["Diaochan"])

  assert.equal(subjectMatches("dieu thuyen", subject), true)
  assert.equal(subjectMatches("ĐIÊU", subject), true)
  assert.equal(subjectMatches("diaochan", subject), true)
  assert.equal(subjectMatches("lauriel", subject), false)
})
