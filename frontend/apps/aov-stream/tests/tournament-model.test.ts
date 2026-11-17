import assert from "node:assert/strict"
import { test } from "node:test"
import {
  clock,
  hasLoadout,
  nameInitials,
  observationTimes,
  plainNote,
  recordedLoadouts,
  seriesRound,
  seriesSides,
  seriesTeams,
  snapshotAt,
} from "../src/lib/tournament-model.ts"
import type { EquipmentSnapshot, GameSide, Participant, PublishedGame } from "@aov/community-contracts"

const snapshot = (atSeconds: number): EquipmentSnapshot => ({
  atSeconds,
  slots: Array.from({ length: 6 }, (_, index) => ({
    slot: index + 1,
    known: index === 0,
    item: index === 0 ? { name: "Kiếm ngắn" } : null,
  })),
})
test("inventory observation uses the latest known timestamp without borrowing a future snapshot", () => {
  const snapshots = [snapshot(600), snapshot(0), snapshot(120)]
  assert.equal(snapshotAt(snapshots, 119)?.atSeconds, 0)
  assert.equal(snapshotAt(snapshots, 120)?.atSeconds, 120)
  assert.equal(snapshotAt(snapshots, 500)?.atSeconds, 120)
  assert.equal(snapshotAt([snapshot(600)], 599), undefined)
  assert.deepEqual(
    snapshots.map((value) => value.atSeconds),
    [600, 0, 120],
  )
})
test("empty and unknown slots remain distinct and explicit transactions do not reconstruct an inventory", () => {
  const value = snapshot(0)
  value.slots[1] = { slot: 2, known: true, item: null }
  const observed = snapshotAt([value], 300)!
  assert.equal(observed.slots[1]?.known, true)
  assert.equal(observed.slots[1]?.item, null)
  assert.equal(observed.slots[2]?.known, false)
})
test("timeline merges observed timestamps and explicit transactions without adding inferred milestones", () => {
  const sides = [
    {
      side: "BLUE",
      teamId: "a",
      bans: [],
      participants: [
        {
          playerId: "p",
          lane: "TOP",
          hero: { name: "Airi" },
          spell: { name: "Tốc biến" },
          arcana: { status: "UNKNOWN", entries: [] },
          enchantments: { status: "NOT_SHOWN", entries: [] },
          equipmentSnapshots: [snapshot(300), snapshot(0)],
          equipmentEvents: [
            { atSeconds: 60, type: "BUY", item: { name: "Kiếm ngắn" } },
            { atSeconds: 300, type: "SELL", item: { name: "Kiếm ngắn" } },
          ],
        },
      ],
    },
  ] as GameSide[]
  assert.deepEqual(observationTimes(sides), [0, 60, 300])
})
test("match clocks do not wrap at an hour or expose negative times", () => {
  assert.equal(clock(3601), "60:01")
  assert.equal(clock(-20), "0:00")
})

test("a missing picture is replaced by two letters of the name", () => {
  assert.equal(nameInitials("Ryoma"), "Ry")
  assert.equal(nameInitials("Triệu Vân"), "TV")
  assert.equal(nameInitials("Flowborn Xạ thủ"), "FX")
  assert.equal(nameInitials("Y’bneth"), "Yb", "an apostrophe is not a letter")
  assert.equal(nameInitials("Điêu Thuyền"), "ĐT")
  assert.equal(nameInitials("Qi"), "Qi")
  assert.equal(nameInitials("  "), "?")
})

test("a series name loses its pairing, which the teams beside it already show", () => {
  assert.equal(seriesRound("Vòng 18 · FPL vs SGP"), "Vòng 18")
  assert.equal(seriesRound("Chung kết tổng"), "Chung kết tổng")
  assert.equal(seriesRound("Vòng 1 nhánh thua · 2"), "Vòng 1 nhánh thua · 2")
  assert.equal(seriesRound("HEV vs. BĐ"), null)
  assert.equal(seriesRound(undefined), null)
})

