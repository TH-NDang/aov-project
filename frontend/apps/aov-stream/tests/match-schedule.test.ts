import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView, PlannedMatch, ResolvedMatch } from "@aov/community-contracts"
import { competitionMatches } from "../src/lib/match-model.ts"
import { foldSearchText } from "@aov/ui/lib/search-text"
import {
  dayHeading,
  matchRound,
  matchSearchKey,
  matchSides,
  scheduleGroups,
  scheduleParts,
} from "../src/lib/match-schedule.ts"

const HOUR = 60 * 60 * 1000
const NOW = Date.parse("2026-11-13T05:00:00Z")
const at = (hours: number) => new Date(NOW + hours * HOUR).toISOString()

const planned = (key: string, extra: Partial<PlannedMatch> = {}): PlannedMatch => ({
  key,
  stageCode: "PLAYOFF",
  round: 1,
  label: key,
  bestOf: 5,
  a: { type: "TBD" },
  b: { type: "TBD" },
  ...extra,
})

const entries = (matches: PlannedMatch[], resolved: ResolvedMatch[] = []) =>
  competitionMatches([
    {
      id: "competition",
      content: {
        tournament: { name: "Đấu Trường Danh Vọng Mùa Đông 2026" },
        teams: {
          sgp: { code: "sgp", name: "Saigon Phantom", shortName: "SGP", logoUrl: "sgp.png", aliases: ["Bóng ma"] },
          fl: { code: "fl", name: "Team Flash" },
        },
        plan: {
          circuit: "Đấu Trường Danh Vọng",
          organizer: "Garena",
          stages: [{ code: "PLAYOFF", name: "Playoffs" }],
          matches,
        },
        resolved,
      },
    } as unknown as CompetitionView,
  ])

const scored = (key: string, scoreA: number, scoreB: number, extra: Partial<ResolvedMatch> = {}): ResolvedMatch => ({
  key,
  scoreA,
  scoreB,
  consistent: true,
  ...extra,
})

const keys = (list: { match: PlannedMatch }[]) => list.map((entry) => entry.match.key)

test("a schedule opens on what matters now and keeps what was played for after", () => {
  const { upcoming, results } = scheduleParts(
    entries(
      [
        planned("oldest", { scheduledAt: at(-900) }),
        planned("no-date"),
        planned("later", { scheduledAt: at(30) }),
        planned("latest", { scheduledAt: at(-20) }),
        planned("underway", { scheduledAt: at(-1) }),
        planned("never-entered", { scheduledAt: at(-400) }),
        planned("soon", { scheduledAt: at(3) }),
        planned("played-undated"),
      ],
      [scored("oldest", 3, 0), scored("latest", 1, 3), scored("played-undated", 3, 2)],
    ),
    NOW,
  )
  assert.deepEqual(keys(upcoming), ["underway", "soon", "later", "no-date"])
  assert.deepEqual(
    keys(results),
    ["latest", "never-entered", "oldest", "played-undated"],
    "newest first; a match that never got its result keeps its date, one without a date comes last",
  )
})

test("ordering a schedule groups by the displayed zone, keeps undated fixtures and leaves the plan untouched", () => {
  const plan = entries([
    planned("unknown"),
    planned("late", { scheduledAt: "2026-11-23T18:30:00Z" }),
    planned("early", { scheduledAt: "2026-11-23T16:30:00Z" }),
  ])
  const { upcoming } = scheduleParts(plan, NOW)
  const groups = scheduleGroups(upcoming, "Asia/Ho_Chi_Minh", NOW)
  assert.deepEqual(
    groups.map((group) => [group.key, group.items[0]?.match.key]),
    [
      ["2026-11-23", "early"],
      ["2026-11-24", "late"],
      ["open", "unknown"],
    ],
    "01:30 on the 24th in Vietnam is another day than 23:30 on the 23rd",
  )
  assert.deepEqual(keys(plan), ["unknown", "late", "early"])
})

test("matches that share a start keep the order of the plan", () => {
  const { upcoming, results } = scheduleParts(
    entries(
      [
        planned("done-1", { scheduledAt: at(-5) }),
        planned("done-2", { scheduledAt: at(-5) }),
        planned("next-1", { scheduledAt: at(5) }),
        planned("next-2", { scheduledAt: at(5) }),
      ],
      [scored("done-1", 3, 0), scored("done-2", 3, 0)],
    ),
    NOW,
  )
  assert.deepEqual(keys(upcoming), ["next-1", "next-2"])
  assert.deepEqual(keys(results), ["done-1", "done-2"])
})

