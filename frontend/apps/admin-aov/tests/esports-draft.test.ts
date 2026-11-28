import assert from "node:assert/strict"
import { test } from "node:test"
import type { GameContent } from "@aov/community-contracts"
import { gameStatistics } from "../src/features/esports/model/statistics"
import { draftGame } from "./fixtures/esports-model"

test("a team cannot pick again what it played earlier in the series, until the last game of the BO", async () => {
  const { draftUnavailable, seriesLocks, unavailableReason, allowedOptions } =
    await import("../src/features/esports/model/series-rules")
  const games = [
    draftGame(1, { teamId: "a", picks: ["Florentino", "Nakroth"], bans: ["Aoi"] }, { teamId: "b", picks: ["Lauriel"] }),
    // Teams swap sides in game 2; the rule follows the team, not the side.
    draftGame(2, { teamId: "b", picks: ["Capheny"] }, { teamId: "a", picks: ["Ẻlsu"] }),
  ]
  const locks = seriesLocks(games, 3, 5)
  assert.equal(locks.decider, false)
  assert.deepEqual(
    locks.byTeam.get("a")!.map((use) => [use.gameNumber, use.hero.name]),
    [
      [1, "Florentino"],
      [1, "Nakroth"],
      [2, "Ẻlsu"],
    ],
  )
  assert.deepEqual(
    locks.byTeam.get("b")!.map((use) => use.hero.name),
    ["Lauriel", "Capheny"],
  )

  const game3 = draftGame(3, { teamId: "a", picks: [null, "Murad"], bans: ["Lauriel"] }, { teamId: "b", picks: [] })
  const name = (id: string) => (id === "a" ? "AZT" : "EMW")
  const pickA = draftUnavailable(game3.content, { side: "BLUE", kind: "pick", index: 0 }, locks, name)
  assert.equal(
    unavailableReason(pickA, { name: "florentino" }),
    "AZT đã dùng ở ván 1",
    "names match case-insensitively",
  )
  assert.equal(unavailableReason(pickA, { name: "Elsu" }), "AZT đã dùng ở ván 2", "and without accents")
  assert.equal(unavailableReason(pickA, { name: "Lauriel" }), "Đã bị cấm ở ván này")
  assert.equal(unavailableReason(pickA, { name: "Murad" }), "AZT đã chọn ở ván này")
  assert.equal(unavailableReason(pickA, { name: "Aoi" }), null, "a ban from an earlier game no longer applies")
  assert.equal(unavailableReason(pickA, { name: "Capheny" }), null, "the other team's earlier picks stay open")

  const pickB = draftUnavailable(game3.content, { side: "RED", kind: "pick", index: 0 }, locks, name)
  assert.equal(unavailableReason(pickB, { name: "Florentino" }), null)
  assert.equal(unavailableReason(pickB, { name: "Capheny" }), "EMW đã dùng ở ván 2")

  const ban = draftUnavailable(game3.content, { side: "RED", kind: "ban", index: 0 }, locks, name)
  assert.equal(unavailableReason(ban, { name: "Florentino" }), null, "bans may target heroes locked for a team")
  assert.equal(unavailableReason(ban, { name: "Murad" }), "AZT đã chọn ở ván này")

  const own = draftUnavailable(game3.content, { side: "BLUE", kind: "pick", index: 1 }, locks, name)
  assert.equal(unavailableReason(own, { name: "Murad" }), null, "a slot can keep its own hero")
  const catalog = ["Florentino", "Murad", "Aoi", "Lauriel"].map((hero) => ({ id: hero.toLowerCase(), name: hero }))
  assert.deepEqual(
    allowedOptions(catalog, pickA).map((hero) => hero.name),
    ["Aoi"],
  )

  const decider = seriesLocks(
    [...games, draftGame(3, { teamId: "a", picks: ["Murad"] }, { teamId: "b", picks: [] })],
    5,
    5,
  )
  assert.equal(decider.decider, true)
  assert.equal(decider.byTeam.size, 0, "the last game of the BO opens every hero again")
  assert.equal(seriesLocks(games, 1, 5).byTeam.size, 0, "game 1 has nothing before it")
})

