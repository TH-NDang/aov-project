import assert from "node:assert/strict"
import { test } from "node:test"
import type { ResolvedMatch, RosterMembershipContent } from "@aov/community-contracts"
import {
  backFromState,
  backState,
  birthYear,
  followTrail,
  lastRank,
  linesOfPlayer,
  teamRecord,
  type PeekTarget,
} from "../src/features/competition/peek/peek-model"

const match = (key: string, a: string, b: string, scoreA?: number, scoreB?: number): ResolvedMatch => ({
  key,
  teamAId: a,
  teamBId: b,
  scoreA,
  scoreB,
  consistent: true,
})

test("a team's record counts only its scored matches, from either side", () => {
  const record = teamRecord(
    [
      match("m1", "fl", "sgp", 2, 1),
      match("m2", "bme", "fl", 2, 0),
      match("m3", "fl", "box"),
      match("m4", "a", "b", 2, 0),
    ],
    "fl",
  )
  assert.deepEqual(record, { played: 2, won: 1, lost: 1, gameWins: 2, gameLosses: 3 })
})

test("the rank shown is the one of the last stage that lists the team", () => {
  const standings = [
    { stageCode: "GROUPS", rows: [{ teamId: "fl", rank: 4 }] },
    { stageCode: "PLAYOFFS", rows: [{ teamId: "sgp", rank: 1 }] },
  ]
  const names: Record<string, string> = { GROUPS: "Vòng bảng", PLAYOFFS: "Playoffs" }
  assert.deepEqual(
    lastRank(standings, (code) => names[code], "fl"),
    { rank: 4, stage: "Vòng bảng" },
  )
  assert.deepEqual(
    lastRank(standings, (code) => names[code], "sgp"),
    { rank: 1, stage: "Playoffs" },
  )
  assert.equal(
    lastRank(standings, (code) => names[code], "box"),
    null,
  )
})

test("a player's lines put the one that plays first", () => {
  const line = (teamId: string, status: RosterMembershipContent["status"]): RosterMembershipContent => ({
    tournamentId: "t",
    teamId,
    playerId: "p",
    status,
  })
  const lines = linesOfPlayer([line("old", "INACTIVE"), line("bench", "SUBSTITUTE"), line("main", "ACTIVE")], "p")
  assert.deepEqual(
    lines.map((row) => row.teamId),
    ["main", "bench", "old"],
  )
  assert.deepEqual(linesOfPlayer([line("main", "ACTIVE")], "someone else"), [])
})

test("opening a card already on the trail goes back to it", () => {
  const team: PeekTarget = { kind: "team", id: "fl" }
  const player: PeekTarget = { kind: "player", id: "julius" }
  const other: PeekTarget = { kind: "team", id: "sgp" }
  assert.deepEqual(followTrail([team], player), [team, player])
  assert.deepEqual(followTrail([team, player, other], team), [team])
  assert.deepEqual(followTrail([team, player], { kind: "player", id: "fl" }), [
    team,
    player,
    { kind: "player", id: "fl" },
  ])
})

test("the year of birth reads full and partial dates", () => {
  assert.equal(birthYear("2004-05-17"), 2004)
  assert.equal(birthYear("2004"), 2004)
  assert.equal(birthYear(""), null)
  assert.equal(birthYear(null), null)
})

test("a back link survives the router state only when it stays on this site", () => {
  const back = { label: "Đấu Trường Danh Vọng Mùa Đông 2026", to: "/tournaments/t1?step=teams" }
  assert.deepEqual(backFromState(backState(back)), back)
  assert.equal(backFromState(null), null)
  assert.equal(backFromState({ back: { label: "x", to: "https://example.com" } }), null)
  assert.equal(backFromState({ back: { label: "x", to: "//example.com/path" } }), null)
  assert.equal(backFromState({ back: { to: "/tournaments" } }), null)
})
