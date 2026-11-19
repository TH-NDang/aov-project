import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView, RosterMembershipContent } from "@aov/community-contracts"
import {
  awardGroups,
  mainStages,
  requestedTab,
  standingsAndBrackets,
  tabSearch,
  teamRoster,
} from "../src/features/tournaments/competition-page-model.ts"
import { announcedCompetition, finishedCompetition } from "./fixtures/competition-data.ts"

/** The finished competition with a second table and an unplayed upper bracket placed before the group stage. */
function withMoreStages(): CompetitionView {
  const view = finishedCompetition()
  const { plan } = view.content
  return {
    ...view,
    content: {
      ...view.content,
      plan: {
        ...plan,
        stages: [
          { ...plan.stages[0]!, code: "BRACKET", name: "Upper bracket", format: "DOUBLE_ELIMINATION" },
          { ...plan.stages[0]!, code: "WILDCARD", name: "Wildcard" },
          ...plan.stages,
        ],
        matches: [
          { ...plan.matches[0]!, key: "W1", stageCode: "WILDCARD", scheduledAt: "2026-09-20T11:00:00Z" },
          ...plan.matches,
        ],
      },
      standings: [...view.content.standings, { stageCode: "WILDCARD", complete: true, rows: [] }],
    },
  }
}

const row = (playerId: string, lane: RosterMembershipContent["lane"], status?: RosterMembershipContent["status"]) =>
  ({ tournamentId: "aog", teamId: "team-sgp", playerId, lane, status }) as RosterMembershipContent

test("an address without a tab opens the overview", () => {
  assert.equal(requestedTab(null), "overview")
})

test("an address naming a tab opens it", () => {
  assert.equal(requestedTab("teams"), "teams")
})

test("the bracket address opens the standings tab", () => {
  assert.equal(requestedTab("bracket"), "standings")
})

test("an address naming an unknown tab opens the overview", () => {
  assert.equal(requestedTab("players"), "overview")
})

test("opening a tab writes it into the address and keeps other parameters", () => {
  assert.equal(tabSearch(new URLSearchParams("ref=home"), "teams").toString(), "ref=home&tab=teams")
})

test("opening the overview removes the tab from the address", () => {
  assert.equal(tabSearch(new URLSearchParams("tab=teams"), "overview").toString(), "")
})

test("leaving the schedule removes its filters from the address", () => {
  const search = new URLSearchParams("tab=matches&scope=all&stage=GROUP&team=team-sgp&date=2026-10-02")

  assert.equal(tabSearch(search, "standings").toString(), "tab=standings")
})

test("opening the schedule keeps its filters", () => {
  const search = new URLSearchParams("tab=overview&team=team-sgp")

  assert.equal(tabSearch(search, "matches").toString(), "tab=matches&team=team-sgp")
})

test("the main table is the one with the most matches", () => {
  assert.equal(mainStages(withMoreStages()).table?.stageCode, "GROUP")
})

test("the main knockout is the last elimination stage played that has matches", () => {
  assert.equal(mainStages(withMoreStages()).knockout?.code, "FINAL")
})

test("a competition without matches or tables has no main stage", () => {
  assert.deepEqual(mainStages(announcedCompetition()), { table: undefined, knockout: undefined })
})

test("the tables follow the order their stages are played", () => {
  const { standings } = standingsAndBrackets(withMoreStages())

  assert.deepEqual(
    standings.map((table) => table.stageCode),
    ["WILDCARD", "GROUP"],
  )
})

test("only elimination stages that have matches get a bracket", () => {
  const { knockouts } = standingsAndBrackets(withMoreStages())

  assert.deepEqual(
    knockouts.map((stage) => stage.code),
    ["FINAL"],
  )
})

test("a roster lists starters, then substitutes, then unconfirmed and inactive players", () => {
  const rosters = [
    row("out", "TOP", "INACTIVE"),
    row("sub", "TOP", "SUBSTITUTE"),
    row("new", "TOP"),
    row("top", "TOP", "ACTIVE"),
  ]

  assert.deepEqual(
    teamRoster(rosters, "team-sgp").map((player) => player.playerId),
    ["top", "sub", "new", "out"],
  )
})

test("players of one status follow the lanes from the top lane to support, those without a lane last", () => {
  const rosters = [row("none", null, "ACTIVE"), row("support", "SUPPORT", "ACTIVE"), row("jungle", "JUNGLE", "ACTIVE")]

  assert.deepEqual(
    teamRoster(rosters, "team-sgp").map((player) => player.playerId),
    ["jungle", "support", "none"],
  )
})

test("a roster holds only the players of that team", () => {
  const rosters = finishedCompetition().content.rosters

  assert.deepEqual(
    teamRoster(rosters, "team-hnk").map((player) => player.playerId),
    ["p-hnk"],
  )
})

test("awards with the same title share one group, in the order the titles first appear", () => {
  const groups = awardGroups([
    { title: "Week 1 MVP", recipientName: "Ba" },
    { title: "Final MVP", recipientName: "Lai" },
    { title: "Week 1 MVP", recipientName: "Bon" },
  ])

  assert.deepEqual(
    groups.map(([title, awards]) => [title, awards.map((award) => award.recipientName)]),
    [
      ["Week 1 MVP", ["Ba", "Bon"]],
      ["Final MVP", ["Lai"]],
    ],
  )
})

test("no awards give no groups", () => {
  assert.deepEqual(awardGroups([]), [])
})
