import assert from "node:assert/strict"
import { test } from "node:test"
import type { LinkMention, SeriesContent, StaffMember, TournamentAward } from "@aov/community-contracts"
import {
  awardRecipient,
  awardTeam,
  finalTableToSave,
  pickedName,
  placementTeam,
  typedName,
  unlinkedName,
  withAwardRecipient,
  withAwardTeam,
  withPlacementTeam,
} from "../src/features/tournaments/model/final-table-model"
import {
  crewByRole,
  staffOfTeam,
  withCrewMember,
  withTeamStaff,
  withoutCrewMember,
} from "../src/features/tournaments/model/crew-model"
import { candidateName, mvpGroups } from "../src/features/tournaments/model/mvp-model"
import { mentionPlace, mentionTarget, mentionsByTournament } from "../src/features/tournaments/model/link-review-model"
import { lifecycleUsages } from "../src/features/tournaments/model/record-lifecycle-model"
import { keptSeriesFields, keptTournamentFields } from "../src/features/tournaments/model/registry-form-model"

const award: TournamentAward = {
  title: "MVP",
  recipientName: "Lai Bâng",
  playerId: "lai-bang",
  teamName: "Saigon Phantom",
  teamId: "sgp",
}

test("picking a team for a placement links the record and writes the record's name", () => {
  const line = withPlacementTeam({ place: "1", teamName: "SGP" }, pickedName("sgp", "Saigon Phantom"))
  assert.deepEqual(line, { place: "1", teamName: "Saigon Phantom", teamId: "sgp" })
})

test("typing another recipient name takes the old player link off", () => {
  const edited = withAwardRecipient(award, typedName(awardRecipient(award), "Lai Bang"))
  assert.equal(edited.recipientName, "Lai Bang")
  assert.equal(edited.playerId, null)
})

test("typing the linked name again keeps the link", () => {
  assert.equal(typedName(awardRecipient(award), "Lai Bâng ").id, "lai-bang")
})

test("clearing a picked team keeps its name as text", () => {
  assert.deepEqual(withAwardTeam(award, unlinkedName(awardTeam(award))), { ...award, teamId: null })
})

test("a placement whose team was never picked is not linked by the name typed", () => {
  const line = withPlacementTeam(
    { place: "2", teamName: "" },
    typedName(placementTeam({ place: "2", teamName: "" }), "Saigon Phantom"),
  )
  assert.equal(finalTableToSave([line], [], []).placements[0].teamId, null)
})

test("an award whose team name was cleared loses its team link when saved", () => {
  const saved = finalTableToSave([], [{ ...award, teamName: "  " }], [])
  assert.equal(saved.awards[0].teamName, null)
  assert.equal(saved.awards[0].teamId, null)
  assert.equal(saved.awards[0].playerId, "lai-bang")
})

test("final table lines without their required text are left out when saved", () => {
  const saved = finalTableToSave(
    [
      { place: "1", teamName: "" },
      { place: " 2 ", teamName: " Team Flash " },
    ],
    [{ title: "MVP", recipientName: "" }],
    [{ label: "Liquipedia", url: "" }],
  )
  assert.deepEqual(saved, { placements: [{ place: "2", teamName: "Team Flash", teamId: null }], awards: [], links: [] })
})

test("the broadcast crew reads by role in the order of the roles", () => {
  const crew = [
    { pageId: "a", role: "CASTER" as const },
    { pageId: "b", role: "HOST" as const },
    { pageId: "c", role: "CASTER" as const },
  ]
  assert.deepEqual(
    crewByRole(crew).map((group) => [group.role, group.members.map((member) => member.pageId)]),
    [
      ["HOST", ["b"]],
      ["CASTER", ["a", "c"]],
    ],
  )
})

test("a person is listed once per role but may hold two roles", () => {
  const crew = withCrewMember(withCrewMember([], { pageId: "a", role: "HOST" }), { pageId: "a", role: "HOST" })
  const both = withCrewMember(crew, { pageId: "a", role: "CASTER" })
  assert.equal(crew.length, 1)
  assert.equal(both.length, 2)
  assert.deepEqual(withoutCrewMember(both, { pageId: "a", role: "HOST" }), [{ pageId: "a", role: "CASTER" }])
})

test("a team's staff lists its coaches before its analysts", () => {
  const staff: StaffMember[] = [
    { teamId: "t", pageId: "analyst", role: "TEAM_ANALYST" },
    { teamId: "u", pageId: "other", role: "COACH" },
    { teamId: "t", pageId: "coach", role: "COACH" },
  ]
  assert.deepEqual(
    staffOfTeam(staff, "t").map((line) => line.pageId),
    ["coach", "analyst"],
  )
})

