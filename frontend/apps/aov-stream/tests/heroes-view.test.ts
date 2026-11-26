import assert from "node:assert/strict"
import { test } from "node:test"
import type { Lane } from "@aov/community-contracts"
import { tally, type HeroLine } from "../src/lib/hero-model.ts"
import {
  firstOfWall,
  heroesHref,
  heroFigure,
  heroOrders,
  heroSummary,
  heroWall,
  laneNote,
  namedLike,
  picksWords,
  playsLane,
  readHeroesView,
  shelfTitle,
  wonShare,
  type HeroShelf,
} from "../src/lib/heroes-view.ts"
import { statsPlace, STATS_KEYS } from "../src/lib/statistics-routes.ts"

const vi = (text: string) => text
const en = (_: string, text: string) => text
const paramsOf = (href: string) => new URL(href, "http://x").searchParams

const line = (name: string, picks: number, wins: number, bans: number): HeroLine => ({
  hero: { key: name, id: name, code: name, name, iconUrl: null },
  picks,
  wins,
  losses: picks - wins,
  bans,
  presence: picks + bans,
  seen: picks + bans,
  blue: tally([]),
  red: tally([]),
  lanes: [],
})
/** Of 100 games: one hero everyone bans, one everyone picks, one that wins, one seen once and one only banned. */
const GAMES = { games: 100, shown: 100 }
const lines = [
  line("Banned", 2, 1, 95),
  line("Picked", 80, 40, 5),
  line("Winner", 20, 15, 10),
  line("Lucky", 1, 1, 0),
  line("Feared", 0, 0, 12),
]
const names = (list: HeroLine[]) => list.map(({ hero }) => hero.name)
const wall = (by: Parameters<typeof heroWall>[1]) => heroWall(lines, by, GAMES)
const shelf = (extra: Partial<HeroShelf>): HeroShelf => ({
  kind: "RANGE",
  from: 0,
  below: null,
  face: 52,
  lines: [],
  ...extra,
})

test("the heroes open by presence, as faces and of every lane, and the address says none of it", () => {
  assert.deepEqual(readHeroesView(new URLSearchParams()), { by: "presence", table: false, lane: null })
  assert.equal(heroesHref("c", {}), "/competitions/c?tab=stats")
})

test("what a reader chose is written into the address and read back, with the period counted", () => {
  const href = heroesHref("c", { by: "wins", table: true, lane: "JUNGLE" }, "GROUP.2")
  assert.deepEqual(readHeroesView(paramsOf(href)), { by: "wins", table: true, lane: "JUNGLE" })
  assert.equal(statsPlace(paramsOf(href)).scope, "GROUP.2")
  for (const key of paramsOf(href).keys()) assert.equal(key === "tab" || STATS_KEYS.includes(key), true, key)
})

test("an order, a view or a lane nobody knows is left aside", () => {
  assert.deepEqual(readHeroesView(new URLSearchParams("by=luck&as=poem&lane=RIVER")), {
    by: "presence",
    table: false,
    lane: null,
  })
})

/** Of 100 games 40 show who was banned, or none does. */
const PARTLY = { games: 100, shown: 40 }
const UNSHOWN = { games: 100, shown: 0 }

test("heroes are ordered by presence and bans while some game shows its bans", () => {
  assert.deepEqual(heroOrders(PARTLY), ["presence", "picks", "wins", "bans"])
  assert.deepEqual(heroOrders(UNSHOWN), ["picks", "wins"])
})

test("without an order by presence the heroes open by picks, also where the address asks for bans", () => {
  const orders = heroOrders(UNSHOWN)
  assert.equal(readHeroesView(new URLSearchParams(), orders).by, "picks")
  assert.equal(readHeroesView(new URLSearchParams("by=bans"), orders).by, "picks")
  assert.equal(readHeroesView(new URLSearchParams("by=wins"), orders).by, "wins")
})

test("a hero belongs to a lane after five games there, or after a fifth of its picks", () => {
  const played = (games: number, picks: number) => playsLane({ lanes: [{ lane: "TOP" as Lane, games }], picks }, "TOP")
  assert.equal(played(5, 100), true)
  assert.equal(played(4, 100), false)
  assert.equal(played(1, 5), true)
  assert.equal(played(1, 6), false)
  assert.equal(playsLane({ lanes: [], picks: 0 }, "TOP"), false)
})

test("a hero is found by its name as a reader types it", () => {
  const heroes = [line("Y’bneth", 1, 0, 0), line("Điêu Thuyền", 1, 0, 0)]
  for (const search of ["ybneth", "y'bneth", "Y’B"])
    assert.deepEqual(names(namedLike(heroes, search)), ["Y’bneth"], search)
  assert.deepEqual(names(namedLike(heroes, "dieu thuyen")), ["Điêu Thuyền"])
  assert.deepEqual(namedLike(heroes, "zuka"), [])
  assert.equal(namedLike(heroes, "  ").length, 2)
})

