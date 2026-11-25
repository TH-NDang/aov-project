import assert from "node:assert/strict"
import { test } from "node:test"
import type { HeroCount } from "@aov/community-contracts"
import { enoughPicks, heroLeaders, heroLines, percent, sortHeroes } from "../src/lib/statistics-model.ts"

const hero = (name: string, picks: number, wins: number, bans: number): HeroCount => ({
  id: name.toLowerCase(),
  name,
  picks,
  wins,
  bans,
  bluePicks: 0,
})
/** Of 100 games: one hero everyone bans, one everyone picks, one that wins and one that won its only game. */
const GAMES = 100
const lines = heroLines({
  heroes: [hero("Banned", 2, 1, 95), hero("Picked", 80, 40, 5), hero("Winner", 20, 15, 10), hero("Lucky", 1, 1, 0)],
})
const names = (list: { name: string }[]) => list.map((line) => line.name)

test("a hero is present in the games it was picked or banned in", () => {
  assert.deepEqual(
    lines.map((line) => [line.name, line.presence, line.winRate]),
    [
      ["Banned", 97, 0.5],
      ["Picked", 85, 0.5],
      ["Winner", 30, 0.75],
      ["Lucky", 1, 1],
    ],
  )
})

test("a hero that was never picked has no win rate", () => {
  assert.equal(heroLines({ heroes: [hero("Feared", 0, 0, 12)] })[0]!.winRate, null)
})

test("heroes go from the most to the fewest by the column chosen", () => {
  assert.deepEqual(names(sortHeroes(lines, "presence", GAMES)), ["Banned", "Picked", "Winner", "Lucky"])
  assert.deepEqual(names(sortHeroes(lines, "picks", GAMES)), ["Picked", "Winner", "Banned", "Lucky"])
  assert.deepEqual(names(sortHeroes(lines, "bans", GAMES)), ["Banned", "Winner", "Picked", "Lucky"])
})

test("by win rate a hero with too few picks comes after the others", () => {
  assert.equal(enoughPicks(GAMES), 5)
  assert.deepEqual(names(sortHeroes(lines, "wins", GAMES)), ["Winner", "Picked", "Lucky", "Banned"])
})

test("a small competition still asks for five picks", () => {
  assert.equal(enoughPicks(12), 5)
  assert.equal(enoughPicks(327), 17)
})

test("the leaders are the most picked, the most banned and the one that won the most of its picks", () => {
  const { picked, banned, winning } = heroLeaders(lines, GAMES)

  assert.deepEqual(names([picked!, banned!, winning!]), ["Picked", "Banned", "Winner"])
})

test("without games nothing leads and a share of nothing is zero", () => {
  assert.deepEqual(heroLeaders([], 0), { picked: null, banned: null, winning: null })
  assert.equal(percent(0, 0), 0)
})
