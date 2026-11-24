import assert from "node:assert/strict"
import test from "node:test"

import { addressResolver, communityReferences, previewKind, wikiReferences } from "../src/lib/running-text-names.ts"

const circuit = {
  id: "c1",
  kind: "CIRCUIT",
  name: "RoV Pro League",
  shortName: "RPL",
  path: "/pages/rpl",
}
const season = {
  id: "s1",
  kind: "COMPETITION",
  name: "RoV Pro League 2026 Summer",
  path: "/competitions/s1",
  circuitId: "c1",
}
const team = { id: "t1", kind: "TEAM", name: "Box Gaming", shortName: "BOX", path: "/pages/box-gaming" }
const player = { id: "p1", kind: "PLAYER", name: "Kaisa", path: "/players/p1", teamIds: ["t1"] }

const named = (references, id) => references.find((entity) => entity.id === id)

test("a record opens the address community-service gives it", () => {
  const references = communityReferences([circuit, team])

  assert.equal(named(references, "c1").kind, "circuit")
  assert.deepEqual(named(references, "t1").destinations, { stream: "/pages/box-gaming" })
  assert.deepEqual(named(references, "t1").translations[0].shortNames, ["BOX"])
})

test("a season also goes by its circuit's short name", () => {
  const references = communityReferences([circuit, season])

  assert.deepEqual(named(references, "s1").translations[0].aliases, ["RPL 2026 Summer"])
})

test("a season whose name does not open with its circuit has no such name", () => {
  const promotion = { ...season, name: "Vòng thăng hạng RoV Pro League" }

  assert.deepEqual(named(communityReferences([circuit, promotion]), "s1").translations[0].aliases, [])
})

test("a player carries the teams that tell their name from a common word", () => {
  assert.deepEqual(named(communityReferences([player]), "p1").teamIds, ["t1"])
})

const entry = (kind, id, autoMatch) => ({
  id,
  kind,
  autoMatch,
  translations: [{ locale: "vi-VN", name: id, aliases: [], description: "" }],
})

test("game entries open on the Wiki, and terms stay words", () => {
  const references = wikiReferences(
    [entry("hero", "h1", true), entry("item", "i1", false), entry("term", "giap", true)],
    [{ code: "auto-chess", name: "Cờ Liên quân" }],
    { wikiUrl: "https://athahub.com", locale: "vi-VN" },
  )

  assert.deepEqual(
    references.map((entity) => entity.destinations?.stream),
    ["https://athahub.com/hero/h1", "https://athahub.com/warehouse/items/i1", "https://athahub.com/modes/auto-chess"],
  )
})

test("a hero an editor keeps out of recognition stays out, an item follows the rules of its name", () => {
  const [hero, item] = wikiReferences([entry("hero", "h1", false), entry("item", "i1", false)], [], {
    wikiUrl: "https://athahub.com/",
    locale: "en-US",
  })

  assert.equal(hero.autoMatch, false)
  assert.equal(item.autoMatch, true)
  assert.equal(hero.destinations?.stream, "https://athahub.com/hero/h1?locale=en-US")
})

test("an address of one of our pages is found however it is written", () => {
  const resolve = addressResolver(
    [
      ...communityReferences([circuit, team, season]),
      ...wikiReferences([entry("hero", "h1", true)], [], { wikiUrl: "https://athahub.com", locale: "vi-VN" }),
    ],
    "https://athahub.com/stream/",
  )

  assert.equal(resolve("https://athahub.com/stream/pages/rpl"), "circuit:c1")
  assert.equal(resolve("athahub.com/stream/pages/rpl/?tab=history#top"), "circuit:c1")
  assert.equal(resolve("http://www.athahub.com/stream/competitions/s1"), "competition:s1")
  assert.equal(resolve("https://athahub.com/hero/h1"), "hero:h1")
})

test("a record with a page is also found by the address it has without one", () => {
  const resolve = addressResolver(communityReferences([circuit, team]), "https://athahub.com/stream")

  assert.equal(resolve("https://athahub.com/stream/teams/t1"), "team:t1")
  assert.equal(resolve("https://athahub.com/stream/pages/c1"), "circuit:c1")
})

test("other sites and other pages of ours are no records", () => {
  const resolve = addressResolver(communityReferences([circuit]), "https://athahub.com/stream")

  assert.equal(resolve("https://example.com/stream/pages/rpl"), undefined)
  assert.equal(resolve("https://athahub.com/stream/competitions?tab=schedule"), undefined)
  assert.equal(resolve("https://%"), undefined)
})

test("game entries have no preview in community-service", () => {
  assert.equal(previewKind("hero"), undefined)
  assert.equal(previewKind("person"), "PERSON")
})
