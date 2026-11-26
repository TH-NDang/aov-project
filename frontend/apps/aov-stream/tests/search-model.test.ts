import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView } from "@aov/community-contracts"
import {
  leadingCompetitions,
  markMatch,
  matchingCompetitions,
  matchRank,
  rankGroups,
  withSearch,
} from "../src/lib/search-model.ts"
import { competition, on } from "./fixtures/competition.ts"

const event = (id: string, tournament: object, plan: object = {}): CompetitionView =>
  competition([], { id, tournament: { name: id, ...tournament }, plan })
const ids = (views: CompetitionView[]) => views.map((view) => view.id)

test("a name that is the search ranks above one that starts with it, and that one above one that holds it", () => {
  assert.equal(matchRank(["ONE"], "one"), 0)
  assert.equal(matchRank(["ONE Team"], "one"), 1)
  assert.equal(matchRank(["One Star Esports"], "star"), 1)
  assert.equal(matchRank(["JangOne"], "one"), 2)
  assert.equal(matchRank(["Buriram United"], "one"), 3)
  assert.equal(matchRank(["Đấu Trường Danh Vọng"], "dau truong"), 1)
  assert.equal(matchRank([null, "BMG"], "bmg"), 0)
  assert.equal(matchRank(["ONE"], "  "), 3)
})

test("competitions come closest name first, then those not over, then the newest", () => {
  const now = Date.parse(on(26))
  const views = [
    event("Premier League 2025", { year: 2025, status: "FINISHED" }),
    event("Pro League 2026", { year: 2026, status: "FINISHED" }),
    event("Premier League 2026", { year: 2026, status: "ONGOING" }),
    event("League", { year: 2024, status: "FINISHED" }),
    event("Showdown", { year: 2026, status: "ONGOING" }),
  ]

  assert.deepEqual(ids(matchingCompetitions(views, "league", now)), [
    "League",
    "Premier League 2026",
    "Pro League 2026",
    "Premier League 2025",
  ])
})

test("before a search, what is on and what comes next are offered, then what ended last", () => {
  const now = Date.parse(on(26))
  const views = [
    event("old", { status: "FINISHED", startsOn: "2026-01-01", endsOn: "2026-01-20" }),
    event("recent", { status: "FINISHED", startsOn: "2026-10-01", endsOn: "2026-11-01" }),
    event("next", { status: "UPCOMING", startsOn: "2026-12-01" }),
    event("on", { status: "ONGOING", startsOn: "2026-11-10", endsOn: "2026-12-10" }),
  ]

  assert.deepEqual(ids(leadingCompetitions(views, 3, now)), ["on", "next", "recent"])
  assert.deepEqual(ids(leadingCompetitions(views, 1, now)), ["on"])
})

test("the matching part of a name is cut out as written, whatever its accents", () => {
  assert.deepEqual(markMatch("Đấu Trường Danh Vọng", "truong"), [
    { text: "Đấu ", hit: false },
    { text: "Trường", hit: true },
    { text: " Danh Vọng", hit: false },
  ])
  assert.deepEqual(markMatch("JangOne", "one"), [
    { text: "Jang", hit: false },
    { text: "One", hit: true },
  ])
  assert.deepEqual(markMatch("Buriram", "one"), [{ text: "Buriram", hit: false }])
})

test("a search joins the recent ones once, newest first, and the list keeps its size", () => {
  assert.deepEqual(withSearch(["one", "bmg"], "  Buriram  "), ["Buriram", "one", "bmg"])
  assert.deepEqual(withSearch(["one", "bmg"], "BMG"), ["BMG", "one"])
  assert.deepEqual(withSearch(["a", "b", "c"], "d", 3), ["d", "a", "b"])
  assert.deepEqual(withSearch(["a"], " "), ["a"])
})

test("the group holding the closest name comes first; equal groups keep their order and empty ones go", () => {
  const groups = [
    { key: "TEAM", ranks: [2, 2] as const },
    { key: "COMPETITION", ranks: [1] as const },
    { key: "PLAYER", ranks: [] as const },
    { key: "PAGE", ranks: [1, 0] as const },
    { key: "PERSON", ranks: [2] as const },
  ].map((group) => ({ ...group, ranks: [...group.ranks] }))

  assert.deepEqual(
    rankGroups(groups).map((group) => group.key),
    ["PAGE", "COMPETITION", "TEAM", "PERSON"],
  )
})
