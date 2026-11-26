import assert from "node:assert/strict"
import { test } from "node:test"
import { heroNamed, searchHeroes } from "../src/features/esports/model/hero-search"

const hero = (name: string, code = name.toLowerCase()) => ({ id: code, code, name })
const names = (list: { name: string }[]) => list.map(({ name }) => name)

test("a name that begins with the text comes before one of its words, then before a name that holds it", () => {
  const heroes = [hero("Elsu"), hero("Triệu Vân"), hero("Yena"), hero("Vân Nương"), hero("Silvan")]
  assert.deepEqual(names(searchHeroes(heroes, "van")), ["Vân Nương", "Triệu Vân", "Silvan"])
})

test("equal answers keep the order they came in", () => {
  const heroes = [hero("Airi"), hero("Alice"), hero("Aoi"), hero("Annette")]
  assert.deepEqual(names(searchHeroes(heroes, "a")), ["Airi", "Alice", "Aoi", "Annette"])
})

test("accents, spaces, apostrophes and capitals of a typed name do not matter", () => {
  const heroes = [hero("Điêu Thuyền"), hero("Eland’orr"), hero("Y’bneth")]
  assert.deepEqual(names(searchHeroes(heroes, "dieut")), ["Điêu Thuyền"])
  assert.deepEqual(names(searchHeroes(heroes, "điêu thuyền")), ["Điêu Thuyền"])
  assert.deepEqual(names(searchHeroes(heroes, "ELAND ORR")), ["Eland’orr"])
  assert.deepEqual(names(searchHeroes(heroes, "ybn")), ["Y’bneth"])
})

test("a code finds its hero after every name that answers", () => {
  const heroes = [hero("Richter", "riktor"), hero("Rikka")]
  assert.deepEqual(names(searchHeroes(heroes, "rik")), ["Rikka", "Richter"])
})

test("without a text every hero is listed as given", () => {
  const heroes = [hero("Zip"), hero("Airi")]
  assert.equal(searchHeroes(heroes, "  "), heroes)
})

test("a hero is named only by its whole name or code", () => {
  const heroes = [hero("Florentino"), hero("Flowborn Pháp sư", "flowborn-mid")]
  assert.equal(heroNamed(heroes, "florentino")?.name, "Florentino")
  assert.equal(heroNamed(heroes, "Flowborn mid")?.name, "Flowborn Pháp sư")
  assert.equal(heroNamed(heroes, "flo"), null)
  assert.equal(heroNamed(heroes, ""), null)
})