test("draft turns build bans and provisional line-ups, and teammates swap heroes without leaving the team", async () => {
  const { assignHero, earliestLive, withTurns } = await import("../src/features/esports/model/draft")
  const base = draftGame(2, { teamId: "a", picks: [] }, { teamId: "b", picks: [] }).content as Parameters<
    typeof withTurns
  >[0]
  const turn = (order: number, kind: "BAN" | "PICK", side: "BLUE" | "RED", name: string, atSecond?: number) => ({
    order,
    kind,
    side,
    hero: { id: null, name },
    atSecond,
  })
  const drafted = withTurns(base, [
    turn(1, "BAN", "BLUE", "Aoi", 110),
    turn(2, "PICK", "BLUE", "Murad", 120),
    turn(3, "PICK", "RED", "Lauriel", 125),
    turn(4, "PICK", "BLUE", "Omen", 130),
  ])
  assert.deepEqual(
    drafted.sides[0]!.bans.map((ban) => ban.name),
    ["Aoi", null, null, null],
  )
  assert.deepEqual(
    drafted.sides[0]!.participants.map((participant) => participant.hero.name),
    ["Murad", "Omen", null, null, null],
    "picks fill empty lanes in pick order",
  )

  // Omen goes top: the top laner's Murad moves to jungle, where Omen was.
  const swapped = assignHero(drafted, "BLUE", 0, { id: null, name: "Omen" })
  assert.deepEqual(
    swapped.sides[0]!.participants.map((participant) => participant.hero.name),
    ["Omen", "Murad", null, null, null],
  )
  // Undoing the last pick removes it from the line-up and keeps the swap of the rest.
  const undone = withTurns(swapped, swapped.draft!.turns.slice(0, -1))
  assert.deepEqual(
    undone.sides[0]!.participants.map((participant) => participant.hero.name),
    [null, "Murad", null, null, null],
  )
  assert.equal(earliestLive({ startSecond: 100, lockedSecond: 140, turns: drafted.draft!.turns }), 140)
})

test("a hero written with a plain apostrophe matches the catalog's curly one everywhere", async () => {
  const { referenceIndex } = await import("../src/features/esports/model/game-view")
  const { heroKeys } = await import("../src/features/esports/model/series-rules")
  const { nameKey } = await import("../src/features/esports/model/name-key")
  const catalog = [{ id: "ybneth", code: "ybneth", name: "Y’bneth", iconUrl: "/ybneth.png" }]

  assert.equal(nameKey("Y'bneth"), nameKey("Y’bneth"))
  assert.equal(nameKey("  Tel‘Annas "), nameKey("Tel'Annas"))
  assert.equal(
    referenceIndex(catalog)({ name: "Y'bneth" })?.iconUrl,
    "/ybneth.png",
    "the imported name finds its picture",
  )

  const imported = heroKeys({ name: "Y'bneth" })
  const recorded = heroKeys({ id: "ybneth", name: "Y’bneth" })
  assert.ok(
    imported.some((key) => recorded.includes(key)),
    "a series rule sees both spellings as one hero",
  )

  const content = (heroName: string, id?: string) =>
    ({
      seriesId: "s",
      number: 1,
      region: "VN",
      locale: "vi-VN",
      winner: "BLUE",
      sides: [
        { side: "BLUE", teamId: "a", bans: [], participants: [{ lane: "MID", hero: { id, name: heroName } }] },
        { side: "RED", teamId: "b", bans: [{ name: "Y'bneth" }], participants: [] },
      ],
    }) as unknown as Parameters<typeof gameStatistics>[0][number]
  const stats = gameStatistics([content("Y'bneth"), content("Y’bneth", "ybneth")])
  const ybneth = stats.heroes.filter((entry) => nameKey(entry.name) === nameKey("Y'bneth"))
  assert.equal(ybneth.length, 1, "statistics count one hero, not two spellings")
  assert.equal(ybneth[0]!.picks, 2)
  assert.equal(ybneth[0]!.bans, 2)
  assert.equal(ybneth[0]!.name, "Y’bneth", "the catalog's spelling is shown")
})

test("an imported hero name finds its catalog hero by code or by the checked list, and shows the catalog name", async () => {
  const { referenceIndex } = await import("../src/features/esports/model/game-view")
  const hero = (id: string, code: string, name: string) => ({ id, code, name, iconUrl: `/${code}.png` })
  const lookup = referenceIndex([
    hero("lubu", "lu-bu", "Lữ Bố"),
    hero("richter", "riktor", "Richter"),
    hero("diaochan", "diaochan", "Điêu Thuyền"),
    hero("ming", "ming", "Ming"),
    hero("flowborn-mid", "flowborn-mid", "Flowborn Pháp sư"),
    hero("helen", "helen", "Helen"),
    hero("bolt-baron", "bolt-baron", "Bolt Baron"),
    hero("dolia", "dolia", "Dolia"),
  ])
  assert.deepEqual(
    ["Lu Bu", "Riktor", "Diao Chan", "Ming Shiyin", "Flowborn Mage"].map((name) => lookup({ name })?.name),
    ["Lữ Bố", "Richter", "Điêu Thuyền", "Ming", "Flowborn Pháp sư"],
  )
  assert.deepEqual(
    ["Payna", "Peura", "Sikong Zhen", "Doria"].map((name) => lookup({ name })?.name),
    ["Helen", "Helen", "Bolt Baron", "Dolia"],
    "a reworked hero and the Honor of Kings names of two others",
  )
  assert.equal(lookup({ name: "Lu Bu" })?.iconUrl, "/lu-bu.png")
  assert.equal(
    lookup({ name: "The Joker" })?.iconUrl,
    undefined,
    "a hero the catalog lacks keeps its recorded name only",
  )
  assert.equal(lookup({ name: "The Joker" })?.name, "The Joker")
  assert.equal(
    lookup({ id: "lubu", name: "Lu Bu" })?.name,
    "Lu Bu",
    "a selection with an id keeps the name recorded with it",
  )
})

