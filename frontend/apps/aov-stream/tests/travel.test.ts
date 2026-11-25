import assert from "node:assert/strict"
import { test } from "node:test"
import { entryKey, landsAtTop, opensPart, placeMemory, searchesAnew, wayOf, type Step } from "../src/lib/travel.ts"

const step = (extra: Partial<Step>): Step => ({ action: "PUSH", delta: 1, from: "/", to: "/explore", ...extra })

test("opening a page goes in, and opening what is above it goes out", () => {
  assert.equal(wayOf(step({ from: "/competitions", to: "/competitions/a" })), "in")
  assert.equal(wayOf(step({ from: "/matches/m", to: "/games/g" })), "in")
  assert.equal(wayOf(step({ from: "/competitions/a/matches/m", to: "/competitions/a" })), "out")
  assert.equal(wayOf(step({ from: "/teams/t", to: "/explore" })), "out")
})

test("pages that stand beside each other are entered", () => {
  assert.equal(wayOf(step({ from: "/teams/t", to: "/competitions/a" })), "in")
})

test("going back goes out and going forward goes in", () => {
  assert.equal(wayOf(step({ action: "POP", delta: -1, from: "/competitions/a", to: "/" })), "out")
  assert.equal(wayOf(step({ action: "POP", delta: 1, from: "/", to: "/competitions/a" })), "in")
})

test("a change of the address within a page, and a redirect, stay", () => {
  assert.equal(wayOf(step({ from: "/explore", to: "/explore" })), "stay")
  assert.equal(wayOf(step({ action: "REPLACE", from: "/teams/t", to: "/pages/t" })), "stay")
})

test("a page is opened at its top, also through a redirect, and a page gone back to is not", () => {
  assert.equal(landsAtTop(step({ from: "/", to: "/competitions/a" })), true)
  assert.equal(landsAtTop(step({ action: "REPLACE", from: "/teams/t", to: "/pages/t" })), true)
  assert.equal(landsAtTop(step({ from: "/explore", to: "/explore" })), false)
  assert.equal(landsAtTop(step({ action: "POP", delta: -1, from: "/competitions/a", to: "/" })), false)
})

test("another tab of the page is another part of it, and a filter is not", () => {
  const within = step({ from: "/competitions/a", to: "/competitions/a" })

  assert.equal(opensPart(within, "", "?tab=stats"), true)
  assert.equal(opensPart(within, "?tab=stats", "?tab=stats&hero=h"), true)
  assert.equal(opensPart(within, "?tab=matches", "?tab=matches&team=t"), false)
  assert.equal(opensPart({ ...within, action: "POP" }, "", "?tab=stats"), false)
})

test("a search made again starts anew, and typing that replaces the address does not", () => {
  const within = step({ from: "/explore", to: "/explore" })

  assert.equal(searchesAnew(within, "?q=a", "?q=b"), true)
  assert.equal(searchesAnew({ ...within, action: "REPLACE" }, "?q=a", "?q=b"), false)
  assert.equal(searchesAnew(within, "?q=a", "?q=a&kind=TEAM"), false)
})

test("the first entry of a visit is known by its address", () => {
  assert.equal(entryKey({ key: "default", pathname: "/explore", search: "?kind=TEAM" }), "first:/explore?kind=TEAM")
  assert.equal(entryKey({ key: "x1", pathname: "/explore", search: "" }), "x1")
})

test("places are kept over a reload, the newest of them", () => {
  const memory = placeMemory()
  for (let at = 0; at < 100; at++) memory.remember(`k${at}`, at)
  memory.remember("k50", 5000)
  const reloaded = placeMemory(memory.save())

  assert.deepEqual([reloaded.recall("k0"), reloaded.recall("k50"), reloaded.recall("k99")], [undefined, 5000, 99])
})

test("what cannot be read is forgotten", () => {
  assert.equal(placeMemory("{broken").recall("a"), undefined)
  assert.equal(placeMemory('[["a","b"],["c",3]]').recall("c"), 3)
})
