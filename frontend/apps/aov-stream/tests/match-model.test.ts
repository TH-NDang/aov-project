import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView, PlannedMatch, PublishedGame } from "@aov/community-contracts"
import {
  competitionMatches,
  competitionMatchHref,
  findSeriesMatch,
  matchSeriesId,
  matchState,
  orderedMatchGames,
} from "../src/features/tournaments/match-model.ts"

const planned = (key: string, extra: Partial<PlannedMatch> = {}): PlannedMatch => ({
  key,
  stageCode: "GROUP",
  round: 1,
  label: "Same label",
  bestOf: 5,
  a: { type: "TBD" },
  b: { type: "TBD" },
  ...extra,
})
const view = (matches: PlannedMatch[], resolved: CompetitionView["content"]["resolved"] = []): CompetitionView =>
  ({ id: "competition", content: { plan: { matches }, resolved } }) as CompetitionView

test("match lookup uses published series ids even when labels repeat or resolved slots have no plan id", () => {
  const competition = view(
    [planned("first", { seriesId: "series-1" }), planned("second")],
    [{ key: "second", seriesId: "series-2", consistent: true }],
  )
  assert.equal(findSeriesMatch(competition, "series-2")?.match.key, "second")
  assert.equal(matchSeriesId(competitionMatches([competition])[0]!), "series-1")
  assert.equal(findSeriesMatch(competition, "Same label"), undefined)
  assert.equal(
    competitionMatchHref("competition", "GROUP/Round 1"),
    "/competitions/competition/matches/GROUP%2FRound%201",
  )
})

test("incomplete scores and past scheduled times do not claim a live or finished match", () => {
  const entry = competitionMatches([view([planned("first", { scheduledAt: "2026-01-01T00:00:00Z" })])])[0]!
  assert.equal(matchState(entry, Date.parse("2026-01-02")), "PENDING")
  assert.equal(matchState(entry, Date.parse("2025-12-31")), "UPCOMING")
  entry.result = { key: "first", scoreA: 2, scoreB: 1, consistent: true }
  assert.equal(matchState(entry), "SCORED")
  entry.result.scoreA = 3
  assert.equal(matchState(entry), "FINISHED")
  entry.result.scoreB = 3
  assert.equal(matchState(entry), "SCORED")
})

test("game navigation keeps only the exact series and sorts by game number rather than publication order", () => {
  const games = [
    { id: "last", content: { seriesId: "series-1", number: 5 } },
    { id: "other", content: { seriesId: "series-2", number: 1 } },
    { id: "first", content: { seriesId: "series-1", number: 1 } },
  ] as PublishedGame[]
  assert.deepEqual(
    orderedMatchGames(games, "series-1").map((game) => game.id),
    ["first", "last"],
  )
  assert.equal(games[0]?.id, "last")
})
