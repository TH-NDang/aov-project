import assert from "node:assert/strict"
import { test } from "node:test"
import {
  achievementGroups,
  competitionLinks,
  isTitle,
  withPublishedPlaces,
} from "../src/features/community/model/profile-records-model.ts"
import { competition } from "./fixtures/competition.ts"

const season = (id: string, name: string, endsOn: string, extra: object = {}) =>
  competition([{ key: "f", a: "a", b: "b" }], { id, tournament: { name, endsOn, status: "FINISHED", ...extra } })
const record = (title: string, placement: string, date: string) => ({ title, placement, date })
const groups = (...items: ReturnType<typeof record>[]) => achievementGroups(items, competitionLinks([]))
const word = (place: string) => `place ${place}`

test("a published result the record does not hold becomes an entry that opens its competition", () => {
  const [first] = withPublishedPlaces([], [{ view: season("s", "Spring 2026", "2026-05-10"), place: "2" }], word)

  assert.deepEqual(
    [first!.title, first!.competitionId, first!.date, first!.placements],
    ["Spring 2026", "s", "2026-05-10", ["place 2"]],
  )
})

test("the same words in another order are the same competition, which gives the entry its name and page", () => {
  const merged = withPublishedPlaces(
    groups(record("Garena Challenger Series Spring 2026", "Champion", "2026-05-09")),
    [{ view: season("s", "Garena Challenger Series 2026 Spring", "2026-05-10"), place: "1" }],
    word,
  )

  assert.deepEqual(
    merged.map(({ title, competitionId, placements }) => [title, competitionId, placements]),
    [["Garena Challenger Series 2026 Spring", "s", ["Champion"]]],
  )
})

test("the same place on the same day is the same result under another name", () => {
  const merged = withPublishedPlaces(
    groups(record("Arena of Glory Winter 2025", "Runner-up", "2025-11-02")),
    [{ view: season("s", "Đấu Trường Danh Vọng Mùa Đông 2025", "2025-11-02"), place: "2" }],
    word,
  )

  assert.equal(merged.length, 1)
  assert.equal(merged[0]!.competitionId, "s")
})

test("a result the record lists twice is one, kept in the form that names its competition", () => {
  const [only, ...rest] = achievementGroups(
    [
      record("Arena of Glory Spring 2021", "Champion", "2021-05-09"),
      { ...record("Đấu Trường Danh Vọng Mùa Xuân 2021", "Champion", "2021-05-09"), tournamentId: "s" },
    ],
    competitionLinks([]),
  )

  assert.deepEqual([only!.title, rest.length], ["Đấu Trường Danh Vọng Mùa Xuân 2021", 0])
})

test("an award of the same day is kept beside the result", () => {
  const kept = achievementGroups(
    [
      record("Arena of Glory Spring 2021", "MVP", "2021-05-09"),
      { ...record("Đấu Trường Danh Vọng Mùa Xuân 2021", "Champion", "2021-05-09"), tournamentId: "s" },
    ],
    competitionLinks([]),
  )

  assert.equal(kept.length, 2)
})

test("a result on the same day with another place stays apart", () => {
  const merged = withPublishedPlaces(
    groups(record("Arena of Glory Winter 2025", "MVP", "2025-11-02")),
    [{ view: season("s", "Đấu Trường Danh Vọng Mùa Đông 2025", "2025-11-02"), place: "1" }],
    word,
  )

  assert.equal(merged.length, 2)
})

test("qualifiers, parts of a competition and places below the fourth add nothing", () => {
  const places = [
    { view: season("q", "Qualifier", "2026-01-01", { competitionType: "QUALIFIER" }), place: "1" },
    { view: season("p", "Wildcard", "2026-01-01", { parentTournamentId: "main" }), place: "1" },
    { view: season("l", "League", "2026-01-01"), place: "5-8" },
    { view: season("u", "Unknown", "2026-01-01"), place: null },
  ]

  assert.deepEqual(withPublishedPlaces([], places, word), [])
})

test("merged results stand newest first", () => {
  const merged = withPublishedPlaces(
    groups(record("Old", "Champion", "2022-01-01")),
    [{ view: season("s", "New", "2026-01-01"), place: "1" }],
    word,
  )

  assert.deepEqual(
    merged.map((group) => group.title),
    ["New", "Old"],
  )
})

test("winning a qualifier is an achievement but no title", () => {
  const titles = ["Arena of Valor World Cup - Taiwan Qualifier", "Vòng loại ĐTDV 2026"].map((title) =>
    isTitle(groups(record(title, "Champion", "2026-01-01"))[0]!),
  )

  assert.deepEqual(titles, [false, false])
})

test("only a first place nobody shares is a title", () => {
  const [champion, shared, award] = [
    groups(record("A", "Champion", "2026-01-01"))[0]!,
    groups(record("B", "1-2", "2026-01-01"))[0]!,
    groups(record("C", "MVP", "2026-01-01"))[0]!,
  ]

  assert.deepEqual([isTitle(champion), isTitle(shared), isTitle(award)], [true, false, false])
})
