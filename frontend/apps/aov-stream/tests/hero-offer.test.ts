import assert from "node:assert/strict"
import { test } from "node:test"
import { NOTHING_ASKED } from "../src/lib/finder-model.ts"
import { heroByKey } from "../src/lib/game-feed.ts"
import { heroRecords } from "../src/lib/hero-model.ts"
import { heroOffers, narrowOffers, tileAfter, type HeroOffer } from "../src/lib/hero-offer.ts"
import { feedOf, five, type TestGame } from "./fixtures/lineups.ts"

const game = (id: string, extra: Partial<TestGame> = {}): TestGame => ({
  id,
  series: "s1",
  blue: { team: "x", picks: five("a"), bans: ["feared"] },
  red: { team: "y", picks: ["rival", ...five("b").slice(1)], bans: ["hated"] },
  ...extra,
})
const feed = feedOf([
  game("g1"),
  game("g2", { red: { team: "y", picks: five("b"), bans: ["feared"] } }),
  game("g3", { blue: { team: "x", picks: ["a1", "rival", "a3", "a4", "a5"], bans: [] } }),
])
const offers = (role: "pick" | "vs" | "ban", question = {}) =>
  heroOffers(feed, heroRecords(feed), { ...NOTHING_ASKED, ...question }, role)
const keys = (list: HeroOffer[]) => list.map(({ hero }) => hero.key)

test("the hero that leaves most games is offered first", () => {
  const games = [["zoe", "abe"], ["zoe"], ["zoe"]].map((bans, index) =>
    game(`g${index}`, { blue: { team: "x", picks: five("a"), bans }, red: { team: "y", picks: five("b") } }),
  )
  const season = feedOf(games)
  assert.deepEqual(
    heroOffers(season, heroRecords(season), NOTHING_ASKED, "ban").map(({ hero, games: left }) => [hero.key, left]),
    [
      ["zoe", 3],
      ["abe", 1],
    ],
  )
})

test("heroes that leave as many games are offered by name", () => {
  assert.deepEqual(
    offers("ban").map(({ hero, games }) => [hero.key, games]),
    [
      ["feared", 2],
      ["hated", 2],
    ],
  )
})

test("a hero that leaves nothing is not offered", () => {
  const asked = { pick: [heroByKey(feed, "b1")!] }
  assert.equal(keys(offers("vs", asked)).includes("rival"), false)
  assert.equal(keys(offers("vs", asked)).includes("a1"), true)
})

test("a hero is offered with the lanes it plays; one never picked plays none", () => {
  const list = [...offers("vs"), ...offers("ban")]
  const lanes = (key: string) => list.find(({ hero }) => hero.key === key)!.lanes
  assert.deepEqual(lanes("rival"), ["TOP", "JUNGLE"])
  assert.deepEqual(lanes("feared"), [])
})

test("the arrow keys go from tile to tile and stay in the grid", () => {
  const from = (at: number) =>
    ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].map((key) => tileAfter(key, at, 5, 12))
  assert.deepEqual(from(6), [7, 5, 11, 1])
  assert.deepEqual(from(0), [1, 0, 5, -1])
  assert.deepEqual(from(11), [11, 10, 11, 6])
  assert.deepEqual([tileAfter("Home", 7, 5, 12), tileAfter("End", 7, 5, 12), tileAfter("a", 7, 5, 12)], [0, 11, null])
})

test("offers are narrowed by lane and by name", () => {
  const named = ["Eland’orr", "Điêu Thuyền", "Marja"].map((name): HeroOffer => ({
    hero: { key: name, id: null, code: null, name, iconUrl: null },
    games: 1,
    lanes: name === "Marja" ? ["TOP"] : ["DRAGON"],
  }))
  assert.deepEqual(keys(narrowOffers(named, "elandorr", null)), ["Eland’orr"])
  assert.deepEqual(keys(narrowOffers(named, " dieu thuyen ", null)), ["Điêu Thuyền"])
  assert.deepEqual(keys(narrowOffers(named, "", "TOP")), ["Marja"])
  assert.deepEqual(keys(narrowOffers(named, "mar", "DRAGON")), [])
  assert.equal(narrowOffers(named, "’", null).length, 3)
})
