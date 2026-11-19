import assert from "node:assert/strict"
import { test } from "node:test"
import { ownerCandidate, primarySource, sourceGap, sourceOrigin } from "../src/features/media/model/media-source-gaps"

const placeholder = { type: "OTHER", label: "", unverified: true }

test("a placeholder for a version without a source reads as unverified although its label is empty", () => {
  assert.equal(sourceGap([placeholder]), "unverified")
  assert.equal(sourceOrigin(placeholder), "Chưa xác minh nguồn")
})

test("a source counts by its unverified flag, not by the words of its label", () => {
  const recorded = { type: "COMMUNITY", label: "Chưa xác minh tác giả gốc", unverified: false }

  assert.equal(sourceGap([recorded]), "missing-owner")
  assert.equal(ownerCandidate([placeholder, recorded]), recorded)
  assert.equal(sourceOrigin(recorded), "Chưa xác minh tác giả gốc")
})

test("an older unverified row keeps out of the shown source whatever its label says", () => {
  const older = { type: "OTHER", label: "Chưa xác minh nguồn", ownerName: "Garena", unverified: true }

  assert.equal(sourceGap([older]), "unverified")
  assert.equal(primarySource([older]), undefined)
})
