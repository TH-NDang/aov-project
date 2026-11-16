import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionMatch } from "../src/features/tournaments/match-model.ts"
import { knownScheduleDay, scheduleDay, scheduleGroups } from "../src/features/tournaments/match-schedule.ts"

/** Long after every match below, so none of them counts as on now. */
const LATER = Date.parse("2027-01-01T00:00:00Z")

const entry = (key: string, scheduledAt: string | null) =>
  ({
    competition: { id: "competition", content: { plan: { timezone: "Asia/Ho_Chi_Minh" }, teams: {}, resolved: [] } },
    match: { key, scheduledAt },
  }) as unknown as CompetitionMatch

const days = (entries: CompetitionMatch[], zone: string) =>
  scheduleGroups(entries, zone, LATER).map((group) => [group.key, group.items.map((item) => item.match.key)])

test("schedule days follow the reader's zone, not the competition's", () => {
  const entries = [entry("late", "2026-11-06T18:30:00Z"), entry("next", "2026-11-07T02:00:00Z")]

  assert.deepEqual(
    days(entries, "Asia/Ho_Chi_Minh"),
    [["2026-11-07", ["late", "next"]]],
    "both start on the 7th in Vietnam",
  )
  assert.deepEqual(
    days(entries, "America/New_York"),
    [["2026-11-06", ["late", "next"]]],
    "both are still the 6th in New York",
  )
  assert.deepEqual(
    days([entry("late", "2026-11-06T14:30:00Z"), entry("next", "2026-11-06T15:30:00Z")], "Asia/Tokyo").map(
      ([key]) => key,
    ),
    ["2026-11-06", "2026-11-07"],
    "midnight in the zone separates the two days",
  )
})

test("a day filter from another zone or a shared link falls back to every day", () => {
  const entries = [entry("late", "2026-11-06T18:30:00Z")]
  assert.equal(knownScheduleDay(entries, "Asia/Ho_Chi_Minh", "2026-11-07"), "2026-11-07")
  assert.equal(knownScheduleDay(entries, "Asia/Ho_Chi_Minh", "2026-11-06"), "", "that day has no matches in this zone")
  assert.equal(knownScheduleDay(entries, "America/New_York", "2026-11-06"), "2026-11-06")
  assert.equal(knownScheduleDay(entries, "Asia/Ho_Chi_Minh", null), "")
})

test("matches without a time stay in their own group in every zone", () => {
  for (const zone of ["Asia/Ho_Chi_Minh", "America/Los_Angeles"]) {
    const open = entry("open", null)
    assert.deepEqual(days([open], zone), [["open", ["open"]]])
    assert.equal(scheduleDay(open, zone), "unscheduled")
    assert.equal(knownScheduleDay([open], zone, "unscheduled"), "unscheduled")
  }
})