test("faces shrink from shelf to shelf", () => {
  assert.deepEqual(
    wall("presence").map(({ from, face, lines: held }) => [from, face, names(held)]),
    [
      [90, 96, ["Banned"]],
      [50, 96, ["Picked"]],
      [25, 80, ["Winner"]],
      [5, 64, ["Feared"]],
      [0, 52, ["Lucky"]],
    ],
  )
})

test("by wins the first shelf has the largest faces, and those that say nothing the smallest", () => {
  assert.deepEqual(
    wall("wins").map(({ face }) => face),
    [96, 80, 52, 52],
  )
})

test("heroes picked only in games that do not show their bans close the wall of presence", () => {
  const hidden = { ...line("Hidden", 9, 4, 0), seen: 0 }
  const last = heroWall([...lines, hidden], "presence", PARTLY).at(-1)!
  assert.deepEqual([last.kind, names(last.lines)], ["NONE", ["Hidden"]])
  assert.equal(shelfTitle(last, "presence", PARTLY, vi), "Không có mặt ở ván nào có ghi lượt cấm")
})

test("heroes nobody picked or banned close the wall of picks or of bans", () => {
  const last = (by: Parameters<typeof heroWall>[1]) => wall(by).at(-1)!
  assert.deepEqual([last("picks").kind, names(last("picks").lines)], ["NONE", ["Feared"]])
  assert.deepEqual([last("bans").kind, names(last("bans").lines)], ["NONE", ["Lucky"]])
})

test("by wins the heroes with too few picks and those without any stand on shelves of their own", () => {
  assert.deepEqual(
    wall("wins").map(({ kind, from, lines: held }) => [kind, from, names(held)]),
    [
      ["RANGE", 60, ["Winner"]],
      ["RANGE", 40, ["Picked"]],
      ["FEW", 0, ["Banned", "Lucky"]],
      ["NONE", 0, ["Feared"]],
    ],
  )
})

test("by wins a hero of games without a result closes the wall, however often it was picked", () => {
  const open = { ...line("Open", 50, 0, 0), losses: 0 }
  assert.deepEqual(
    heroWall([open], "wins", GAMES).map(({ kind, lines: held }) => [kind, names(held)]),
    [["NONE", ["Open"]]],
  )
})

test("every hero stands on one shelf whatever the order", () => {
  for (const by of ["presence", "picks", "wins", "bans"] as const)
    assert.deepEqual(
      wall(by)
        .flatMap(({ lines: held }) => names(held))
        .sort(),
      names(lines).sort(),
    )
})

test("a wall that grows as it is read ends in the middle of a shelf", () => {
  const shelves = [shelf({ from: 50, lines: lines.slice(0, 2) }), shelf({ lines: lines.slice(2) })]
  assert.deepEqual(
    firstOfWall(shelves, 3).map(({ shelf: { from }, lines: held }) => [from, held.length]),
    [
      [50, 2],
      [0, 1],
    ],
  )
  assert.equal(firstOfWall(shelves, 2).length, 1)
  assert.equal(firstOfWall(shelves, 99)[1]!.lines.length, 3)
})

test("shelves are named by their limits", () => {
  assert.deepEqual(
    wall("presence").map((item) => shelfTitle(item, "presence", GAMES, vi)),
    ["Từ 90% số ván", "50–89% số ván", "25–49% số ván", "5–24% số ván", "Dưới 5% số ván"],
  )
  assert.deepEqual(
    wall("wins").map((item) => shelfTitle(item, "wins", GAMES, vi)),
    ["Thắng từ 60%", "Thắng 40–59%", "Dưới 5 lượt chọn, chưa đủ để so", "Chưa có kết quả ván nào"],
  )
  assert.equal(shelfTitle(shelf({ from: 0, below: 40 }), "wins", GAMES, vi), "Thắng dưới 40%")
  assert.equal(shelfTitle(wall("bans").at(-1)!, "bans", GAMES, vi), "Chưa bị cấm ván nào")
  assert.equal(shelfTitle(wall("picks").at(-1)!, "picks", GAMES, vi), "Chưa được chọn ván nào")
})

