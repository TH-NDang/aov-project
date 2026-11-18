import assert from "node:assert/strict"
import { test } from "node:test"
import { importFieldLabel, relationFieldLabel } from "../src/features/publishing/model/import/import-labels"

test("a hero import field is named from its key", () => {
  assert.equal(importFieldLabel("roles"), "Vai trò (mảng JSON)")
  assert.equal(importFieldLabel("portrait"), "Ảnh chân dung")
})

test("a field the server lists before Admin knows it shows its key", () => {
  assert.equal(importFieldLabel("voiceLines"), "voiceLines")
  assert.equal(relationFieldLabel("skins", "voiceLines"), "voiceLines")
})

test("a skill and a skin field with the same key keep their own names", () => {
  assert.equal(relationFieldLabel("skills", "name"), "Tên kỹ năng")
  assert.equal(relationFieldLabel("skins", "name"), "Tên trang phục")
})
