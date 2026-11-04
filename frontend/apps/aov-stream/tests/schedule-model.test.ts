import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView } from "@aov/community-contracts"
import { matchesToShow, scheduledMatches } from "../src/features/community/schedule-model.ts"

const view = (matches: { key: string; at?: string; a?: string; b?: string }[], resolved = [] as unknown[]) =>
  ({
    id: "competition-1",
    version: 1,
    content: {
      tournament: { name: "ĐTDV mùa Đông" },
      teams: { sgp: { code: "sgp", name: "Saigon Phantom", shortName: "SGP" }, fl: { code: "fl", name: "FL" } },
      resolved,
      plan: {
        matches: matches.map((match) => ({
          key: match.key,
          scheduledAt: match.at ?? null,
          a: { type: "TEAM", teamId: match.a ?? null, label: "Đội A" },
          b: { type: "TEAM", teamId: match.b ?? null, label: "Đội B" },
        })),
      },
    },
  }) as unknown as CompetitionView

test("matches are named from their teams and carry entered scores", () => {
  const [match] = scheduledMatches([
    view(
      [{ key: "w1", at: "2026-11-03T12:00:00Z", a: "sgp", b: "fl" }],
      [{ key: "w1", teamAId: "sgp", teamBId: "fl", scoreA: 2, scoreB: 1, consistent: true }],
    ),
  ])
  assert.equal(match.teamA, "SGP")
  assert.equal(match.teamB, "FL")
  assert.equal(match.scoreA, 2)
  assert.equal(match.tournament, "ĐTDV mùa Đông")
})

test("unscheduled matches are left out and unknown teams keep their slot label", () => {
  const matches = scheduledMatches([view([{ key: "tbd" }, { key: "w2", at: "2026-11-04T12:00:00Z" }])])
  assert.deepEqual(
    matches.map((match) => [match.key, match.teamA]),
    [["competition-1:w2", "Đội A"]],
  )
})

test("today's matches come first; otherwise the next upcoming ones", () => {
  const now = new Date(2026, 10, 3, 15, 0).getTime()
  const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).toISOString()
  const today = matchesToShow(
    scheduledMatches([
      view([
        { key: "late", at: at(3, 21) },
        { key: "early", at: at(3, 9) },
        { key: "next", at: at(4, 9) },
      ]),
    ]),
    now,
  )
  assert.equal(today.today, true)
  assert.deepEqual(
    today.items.map((match) => match.key),
    ["competition-1:early", "competition-1:late"],
  )

  const later = matchesToShow(
    scheduledMatches([
      view([
        { key: "past", at: at(1, 9) },
        { key: "next", at: at(5, 9) },
      ]),
    ]),
    now,
  )
  assert.equal(later.today, false)
  assert.deepEqual(
    later.items.map((match) => match.key),
    ["competition-1:next"],
  )
})