test("shelves of presence and of bans name the games they are shares of, where not all show their bans", () => {
  const title = (item: Partial<HeroShelf>, by: "presence" | "bans" | "picks", text = vi) =>
    shelfTitle(shelf(item), by, PARTLY, text)
  assert.equal(title({ from: 90 }, "presence"), "Từ 90% số ván có ghi lượt cấm")
  assert.equal(title({ from: 50, below: 90 }, "bans"), "50–89% số ván có ghi lượt cấm")
  assert.equal(title({ from: 0, below: 5 }, "presence"), "Dưới 5% số ván có ghi lượt cấm")
  assert.equal(title({ from: 0, below: 5 }, "presence", en), "Under 5% of games that record bans")
  assert.equal(title({ kind: "NONE" }, "bans"), "Không bị cấm ở ván nào có ghi lượt cấm")
  assert.equal(title({ from: 25 }, "picks"), "Từ 25% số ván")
})

/** Of four games: one hero seen in all of them, one in three, one in two and one in a single one. */
const FIRST_EVENING = { games: 4, shown: 4 }
const evening = [line("Banned", 1, 0, 3), line("Picked", 2, 1, 1), line("Both", 1, 1, 1), line("Once", 1, 0, 0)]
const eveningTitles = (by: Parameters<typeof heroWall>[1], text = vi) =>
  heroWall(evening, by, FIRST_EVENING).map((item) => shelfTitle(item, by, FIRST_EVENING, text))

test("the shelves of fewer than ten games are limited in games", () => {
  assert.deepEqual(eveningTitles("presence"), ["Cả 4 ván", "2–3 ván", "1 ván"])
  assert.deepEqual(eveningTitles("presence", en), ["All 4 games", "2–3 games", "1 game"])
  assert.deepEqual(eveningTitles("bans"), ["Từ 2 ván", "1 ván", "Chưa bị cấm ván nào"])
  assert.deepEqual(eveningTitles("picks"), ["Từ 1 ván"])
})

test("the limits of a shelf in games are those its heroes keep", () => {
  for (const by of ["presence", "picks", "bans"] as const)
    for (let games = 1; games < 10; games += 1) {
      const counted = { games, shown: games }
      const every = Array.from({ length: games }, (_, index): HeroLine => {
        const seen = index + 1
        return { ...line(`H${seen}`, seen, 0, seen), presence: seen, seen }
      })
      for (const item of heroWall(every, by, counted)) {
        const [least, most] = (shelfTitle(item, by, counted, vi).match(/\d+/g) ?? []).map(Number)
        const seen = item.lines.map(({ picks }) => picks)
        assert.equal(Math.min(...seen), least, `${by} of ${games}`)
        if (most != null) assert.equal(Math.max(...seen), most, `${by} of ${games}`)
      }
    }
})

test("the only game there is stands on a shelf of one", () => {
  const title = (text = vi) => shelfTitle(shelf({ from: 90 }), "presence", { games: 1, shown: 1 }, text)
  assert.deepEqual([title(), title(en)], ["1 ván", "1 game"])
})

test("limits in games name the games that show their bans, where not all do", () => {
  const counted = { games: 24, shown: 4 }
  const title = (item: Partial<HeroShelf>, text = vi) => shelfTitle(shelf(item), "presence", counted, text)
  assert.equal(title({ from: 90 }), "Cả 4 ván có ghi lượt cấm")
  assert.equal(title({ from: 25, below: 50 }), "1 ván có ghi lượt cấm")
  assert.equal(title({ from: 25, below: 50 }, en), "1 of the games that record bans")
  assert.equal(shelfTitle(shelf({ from: 25 }), "picks", counted, vi), "Từ 25% số ván")
})

test("the shelf of too few picks says how many are enough", () => {
  const season = { games: 327, shown: 327 }
  assert.equal(shelfTitle(shelf({ kind: "FEW" }), "wins", season, vi), "Dưới 17 lượt chọn, chưa đủ để so")
  assert.equal(shelfTitle(shelf({ kind: "FEW" }), "wins", season, en), "Fewer than 17 picks, too few to compare")
})

const figure = (item: HeroLine, on: Partial<HeroShelf>, by: Parameters<typeof heroWall>[1]) =>
  heroFigure(item, shelf(on), by, GAMES, vi, "vi-VN")

test("a face says its share of the games, and on the lowest shelf how many they were", () => {
  assert.deepEqual(figure(lines[1]!, { from: 50, below: 90 }, "presence"), { figure: "85%" })
  assert.deepEqual(figure(lines[3]!, { from: 0, below: 5 }, "presence"), { figure: "1", unit: "ván" })
})

test("the share of a face is out of the games that show their bans", () => {
  const known = { ...line("Known", 30, 15, 20), presence: 50, seen: 36 }
  const said = (on: Partial<HeroShelf>) => heroFigure(known, shelf(on), "presence", PARTLY, vi, "vi-VN")
  assert.deepEqual(said({ from: 90 }), { figure: "90%" })
  assert.deepEqual(said({ from: 0, below: 5 }), { figure: "36", unit: "ván" })
})

