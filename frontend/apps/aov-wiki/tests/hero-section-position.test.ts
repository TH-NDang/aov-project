import assert from "node:assert/strict"
import { test } from "node:test"
import { activeSection } from "../src/features/hero/hero-section-position.ts"

const at = (id: string, top: number) => ({ id, top })

test("the active section is the last one that has passed the reading line", () => {
  const sections = [at("changes", -400), at("skills", 60), at("skins", 900)]
  assert.equal(activeSection(sections, 120, false), "skills")
})

test("the first section stays active before any section reaches the line", () => {
  assert.equal(activeSection([at("changes", 300), at("skills", 900)], 120, false), "changes")
})

test("sections above the page's main column stop being active once the reader has moved past them", () => {
  const sections = [at("overview", -900), at("stats", -700), at("changes", -300), at("skills", 90), at("skins", 700)]
  assert.equal(activeSection(sections, 120, false), "skills")
})

test("the end of the page selects the last section", () => {
  assert.equal(activeSection([at("skills", 20), at("history", 500)], 120, true), "history")
})

test("a page with no sections has no active section", () => {
  assert.equal(activeSection([], 120, false), undefined)
  assert.equal(activeSection([], 120, true), undefined)
})
