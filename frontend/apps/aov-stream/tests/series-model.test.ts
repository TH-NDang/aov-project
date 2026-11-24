import assert from "node:assert/strict"
import { test } from "node:test"
import type { PublishedGame } from "@aov/community-contracts"
import { draftPhases, draftRows, gamesBySeries, laneDuels, timelineRows } from "../src/lib/series-model.ts"

const seat = (lane: string, playerId: string | null, hero: string) => ({
  lane,
  playerId,
  hero: { id: hero, name: hero },
})
const game = (number: number, winner: "BLUE" | "RED", blue: object[], extra: object = {}, seriesId = "series") =>
  ({
    id: `${seriesId}-${number}`,
    content: {
      seriesId,
      number,
      winner,
      sides: [
        { side: "BLUE", teamId: "a", participants: blue },
        { side: "RED", teamId: "b", participants: [] },
      ],
      ...extra,
    },
  }) as unknown as PublishedGame

test("heroes are listed by player in lane order, a cell for each game", () => {
  const rows = draftRows(
    [
      game(1, "BLUE", [seat("MID", "p2", "Liliana"), seat("TOP", "p1", "Qi")], { mvpPlayerId: "p2" }),
      game(2, "RED", [seat("TOP", "p1", "Yena"), seat("MID", "p9", "Lorion")]),
    ],
    "a",
  )

  assert.deepEqual(
    rows.map((item) => [item.playerId, item.cells.map((cell) => cell && [cell.hero.name, cell.won, cell.mvp])]),
    [
      [
        "p1",
        [
          ["Qi", true, false],
          ["Yena", false, false],
        ],
      ],
      ["p2", [["Liliana", true, true], null]],
      ["p9", [null, ["Lorion", false, false]]],
    ],
  )
})

test("games are gathered by match in the order the matches first appear", () => {
  const groups = gamesBySeries([
    game(2, "RED", [], {}, "new"),
    game(1, "RED", [], {}, "old"),
    game(1, "RED", [], {}, "new"),
  ])

  assert.deepEqual(
    groups.map((group) => group.map((item) => item.id)),
    [["new-1", "new-2"], ["old-1"]],
  )
})

test("lanes nobody is recorded in are left out of the duels", () => {
  const [blue, red] = game(1, "BLUE", [seat("SUPPORT", "p5", "Rouie"), seat("TOP", "p1", "Qi")]).content.sides

  assert.deepEqual(
    laneDuels([blue!, red!]).map((duel) => [duel.lane, duel.a?.playerId, duel.b?.playerId]),
    [
      ["TOP", "p1", undefined],
      ["SUPPORT", "p5", undefined],
    ],
  )
})

test("a draft gathers neighbouring bans and picks in the order they were taken", () => {
  const turn = (order: number, kind: string) => ({ order, kind, side: "BLUE" })
  const phases = draftPhases(
    game(1, "BLUE", [], { draft: { turns: [turn(3, "PICK"), turn(1, "BAN"), turn(2, "BAN"), turn(4, "BAN")] } }),
  )

  assert.deepEqual(
    phases.map((phase) => [phase.kind, phase.turns.map((item) => item.order)]),
    [
      ["BAN", [1, 2]],
      ["PICK", [3]],
      ["BAN", [4]],
    ],
  )
})

test("moments come in time order with the kills up to each", () => {
  const kill = (atSeconds: number, side: string) => ({
    id: `k${atSeconds}`,
    atSeconds,
    kind: "KILL",
    killer: { side, lane: "MID" },
  })
  const rows = timelineRows(
    game(1, "BLUE", [], {
      timeline: {
        pauses: [],
        events: [kill(200, "RED"), kill(90, "BLUE"), { id: "o", atSeconds: 150, kind: "OBJECTIVE", side: "RED" }],
      },
    }),
  )

  assert.deepEqual(
    rows.map(({ event: moment, side, kills }) => [moment.id, side, kills.BLUE, kills.RED]),
    [
      ["k90", "BLUE", 1, 0],
      ["o", "RED", 1, 0],
      ["k200", "RED", 1, 1],
    ],
  )
})
