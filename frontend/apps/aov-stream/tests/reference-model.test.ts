import assert from "node:assert/strict"
import { test } from "node:test"
import { firstLine, mayNamePeople, pageReferenceKey, plainReferences } from "../src/lib/reference-model.ts"

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
