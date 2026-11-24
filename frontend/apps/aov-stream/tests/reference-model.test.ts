import assert from "node:assert/strict"
import { test } from "node:test"
import type { ReferenceName } from "@aov/community-contracts"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import {
  addressResolver,
  communityReferences,
  firstLine,
  mayNamePeople,
  pageReferenceKey,
  plainReferences,
  previewKind,
  wikiReferences,
} from "../src/lib/reference-model.ts"

const circuit: ReferenceName = {
  id: "c1",
  kind: "CIRCUIT",
  name: "RoV Pro League",
  shortName: "RPL",
  path: "/pages/rpl",
}
const season: ReferenceName = {
  id: "s1",
  kind: "COMPETITION",
  name: "RoV Pro League 2026 Summer",
  path: "/competitions/s1",
  circuitId: "c1",
}
const team: ReferenceName = { id: "t1", kind: "TEAM", name: "Box Gaming", shortName: "BOX", path: "/pages/box-gaming" }
const player: ReferenceName = { id: "p1", kind: "PLAYER", name: "Kaisa", path: "/players/p1", teamIds: ["t1"] }

const named = (references: EntityReference[], id: string) => references.find((entity) => entity.id === id)!

test("a record opens the address community-service gives it", () => {
  const references = communityReferences([circuit, team])

  assert.equal(named(references, "c1").kind, "circuit")
  assert.deepEqual(named(references, "t1").destinations, { stream: "/pages/box-gaming" })
  assert.deepEqual(named(references, "t1").translations[0]!.shortNames, ["BOX"])
})

test("a season also goes by its circuit's short name", () => {
  const references = communityReferences([circuit, season])

  assert.deepEqual(named(references, "s1").translations[0]!.aliases, ["RPL 2026 Summer"])
})

test("a season whose name does not open with its circuit has no such name", () => {
  const promotion = { ...season, name: "Vòng thăng hạng RoV Pro League" }

  assert.deepEqual(named(communityReferences([circuit, promotion]), "s1").translations[0]!.aliases, [])
})

test("a player carries the teams that tell their name from a common word", () => {
  assert.deepEqual(named(communityReferences([player]), "p1").teamIds, ["t1"])
})

const entry = (kind: EntityReference["kind"], id: string, autoMatch: boolean): EntityReference => ({
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

  assert.equal(hero!.autoMatch, false)
  assert.equal(item!.autoMatch, true)
  assert.equal(hero!.destinations?.stream, "https://athahub.com/hero/h1?locale=en-US")
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

test("a page is the team or player it stands for, or itself", () => {
  assert.equal(pageReferenceKey({ kind: "TEAM", id: "page", entityId: "t1" }), "team:t1")
  assert.equal(pageReferenceKey({ kind: "CIRCUIT", id: "c1", entityId: null }), "circuit:c1")
  assert.equal(pageReferenceKey({ kind: "PERSON", id: "n1", entityId: null }), "person:n1")
})

test("the names of people are only needed for a text that may hold one", () => {
  const may = (text: string, namesTeam: boolean, about?: string[]) => mayNamePeople(text, text, namesTeam, about)

  assert.equal(may("Giải hạng hai của Thái Lan.", false), false)
  assert.equal(may("Kaisa giành MVP.", true), true)
  assert.equal(may("Theo tuyển thủ này.", false), true)
  assert.equal(may("Kaisa dẫn dắt đội.", false, ["team:t1"]), true)
  assert.equal(may("<ref=player:p1>anh ấy</ref>", false), true)
})

test("a text of a team's name alone needs no names of people", () => {
  assert.equal(mayNamePeople("Box Gaming", " ", true), false)
  assert.equal(mayNamePeople("đội hình Box Gaming", "đội hình  ", true), false)
})

test("a text reads as plain words until its references are known", () => {
  assert.equal(plainReferences("Chúc mừng <ref=team:t1>Box Gaming</ref>!"), "Chúc mừng Box Gaming!")
  assert.equal(plainReferences("<b>đậm</b>"), "<b>đậm</b>")
})

test("the line about a game entry is the first one of its description, without markup", () => {
  assert.equal(firstLine("\n<b>+10%</b> Giảm hồi chiêu\n+200 Giáp"), "+10% Giảm hồi chiêu")
  assert.equal(firstLine(""), undefined)
})

test("game entries have no preview in community-service", () => {
  assert.equal(previewKind("hero"), undefined)
  assert.equal(previewKind("person"), "PERSON")
})
