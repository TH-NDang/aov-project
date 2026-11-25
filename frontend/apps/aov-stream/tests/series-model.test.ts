import assert from "node:assert/strict"
import { test } from "node:test"
import type { PublishedGame } from "@aov/community-contracts"
import { draftPhases, draftRows, laneDuels, timelineRows, trackLanes } from "../src/lib/series-model.ts"

const seat = (lane: string, playerId: string | null, hero: string) => ({
  lane,
  playerId,
  hero: { id: hero, name: hero },
})
const game = (number: number, winner: "BLUE" | "RED", blue: object[], extra: object = {}) =>
  ({
    id: `series-${number}`,
    content: {
      seriesId: "series",
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

test("marks of a side that would meet step away from the line, and those apart stay on it", () => {
  const event = (id: string, atSeconds: number, side: string) => ({ id, atSeconds, side, kind: "OBJECTIVE" })
  const events = [event("a", 60, "BLUE"), event("b", 70, "BLUE"), event("c", 70, "RED"), event("d", 500, "BLUE")]
  const lanes = trackLanes(timelineRows(game(1, "BLUE", [], { timeline: { events } })), 1000)

  assert.deepEqual(
    lanes.BLUE.marks.map((mark) => [mark.event.id, mark.share, mark.level]),
    [
      ["a", 0.06, 0],
      ["b", 0.07, 1],
      ["d", 0.5, 0],
    ],
  )
  assert.deepEqual([lanes.BLUE.levels, lanes.RED.levels], [2, 1])
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
