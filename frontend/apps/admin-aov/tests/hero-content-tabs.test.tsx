import assert from "node:assert/strict"
import { test } from "node:test"
import { heroContentSectionId, heroContentTabs } from "../src/features/publishing/hero-content-tabs"

test("a saved hero shows every content part in reading order, a new one has no videos yet", () => {
  assert.deepEqual(heroContentTabs(true), ["overview", "skills", "evaluation", "skins", "media", "videos"])
  assert.deepEqual(heroContentTabs(false), ["overview", "skills", "evaluation", "skins", "media"])
})

test("each content part has the element id that links and the tab address land on", () => {
  assert.deepEqual(
    heroContentTabs(true).map(heroContentSectionId),
    ["overview", "skills", "evaluation", "skins", "media", "videos"].map((tab) => `hero-content-${tab}`),
  )
})