test("a note imported from a wiki is shown without its markup", () => {
  assert.equal(
    plainNote("Player of the Match: {{Player|Metaverse|link=Wanyi|flag=tw}} (47.1%)\nBanMei Gaming: Junnn thay Baini"),
    "Player of the Match: Metaverse (47.1%)\nBanMei Gaming: Junnn thay Baini",
  )
  assert.equal(
    plainNote("Match was held in {{Flag|tw}} Kaohsiung.<br>Player of the Match: {{player|Wanyi|flag=tw}}"),
    "Match was held in Kaohsiung.\nPlayer of the Match: Wanyi",
  )
  assert.equal(
    plainNote("MVP: {{Player|Artie|flag=th}} (42.0%) <hr>Originally scheduled at 12:00 {{Abbr/ICT}}, postponed."),
    "MVP: Artie (42.0%)\nOriginally scheduled at 12:00 ICT, postponed.",
  )
  assert.equal(
    plainNote("MVP trận: Anne (4.8/5)\n\nBình luận: Huy Popper"),
    "MVP trận: Anne (4.8/5)\nBình luận: Huy Popper",
  )
  assert.equal(plainNote("{{Unknown}}"), "")
})

const player = (extra: Partial<Participant> = {}): Participant => ({
  lane: "TOP",
  hero: { name: "Airi" },
  spell: {},
  arcana: { status: "UNKNOWN", entries: [] },
  enchantments: { status: "NOT_SHOWN", entries: [] },
  equipmentSnapshots: [],
  equipmentEvents: [],
  ...extra,
})

const game = (scoreA?: number, scoreB?: number, bestOf = 7) =>
  ({
    content: {
      sides: [
        { side: "BLUE", teamId: "box", bans: [], participants: [] },
        { side: "RED", teamId: "bme", bans: [], participants: [] },
      ],
    },
    series: {
      teamAId: "bme",
      teamBId: "box",
      bestOf,
      result: scoreA == null ? null : { scoreA, scoreB },
    },
    teams: {
      bme: { code: "bme", name: "BOOM Esports", shortName: "BME", logoUrl: "bme.png" },
      box: { code: "box", name: "Box Gaming" },
    },
  }) as unknown as PublishedGame

test("the sides of a game follow the order of its series, whichever colour a team played", () => {
  assert.deepEqual(
    seriesSides(game()).map((side) => [side.teamId, side.side]),
    [
      ["bme", "RED"],
      ["box", "BLUE"],
    ],
  )
  const stray = game()
  stray.series.teamAId = "gone"
  assert.deepEqual(
    seriesSides(stray).map((side) => side.teamId),
    ["box", "bme"],
    "a series that does not name the teams keeps the order of the game",
  )
})

test("the series score names a winner only once it decides the series", () => {
  const [bme, box] = seriesTeams(game(4, 3))
  assert.deepEqual(
    [bme.name, bme.shortName, bme.logoUrl, bme.score, bme.won, bme.lost],
    ["BOOM Esports", "BME", "bme.png", 4, true, false],
  )
  assert.deepEqual([box.shortName, box.score, box.won, box.lost], ["Box Gaming", 3, false, true])
  assert.deepEqual(
    seriesTeams(game(2, 1)).map((team) => [team.score, team.won, team.lost]),
    [
      [2, false, false],
      [1, false, false],
    ],
    "two games are not enough in a best of seven",
  )
  assert.deepEqual(
    seriesTeams(game()).map((team) => team.score),
    [null, null],
  )
})

test("a loadout counts as recorded only when the source showed something", () => {
  const empty = player({ arcana: { status: "PARTIAL", entries: [] } })
  const known = player({
    arcana: { status: "KNOWN", entries: [{ selection: { name: "Ngọc đỏ" }, count: 10 }] },
    equipmentSnapshots: [snapshot(0)],
  })
  const guessed = player({
    enchantments: { status: "UNKNOWN", entries: [{ selection: { name: "Phù hiệu" }, primary: true, tier: 1 }] },
  })
  assert.equal(hasLoadout(empty, "arcana"), false, "a status without entries shows nothing")
  assert.equal(hasLoadout(known, "arcana"), true)
  assert.equal(hasLoadout(known, "equipment"), true)
  assert.equal(hasLoadout(guessed, "enchantments"), false)

  const sides = (participants: Participant[]) => [{ side: "BLUE", teamId: "a", bans: [], participants }] as GameSide[]
  assert.deepEqual(recordedLoadouts(sides([empty, guessed])), [])
  assert.deepEqual(recordedLoadouts(sides([empty, known])), ["equipment", "arcana"])
  assert.deepEqual(
    recordedLoadouts(
      sides([player({ equipmentEvents: [{ atSeconds: 30, type: "BUY", item: { name: "Kiếm ngắn" } }] })]),
    ),
    ["equipment"],
    "a recorded purchase is shown even without a picture of the inventory",
  )
})
