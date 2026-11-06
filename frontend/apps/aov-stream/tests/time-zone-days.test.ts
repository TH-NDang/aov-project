import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView } from "@aov/community-contracts"
import { matchesToShow, scheduledMatches } from "../src/features/community/schedule-model.ts"
import { groupMatchesByDay, knownMatchDay, type CompetitionMatch } from "../src/features/tournaments/match-model.ts"

const entry = (key: string, scheduledAt: string | null) =>
  ({
    competition: { id: "competition", content: { plan: { timezone: "Asia/Ho_Chi_Minh" }, teams: {}, resolved: [] } },
    match: { key, scheduledAt },
  }) as unknown as CompetitionMatch

const view = (matches: { key: string; scheduledAt: string }[]) =>
  ({
    id: "competition",
    content: {
      tournament: { name: "Giải" },
      teams: {},
      resolved: [],
      plan: {
        timezone: "Asia/Bangkok",
        matches: matches.map((match) => ({ ...match, a: { label: "A" }, b: { label: "B" } })),
      },
    },
  }) as unknown as CompetitionView

test("schedule days follow the reader's zone, not the competition's", () => {
  const entries = [entry("late", "2026-11-06T18:30:00Z"), entry("next", "2026-11-07T02:00:00Z")]

  const vietnam = groupMatchesByDay(entries, "Asia/Ho_Chi_Minh")
  assert.deepEqual(
    vietnam.map((group) => [group.key, group.items.map((item) => item.match.key)]),
    [["2026-11-07", ["late", "next"]]],
    "both start on the 7th in Vietnam",
  )

  const newYork = groupMatchesByDay(entries, "America/New_York")
  assert.deepEqual(
    newYork.map((group) => [group.key, group.items.map((item) => item.match.key)]),
    [["2026-11-06", ["late", "next"]]],
    "both are still the 6th in New York",
  )

  const tokyo = groupMatchesByDay(
    [entry("late", "2026-11-06T14:30:00Z"), entry("next", "2026-11-06T15:30:00Z")],
    "Asia/Tokyo",
  )
  assert.deepEqual(
    tokyo.map((group) => group.key),
    ["2026-11-06", "2026-11-07"],
    "midnight in the zone separates the two days",
  )
})

test("a day filter from another zone or a shared link falls back to every day", () => {
  const days = groupMatchesByDay([entry("late", "2026-11-06T18:30:00Z")], "Asia/Ho_Chi_Minh")
  assert.equal(knownMatchDay(days, "2026-11-07"), "2026-11-07")
  assert.equal(knownMatchDay(days, "2026-11-06"), "", "that day has no matches in this zone")
  assert.equal(knownMatchDay(days, null), "")
})

test("matches without a time stay in their own group in every zone", () => {
  for (const zone of ["Asia/Ho_Chi_Minh", "America/Los_Angeles"]) {
    const groups = groupMatchesByDay([entry("open", null)], zone)
    assert.deepEqual(
      groups.map((group) => [group.key, group.label]),
      [["unscheduled", "Chờ xếp lịch"]],
    )
  }
})

test("today's matches are the reader's today, and each match keeps its competition's zone", () => {
  const matches = scheduledMatches([
    view([
      { key: "evening", scheduledAt: "2026-11-06T12:00:00Z" },
      { key: "midnight", scheduledAt: "2026-11-06T18:00:00Z" },
    ]),
  ])
  assert.deepEqual(
    matches.map((match) => match.timeZone),
    ["Asia/Bangkok", "Asia/Bangkok"],
    "the original time is read in the competition's zone",
  )

  const now = Date.parse("2026-11-06T10:00:00Z")
  const inVietnam = matchesToShow(matches, now, "Asia/Ho_Chi_Minh")
  assert.equal(inVietnam.today, true)
  assert.deepEqual(
    inVietnam.items.map((match) => match.matchKey),
    ["evening"],
    "01:00 on the 7th is tomorrow in Vietnam",
  )

  const inNewYork = matchesToShow(matches, now, "America/New_York")
  assert.deepEqual(
    inNewYork.items.map((match) => match.matchKey),
    ["evening", "midnight"],
    "both are today in New York",
  )
})
