import assert from "node:assert/strict"
import { test } from "node:test"
import { STATS_KEYS, statsHref, statsPlace } from "../src/lib/statistics-routes.ts"

const placeOf = (href: string) => statsPlace(new URL(href, "http://x").searchParams)
const star = { key: "star", id: "id", code: "star", name: "Star", iconUrl: null }

test("the statistics open on the heroes", () => {
  assert.equal(statsHref("c"), "/competitions/c?tab=stats")
  assert.equal(statsHref("c", { part: "heroes" }), "/competitions/c?tab=stats")
  assert.equal(placeOf(statsHref("c")).part, "heroes")
})

test("a part is named in the address and read back", () => {
  assert.equal(statsHref("c", { part: "teams" }), "/competitions/c?tab=stats&view=teams")
  assert.equal(placeOf(statsHref("c", { part: "teams" })).part, "teams")
  assert.equal(placeOf("/competitions/c?tab=stats&view=unknown").part, "heroes")
})

test("a hero has a page of its own among the heroes", () => {
  const href = statsHref("c", { hero: star, part: "teams" })
  assert.equal(href, "/competitions/c?tab=stats&hero=star")
  assert.deepEqual([placeOf(href).part, placeOf(href).hero], ["heroes", "star"])
})

test("a hero named beside another part opens its page among the heroes", () => {
  const open = placeOf("/competitions/c?tab=stats&view=teams&hero=star&club=t")
  assert.deepEqual([open.part, open.hero, open.team], ["heroes", "star", null])
})

test("a team is named among the teams alone", () => {
  assert.equal(placeOf("/competitions/c?tab=stats&club=t").team, null)
  assert.equal(placeOf("/competitions/c?tab=stats&view=highlights&club=t").team, null)
})

test("a team has a page of its own among the teams, which a question about a team does not open", () => {
  assert.equal(placeOf(statsHref("c", { part: "teams", team: "t" })).team, "t")
  assert.equal(placeOf(statsHref("c", { question: { team: "t" } })).team, null)
})

test("the games of a hero or a team open in its place", () => {
  assert.deepEqual(placeOf(statsHref("c", { hero: star, list: "bans" })).list, "bans")
  assert.deepEqual(placeOf(statsHref("c", { part: "teams", team: "t", list: "games" })).list, "games")
  assert.equal(statsHref("c", { part: "teams", list: "games" }), "/competitions/c?tab=stats&view=teams")
})

test("the game chosen in the season of a team stands in the address of the team", () => {
  const href = statsHref("c", { part: "teams", team: "t", game: "g" })
  assert.equal(href, "/competitions/c?tab=stats&view=teams&club=t&game=g")
  assert.equal(placeOf(href).game, "g")
})

test("a chosen game stands in no address but that of a team", () => {
  assert.equal(statsHref("c", { part: "teams", game: "g" }), "/competitions/c?tab=stats&view=teams")
  assert.equal(statsHref("c", { hero: star, game: "g" }), "/competitions/c?tab=stats&hero=star")
  assert.equal(placeOf("/competitions/c?tab=stats&view=teams&game=g").game, null)
  assert.equal(placeOf("/competitions/c?tab=stats&hero=star&game=g").game, null)
})

test("another team, another part and another list of a team open without the game chosen before", () => {
  const open = placeOf(statsHref("c", { part: "teams", team: "t", game: "g" }))
  assert.equal(placeOf(statsHref("c", { part: open.part, team: "u" })).game, null)
  assert.equal(placeOf(statsHref("c", { part: "highlights" })).game, null)
  assert.equal(placeOf(statsHref("c", { part: open.part, team: "t", list: "games" })).game, null)
})

test("a question opens the games with everything it asks", () => {
  const href = statsHref("c", { question: { pick: [star], won: true, max: 9 }, sort: "short" })
  assert.equal(href, "/competitions/c?tab=stats&view=games&pick=star&result=win&max=9&sort=short")
})

test("the order games come in anyway is not named in the address", () => {
  assert.equal(
    statsHref("c", { hero: star, list: "picks", sort: "new" }),
    "/competitions/c?tab=stats&hero=star&list=picks",
  )
})

test("the period counted goes along", () => {
  assert.equal(placeOf(statsHref("c", { part: "heroes", scope: "GROUP.2" })).scope, "GROUP.2")
})

test("the tab owns every key its addresses write", () => {
  const href = statsHref("c", {
    part: "teams",
    team: "t",
    game: "g",
    list: "games",
    scope: "GROUP",
  })
  for (const key of new URL(href, "http://x").searchParams.keys())
    assert.equal(key === "tab" || STATS_KEYS.includes(key), true, key)
})