test("a face of fewer than ten games counts them", () => {
  const said = (counted: typeof FIRST_EVENING) =>
    heroFigure(evening[1]!, shelf({ from: 50, below: 90 }), "presence", counted, vi, "vi-VN")
  assert.deepEqual(said(FIRST_EVENING), { figure: "3", unit: "ván" })
  assert.deepEqual(said({ games: 10, shown: 9 }), { figure: "3", unit: "ván" })
  assert.deepEqual(said({ games: 10, shown: 10 }), { figure: "30%" })
})

test("by picks and by bans a face counts games", () => {
  assert.deepEqual(figure(lines[1]!, { from: 25 }, "picks"), { figure: "80", unit: "ván" })
  assert.deepEqual(figure(lines[0]!, { from: 50 }, "bans"), { figure: "95", unit: "ván" })
})

test("by wins a face says its record, with a share of it where it can be compared", () => {
  assert.deepEqual(figure(lines[2]!, { from: 60 }, "wins"), { figure: "15–5", share: "75%" })
  assert.deepEqual(figure(lines[0]!, { kind: "FEW" }, "wins"), { figure: "1–1", share: null })
  assert.deepEqual(figure(line("Long", 12, 8, 0), { kind: "FEW" }, "wins"), { figure: "8–4", share: null })
})

test("a hero a shelf says nothing about has no figure", () => {
  assert.equal(figure(lines[4]!, { kind: "NONE" }, "picks"), null)
})

test("a share of wins needs ten decided games", () => {
  assert.equal(wonShare({ wins: 9, losses: 0 }), null)
  assert.equal(wonShare({ wins: 9, losses: 1 }), "90%")
})

test("a hero nobody picked is told so, and not that its games have no result yet", () => {
  assert.equal(picksWords(tally([]), vi, "vi-VN"), "chưa được chọn")
  assert.equal(picksWords(tally([]), en, "en-US"), "never picked")
})

test("picks are told by how they ended, once one of them has a result", () => {
  assert.equal(picksWords(tally([null, null]), vi, "vi-VN"), "chưa có kết quả ván nào")
  assert.equal(picksWords(tally([true, null, false, true]), vi, "vi-VN"), "thắng 2, thua 1")
})

test("the only hero of a lane is told of as one", () => {
  assert.equal(
    laneNote(1, "SUPPORT", vi),
    "1 tướng chơi hỗ trợ từ 5 ván hoặc 20% lượt chọn. Số liệu tính cả các đường khác.",
  )
  assert.match(laneNote(1, "SUPPORT", en), /^1 hero with 5 games or 20% of its picks as support\./)
  assert.match(laneNote(15, "SUPPORT", en), /^15 heroes with 5 games or 20% of their picks as support\./)
})

test("the note names its lane as a sentence does, keeping the capital of a name", () => {
  assert.match(laneNote(20, "JUNGLE", vi), /^20 tướng chơi đi rừng /)
  assert.match(laneNote(9, "TOP", vi), /^9 tướng chơi đường Caesar /)
  assert.match(laneNote(9, "TOP", en), / picks in the Dark Slayer lane\./)
})

test("a face is read out as everything its bar shows", () => {
  assert.equal(
    heroSummary(lines[2]!, GAMES, vi, "vi-VN"),
    "Winner: có mặt 30 trong 100 ván; chọn 20, thắng 15, thua 5; bị cấm 10",
  )
  assert.equal(heroSummary(lines[4]!, GAMES, vi, "vi-VN"), "Feared: có mặt 12 trong 100 ván; chưa được chọn; bị cấm 12")
})

test("a face is read out with the games its presence is out of, where not all show their bans", () => {
  const known = { ...line("Known", 30, 15, 20), presence: 50, seen: 36 }
  assert.equal(
    heroSummary(known, PARTLY, vi, "vi-VN"),
    "Known: có mặt 36 trong 40 ván có ghi lượt cấm; chọn 30, thắng 15, thua 15; bị cấm 20",
  )
})

test("a face says nothing of bans it knows nothing of", () => {
  const picked = { ...line("Picked", 30, 15, 0), seen: 12 }
  assert.equal(
    heroSummary(picked, PARTLY, vi, "vi-VN"),
    "Picked: có mặt 12 trong 40 ván có ghi lượt cấm; chọn 30, thắng 15, thua 15",
  )
  assert.equal(
    heroSummary({ ...picked, seen: 0 }, UNSHOWN, vi, "vi-VN"),
    "Picked: chọn 30 trong 100 ván, thắng 15, thua 15",
  )
})

test("a face of games without a result is read out without a record", () => {
  const open = { ...line("Open", 3, 0, 0), losses: 0 }
  assert.equal(heroSummary(open, GAMES, vi, "vi-VN"), "Open: có mặt 3 trong 100 ván; chọn 3; chưa bị cấm")
})