const imported = () =>
  draftGame(
    2,
    { teamId: "a", picks: ["Maloch", "Nakroth", "Tulen", "Violet", "Alice"], bans: ["Aoi"] },
    { teamId: "b", picks: ["Florentino", "Murad", "Lauriel", "Capheny", "Zip"] },
  ).content as GameContent
const turnOf = (order: number, kind: "BAN" | "PICK", side: "BLUE" | "RED", name: string, atSecond?: number) => ({
  order,
  kind,
  side,
  hero: { id: name.toLowerCase(), name },
  atSecond,
})

test("a game with heroes or bans and no turns lacks its turns; an empty one does not", async () => {
  const { lacksTurns } = await import("../src/features/esports/model/draft")
  assert.equal(lacksTurns(imported()), true)
  const empty = draftGame(2, { teamId: "a", picks: [] }, { teamId: "b", picks: [] }).content as GameContent
  assert.equal(lacksTurns(empty), false)
  const turns = [turnOf(1, "BAN", "BLUE", "Aoi")]
  assert.equal(lacksTurns({ ...imported(), draft: { startSecond: null, lockedSecond: null, turns } }), false)
})

test("one turn of an imported game would empty its line-ups, so it waits while any recorded hero is unnamed", async () => {
  const { unnamed, withTurns } = await import("../src/features/esports/model/draft")
  const first = [turnOf(1, "BAN", "BLUE", "Aoi")]
  const wiped = withTurns(imported(), first)
  assert.equal(
    wiped.sides.every((side) => side.participants.every(({ hero }) => !hero.name)),
    true,
    "this is what one turn alone would do",
  )
  assert.equal(unnamed(imported(), first).length, 10, "so the ten heroes are still to be named")
  assert.deepEqual(unnamed(imported(), [])[0], { side: "BLUE", kind: "BAN", hero: { id: null, name: "Aoi" } })
})

test("a hero named for the other team, or as a ban, stays unnamed", async () => {
  const { unnamed } = await import("../src/features/esports/model/draft")
  const left = (turns: ReturnType<typeof turnOf>[]) => unnamed(imported(), turns).map(({ hero }) => hero.name)
  assert.equal(left([turnOf(1, "PICK", "RED", "Tulen")]).includes("Tulen"), true)
  assert.equal(left([turnOf(1, "BAN", "BLUE", "Tulen")]).includes("Tulen"), true)
  assert.equal(left([turnOf(1, "PICK", "BLUE", "Tulen")]).includes("Tulen"), false)
})

test("turns saved together keep every hero in its lane and give it the id its turn knows", async () => {
  const { withCollectedTurns } = await import("../src/features/esports/model/draft")
  const content = imported()
  const turns = content.sides.flatMap((side) => [
    ...side.bans.flatMap((ban) => (ban.name ? [turnOf(0, "BAN", side.side, ban.name)] : [])),
    // In another order than the lanes.
    ...[...side.participants].reverse().map(({ hero }) => turnOf(0, "PICK", side.side, hero.name!)),
  ])
  const next = withCollectedTurns(content, turns)
  assert.deepEqual(
    next.sides[0]!.participants.map(({ hero }) => [hero.id, hero.name]),
    ["Maloch", "Nakroth", "Tulen", "Violet", "Alice"].map((name) => [name.toLowerCase(), name]),
  )
  assert.equal(next.draft?.turns[0]?.order, 1)
})

test("turns are written in their order without a second of the video, whatever older turns held", async () => {
  const { setDraftTimes, withTurns } = await import("../src/features/esports/model/draft")
  const content: GameContent = {
    ...imported(),
    sourceTimestampSeconds: 200,
    draft: {
      startSecond: 100,
      lockedSecond: 160,
      turns: [turnOf(1, "BAN", "BLUE", "Aoi", 110), turnOf(2, "BAN", "RED", "Elsu", 130)],
    },
  }
  const turns = content.draft!.turns
  const written = withTurns(content, [...turns, turnOf(3, "BAN", "BLUE", "Omen", 150)]).draft!
  assert.deepEqual(
    written.turns.map((turn) => [turn.order, turn.hero?.name, "atSecond" in turn]),
    [
      [1, "Aoi", false],
      [2, "Elsu", false],
      [3, "Omen", false],
    ],
  )
  const moved = setDraftTimes(content, { startSecond: 120 }).draft!
  assert.deepEqual([moved.startSecond, moved.lockedSecond], [120, 160])
  assert.ok(
    moved.turns.every((turn) => !("atSecond" in turn)),
    "moving the start drops the seconds of older turns",
  )
})

test("restoring a draft puts turns, bans and lanes back and leaves the rest of the game", async () => {
  const { restoreDraft, withTurns } = await import("../src/features/esports/model/draft")
  const before = imported()
  const after = { ...withTurns(before, [turnOf(1, "BAN", "BLUE", "Aoi")]), note: "written since" }
  const back = restoreDraft(before)(after)
  assert.deepEqual(back.sides, before.sides)
  assert.deepEqual(back.draft?.turns, [])
  assert.equal(back.note, "written since")
})
