import assert from "node:assert/strict"
import { test } from "node:test"
import type { ProfileMember, RosterMembershipContent } from "@aov/community-contracts"
import { competitionLineup, rosterLineup } from "../src/lib/lineup-model.ts"
import { competition } from "./fixtures/competition.ts"

const member = (name: string, lane: ProfileMember["lane"], extra: Partial<ProfileMember> = {}): ProfileMember => ({
  name,
  role: "",
  lane,
  standing: "ACTIVE",
  ...extra,
})

test("the starters of a roster stand lane by lane, with the captain marked and their pages linked", () => {
  const seats = rosterLineup([
    member("Support", "SUPPORT"),
    member("Mid", "MID", { captain: true, pageId: "page-mid" }),
    member("Top", "TOP"),
    member("Bench", "TOP", { standing: "SUBSTITUTE" }),
  ])!

  assert.deepEqual(
    seats.map(({ name, captain, to }) => [name, captain, to]),
    [
      ["Top", false, null],
      ["Mid", true, "/pages/page-mid"],
      ["Support", false, null],
    ],
  )
})

test("a roster with too few starters on a lane draws no lineup", () => {
  assert.equal(rosterLineup([member("Top", "TOP"), member("Mid", "MID"), member("Coach", null)]), null)
})

const registered = (id: string, lanes: RosterMembershipContent["lane"][], status = "ACTIVE") => {
  const view = competition([{ key: "m", a: "team", b: "other" }], { id })
  view.content.rosters = lanes.map((lane, at) => ({
    teamId: "team",
    playerId: `${id}-${at}`,
    lane,
    status,
  })) as RosterMembershipContent[]
  view.content.players = Object.fromEntries(
    lanes.map((_, at) => [`${id}-${at}`, { nickname: `Player ${at}` }]),
  ) as typeof view.content.players
  return view
}

test("a team's lineup comes from the newest competition that lists its starters", () => {
  const lineup = competitionLineup(
    [registered("empty", []), registered("new", ["DRAGON", "TOP", "MID"]), registered("old", ["TOP", "MID", "JUNGLE"])],
    "team",
  )!

  assert.equal(lineup.view.id, "new")
  assert.deepEqual(
    lineup.seats.map(({ lane, to }) => [lane, to]),
    [
      ["TOP", "/players/new-1"],
      ["MID", "/players/new-2"],
      ["DRAGON", "/players/new-0"],
    ],
  )
})

test("substitutes alone make no lineup", () => {
  assert.equal(competitionLineup([registered("new", ["TOP", "MID", "DRAGON"], "SUBSTITUTE")], "team"), null)
})
