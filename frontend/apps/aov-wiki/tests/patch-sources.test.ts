import assert from "node:assert/strict"
import { test } from "node:test"
import { patchSourceLinks, preferredPatchSource, sourceName } from "../src/lib/patch-sources.ts"

const vietnamese = { url: "https://lienquan.garena.vn/patch", label: "Tiếng Việt", locale: "vi-VN" }
const thai = { url: "https://rov.in.th/patch", label: "Thái Lan", locale: "th-TH" }

test("a patch cites its labelled links in the order they were written", () => {
  assert.deepEqual(patchSourceLinks([thai, vietnamese], "https://example.org/hero"), [thai, vietnamese])
})

test("a patch without links of its own cites the page its changes were recorded from", () => {
  assert.deepEqual(patchSourceLinks([], "https://example.org/hero"), [
    { url: "https://example.org/hero", label: "", locale: null },
  ])
  assert.deepEqual(patchSourceLinks(undefined, null), [])
})

test("an address that is not a web page is left out", () => {
  assert.deepEqual(patchSourceLinks([{ ...thai, url: "javascript:alert(1)" }, vietnamese], null), [vietnamese])
})

test("a link without a label is named by its site", () => {
  assert.equal(sourceName(thai), "Thái Lan")
  assert.equal(sourceName({ url: "https://lienquan.garena.vn/a", label: " ", locale: null }), "lienquan.garena.vn")
})

test("a hero's change cites the patch page in the reader's language, else the patch's first page", () => {
  const english = { url: "https://example.org/en", label: "English", locale: "en-US" }
  assert.equal(preferredPatchSource([thai, vietnamese], "vi-VN"), vietnamese)
  assert.equal(preferredPatchSource([thai, english], "en"), english)
  assert.equal(preferredPatchSource([thai, vietnamese], "id-ID"), thai)
  assert.equal(preferredPatchSource([], "vi-VN"), undefined)
})
