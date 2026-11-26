import assert from "node:assert/strict"
import { test } from "node:test"
import { asksForNewPage, noteRelease, type GoneFile } from "../src/lib/gone-file.ts"

const gone = (how: Partial<GoneFile> = {}): GoneFile => ({
  waited: true,
  again: false,
  watched: false,
  online: true,
  ...how,
})

test("a file a reader waits for loads the page anew", () => {
  assert.equal(asksForNewPage(gone()), true)
})

test("a file asked for ahead of its need leaves the page as it is", () => {
  assert.equal(asksForNewPage(gone({ waited: false })), false)
})

test("without a network the page that is there stays", () => {
  assert.equal(asksForNewPage(gone({ online: false })), false)
  assert.equal(asksForNewPage(gone({ online: false, again: true })), false)
})

test("a page whose video is open is loaded anew only for a reader who asks again", () => {
  assert.equal(asksForNewPage(gone({ watched: true })), false)
  assert.equal(asksForNewPage(gone({ watched: true, again: true })), true)
})

test("a tab loads the page anew once for a release", () => {
  const kept = noteRelease(null, "one.js")
  assert.ok(kept)
  assert.equal(noteRelease(kept, "one.js"), null)
})

test("a tab that comes from one release to another and back does not go round", () => {
  const first = noteRelease(null, "one.js")
  const second = noteRelease(first, "two.js")
  assert.ok(second)
  assert.equal(noteRelease(second, "one.js"), null)
  assert.equal(noteRelease(second, "two.js"), null)
})

test("what another version of the app kept is passed over", () => {
  for (const kept of ["", "not json", "null", "{}", "7", '"one.js"']) assert.ok(noteRelease(kept, "one.js"))
})
