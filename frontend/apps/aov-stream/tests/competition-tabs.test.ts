import assert from "node:assert/strict"
import { test } from "node:test"
import { freshTab, type CompetitionTab } from "../src/lib/competition-tabs.ts"
import { statsHref } from "../src/lib/statistics-routes.ts"

const opened = (search: string, tab: CompetitionTab) => String(freshTab(new URLSearchParams(search), tab))

test("another tab opens without what the one before it had written into the address", () => {
  assert.equal(opened("tab=matches&stage=GROUP&team=t&date=2026-11-01", "standings"), "tab=standings")
  assert.equal(opened("tab=standings&team=t&at=12", "matches"), "tab=matches")
  assert.equal(opened("tab=standings&team=t&at=12", "overview"), "")
})

test("the tab that is open opens fresh when it is pressed again", () => {
  assert.equal(opened("tab=standings&team=t&at=12", "standings"), "tab=standings")
  assert.equal(opened("tab=matches&scope=results&team=t", "matches"), "tab=matches")
  assert.equal(opened("tab=stats&view=games&pick=star&sort=short", "stats"), "tab=stats")
})

test("the game chosen in the season of a team stays with the team", () => {
  const { searchParams } = new URL(statsHref("c", { part: "teams", team: "t", game: "g" }), "http://x")
  assert.equal(String(freshTab(searchParams, "stats")), "tab=stats")
  assert.equal(String(freshTab(searchParams, "teams")), "tab=teams")
})

test("what no tab has written stays in the address", () => {
  assert.equal(opened("ref=post&tab=standings&at=3", "teams"), "ref=post&tab=teams")
})
