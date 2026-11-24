import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView } from "@aov/community-contracts"
import { personProfile, playerProfile, playerStints, teamPlace, teamProfile } from "../src/lib/participant-model.ts"
import { competition, on } from "./fixtures/competition.ts"

const season = (id: string, year: number, tournament: object = {}) =>
  competition(
    [
      { key: "final", a: "a", b: "b", score: [4, 2], scheduledAt: on(1) },
      { key: "other", a: "c", b: "d", score: [3, 0], scheduledAt: on(1) },
    ],
    { id, tournament: { startsOn: `${year}-03-01`, year, status: "FINISHED", ...tournament } },
  )

/** The same season with one player on a team's roster. */
const registered = (view: CompetitionView, teamId: string, playerId = "p"): CompetitionView => ({
  ...view,
  content: {
    ...view.content,
    players: { [playerId]: { code: playerId, nickname: "Tester" } },
    rosters: [{ tournamentId: view.id, teamId, playerId, lane: "MID" }],
  },
})

test("a team's place is its line of the final table", () => {
  const view = season("s", 2026, { placements: [{ place: "3-4", teamId: "a", teamName: "Đội A" }] })

  assert.equal(teamPlace(view, "a"), "3-4")
})

test("a team's seasons come newest first with its matches and record", () => {
  const profile = teamProfile([season("old", 2024), season("new", 2026)], "a")!

  assert.deepEqual(
    profile.seasons.map(({ view, entries }) => [view.id, entries.length]),
    [
      ["new", 1],
      ["old", 1],
    ],
  )
  assert.deepEqual([profile.won, profile.lost], [2, 0])
})

test("a team no competition names has no profile", () => {
  assert.equal(teamProfile([season("s", 2026)], "nobody"), null)
})

test("a player's awards and place come from the team that registered them", () => {
  const view = registered(
    season("s", 2026, {
      placements: [{ place: "1", teamId: "a", teamName: "Đội A" }],
      awards: [{ title: "MVP", playerId: "p", recipientName: "Tester" }],
    }),
    "a",
  )
  const profile = playerProfile([view], "p")!

  assert.equal(profile.titles, 1)
  assert.deepEqual(profile.seasons[0]!.awards, ["MVP"])
  assert.equal(profile.lane, "MID")
})

test("seasons in a row with one team are one stint", () => {
  const views = [
    registered(season("s1", 2023), "b"),
    registered(season("s2", 2024), "a"),
    registered(season("s3", 2026), "a"),
  ]
  const stints = playerStints(playerProfile(views, "p")!.seasons)

  assert.deepEqual(
    stints.map(({ teamId, from, to, seasons }) => [teamId, from, to, seasons]),
    [
      ["a", 2024, 2026, 2],
      ["b", 2023, 2023, 1],
    ],
  )
})

test("a person's roles come from the staff of a team and from the broadcast", () => {
  const view = season("s", 2026, {
    staff: [{ teamId: "a", pageId: "coach", role: "COACH", title: "Assistant coach" }],
    broadcast: [{ pageId: "coach", role: "GUEST_ANALYST" }],
  })
  view.content.people = { coach: { id: "coach", name: "Lam", published: false } }
  const profile = personProfile([view], "coach")!

  assert.deepEqual(profile.roles, ["COACH", "GUEST_ANALYST"])
  assert.deepEqual(profile.seasons[0]!.roles[0], { role: "COACH", title: "Assistant coach" })
  assert.equal(profile.seasons[0]!.team?.shortName, "A")
})