test("saving one team's staff keeps every other team's lines and trims the titles", () => {
  const staff: StaffMember[] = [
    { teamId: "t", pageId: "old", role: "COACH" },
    { teamId: "u", pageId: "other", role: "COACH", title: "Huấn luyện viên trưởng" },
  ]
  const next = withTeamStaff(staff, "t", [
    { teamId: "t", pageId: "new", role: "COACH", title: " Trợ lý huấn luyện viên " },
  ])
  assert.deepEqual(next, [
    { teamId: "u", pageId: "other", role: "COACH", title: "Huấn luyện viên trưởng" },
    { teamId: "t", pageId: "new", role: "COACH", title: "Trợ lý huấn luyện viên" },
  ])
})

test("the MVP list puts the players of the game first and names each player once", () => {
  const groups = mvpGroups([
    { key: "seated", title: "Ra sân ván này", players: [{ id: "p1", name: "One" }] },
    {
      key: "blue",
      title: "Blue",
      players: [
        { id: "p1", name: "One" },
        { id: "p2", name: "Two" },
      ],
    },
    { key: "red", title: "Red", players: [{ id: "p2", name: "Two" }] },
  ])
  assert.deepEqual(
    groups.map((group) => [group.key, group.players.map((player) => player.id)]),
    [
      ["seated", ["p1"]],
      ["blue", ["p2"]],
    ],
  )
  assert.equal(candidateName(groups, "p2"), "Two")
})

const mention = (kind: LinkMention["kind"], extra: Partial<LinkMention> = {}): LinkMention => ({
  kind,
  recordId: "record",
  tournamentId: "event",
  tournamentName: "AOG",
  text: "Lai Bâng",
  ...extra,
})

test("a game MVP opens its game with the info panel on the match screen", () => {
  assert.deepEqual(mentionTarget(mention("GAME_MVP", { seriesId: "final", gameNumber: 3 })), {
    screen: "match",
    tournamentId: "event",
    seriesId: "final",
    search: "edit=1&game=record&view=data",
  })
})

test("a match MVP or caster opens that match in the schedule step", () => {
  for (const kind of ["SERIES_MVP", "SERIES_BROADCAST"] as const)
    assert.deepEqual(mentionTarget(mention(kind)), {
      screen: "workspace",
      tournamentId: "event",
      search: "step=schedule&match=record",
    })
})

test("an award recipient or team opens the final step of the tournament", () => {
  for (const kind of ["AWARD_PLAYER", "AWARD_TEAM"] as const)
    assert.deepEqual(mentionTarget(mention(kind)), { screen: "workspace", tournamentId: "event", search: "step=final" })
})

test("a game MVP row names the match and the game number", () => {
  assert.equal(mentionPlace(mention("GAME_MVP", { label: "SGP vs FL", gameNumber: 2 })), "SGP vs FL · Ván 2")
  assert.equal(mentionPlace(mention("AWARD_PLAYER", { label: null })), "Giải thưởng")
})

test("rows group under their tournament in the order the server sends them", () => {
  const groups = mentionsByTournament([
    mention("AWARD_PLAYER", { tournamentId: "a", tournamentName: "A" }),
    mention("AWARD_PLAYER", { tournamentId: "a", tournamentName: "A", recordId: "two" }),
    mention("AWARD_PLAYER", { tournamentId: "b", tournamentName: "B" }),
  ])
  assert.deepEqual(
    groups.map((group) => [group.tournamentName, group.mentions.length]),
    [
      ["A", 2],
      ["B", 1],
    ],
  )
})

test("saving a tournament from its editor keeps its broadcast crew and team staff", () => {
  const stored = {
    code: "aog",
    name: "AOG",
    region: "VN",
    broadcast: [{ pageId: "host", role: "HOST" as const }],
    staff: [{ teamId: "t", pageId: "coach", role: "COACH" as const }],
  }
  const kept = keptTournamentFields({ code: "aog", name: "AOG mùa đông", region: "VN" }, stored)
  assert.deepEqual(kept.broadcast, stored.broadcast)
  assert.deepEqual(kept.staff, stored.staff)
})

test("saving a match from its editor keeps its title, MVP and broadcast", () => {
  const stored: SeriesContent = {
    code: "final",
    tournamentId: "event",
    teamAId: "a",
    teamBId: "b",
    bestOf: 7,
    title: { kind: "GRAND_FINAL" },
    mvpPlayerId: "mvp",
    broadcast: [{ pageId: "caster", role: "CASTER" }],
  }
  const kept = keptSeriesFields({ code: "final", tournamentId: "event", teamAId: "a", teamBId: "b", bestOf: 7 }, stored)
  assert.deepEqual([kept.title, kept.mvpPlayerId, kept.broadcast], [stored.title, stored.mvpPlayerId, stored.broadcast])
})

test("a deletion blocked by a final table or a team staff says where the record is named", () => {
  assert.deepEqual(
    lifecycleUsages([
      { type: "TOURNAMENT_RESULT", count: 1 },
      { type: "TOURNAMENT_STAFF", count: 2 },
    ]).map((usage) => usage.label),
    ["Thứ hạng hoặc giải thưởng của giải", "Ban huấn luyện của giải"],
  )
})