test("neighbouring matches gather by the reader's day, with the live and the undated ones apart", () => {
  const { upcoming, results } = scheduleParts(
    entries(
      [
        planned("underway", { scheduledAt: at(-1) }),
        planned("tonight", { scheduledAt: at(8) }),
        planned("after-midnight", { scheduledAt: at(13) }),
        planned("no-date"),
        planned("this-morning", { scheduledAt: at(-4) }),
        planned("last-night", { scheduledAt: at(-14) }),
      ],
      [scored("this-morning", 3, 1), scored("last-night", 0, 3)],
    ),
    NOW,
  )
  const vietnam = scheduleGroups([...upcoming, ...results], "Asia/Ho_Chi_Minh", NOW)
  assert.deepEqual(
    vietnam.map((group) => [group.key, keys(group.items)]),
    [
      ["live", ["underway"]],
      ["2026-11-13", ["tonight"]],
      ["2026-11-14", ["after-midnight"]],
      ["open", ["no-date"]],
      ["2026-11-13", ["this-morning"]],
      ["2026-11-12", ["last-night"]],
    ],
    "12:00 in Vietnam: today runs from 17:00 UTC the day before",
  )
  assert.equal(vietnam[0]!.at, null)
  assert.equal(vietnam[1]!.at, NOW + 8 * HOUR)
  assert.equal(vietnam[3]!.at, null)

  const losAngeles = scheduleGroups(results, "America/Los_Angeles", NOW)
  assert.deepEqual(
    losAngeles.map((group) => [group.key, keys(group.items)]),
    [["2026-11-12", ["this-morning", "last-night"]]],
    "both were played on the 12th for a reader in Los Angeles",
  )
})

test("a day heading names today and the days next to it", () => {
  const zone = "Asia/Ho_Chi_Minh"
  assert.equal(dayHeading(NOW + 2 * HOUR, zone, NOW).near, "Hôm nay")
  assert.equal(dayHeading(NOW + 13 * HOUR, zone, NOW).near, "Ngày mai")
  assert.equal(dayHeading(NOW - 14 * HOUR, zone, NOW).near, "Hôm qua")
  assert.equal(dayHeading(NOW + 72 * HOUR, zone, NOW).near, null)
  assert.match(dayHeading(NOW + 13 * HOUR, zone, NOW).date, /14\/11\/2026$/)
  assert.equal(
    dayHeading(NOW + 13 * HOUR, "America/Los_Angeles", NOW).near,
    "Ngày mai",
    "the 13th follows the 12th there",
  )
})

test("a side shows its resolved team, score and outcome", () => {
  const [entry] = entries(
    [planned("final", { a: { type: "TEAM", teamId: "fl" }, b: { type: "SEED", seed: 2 } })],
    [scored("final", 1, 3, { teamBId: "sgp" })],
  )
  const [a, b] = matchSides(entry!)
  assert.deepEqual(
    [a.name, a.fullName, a.known, a.score, a.won, a.lost],
    ["Team Flash", "Team Flash", true, 1, false, true],
  )
  assert.deepEqual(
    [b.teamId, b.name, b.fullName, b.logoUrl, b.score, b.won],
    ["sgp", "SGP", "Saigon Phantom", "sgp.png", 3, true],
  )
})

test("a score that does not decide the match marks nobody as the winner", () => {
  const [entry] = entries(
    [planned("group", { bestOf: 2, a: { type: "TEAM", teamId: "fl" }, b: { type: "TEAM", teamId: "sgp" } })],
    [scored("group", 1, 1)],
  )
  assert.deepEqual(
    matchSides(entry!).map((side) => [side.won, side.lost]),
    [
      [false, false],
      [false, false],
    ],
  )
})

test("an open slot says how it will be filled, by the round of the match that feeds it", () => {
  const list = entries([
    planned("semi-1", { label: "Playoffs · Bán kết 1 · SGP vs FL" }),
    planned("final", {
      a: { type: "WINNER", matchKey: "semi-1" },
      b: { type: "LOSER", matchKey: "gone" },
    }),
    planned("seeded", { a: { type: "SEED", seed: 3 }, b: { type: "TBD", label: "Đội khách mời" } }),
    planned("unknown", { a: { type: "TEAM", teamId: "missing" }, b: { type: "TBD" } }),
  ])
  const names = (key: string) =>
    matchSides(list.find((entry) => entry.match.key === key)!).map((side) => [side.name, side.known])
  assert.deepEqual(names("final"), [
    ["Thắng Bán kết 1", false],
    ["Thua trận trước", false],
  ])
  assert.deepEqual(names("seeded"), [
    ["Hạt giống 3", false],
    ["Đội khách mời", false],
  ])
  assert.deepEqual(names("unknown"), [
    ["Đội chưa có thông tin", false],
    ["Chờ xác định", false],
  ])
})

test("a match is named by its round, or by its stage when the label only repeats the pairing", () => {
  const [labelled, plain, stray] = entries([
    planned("a", { label: "Playoffs · Chung kết tổng" }),
    planned("b", { label: "Playoffs · SGP vs FL" }),
    planned("c", { label: "SGP vs FL", stageCode: "GONE" }),
  ])
  assert.equal(matchRound(labelled!), "Chung kết tổng")
  assert.equal(matchRound(plain!), "Playoffs")
  assert.equal(matchRound(stray!), null)
})

test("search ignores case and tone marks and reaches teams, aliases and the competition", () => {
  const [entry] = entries([planned("m", { a: { type: "TEAM", teamId: "sgp" }, b: { type: "TEAM", teamId: "fl" } })])
  const key = matchSearchKey(entry!)
  for (const typed of ["saigon", "SGP", "bong ma", "team flash", "mua dong 2026", "garena"])
    assert.ok(key.includes(foldSearchText(typed)), typed)
  assert.ok(!key.includes(foldSearchText("box gaming")))
})
