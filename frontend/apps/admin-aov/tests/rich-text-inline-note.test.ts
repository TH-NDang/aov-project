import assert from "node:assert/strict"
import { test } from "node:test"
import { createEntityIndex, parseRichText } from "@aov/ui/lib/entity-rich-text"
import { referenceFormatState, selectsPartOfLine, toggleReferenceFormat } from "@aov/ui/lib/reference-input-formatting"
import { referenceInputPlainText } from "@aov/ui/lib/reference-input-dom"
import { colorsUsedIn } from "@aov/ui/lib/rich-text-blocks"

const select = (value: string, words: string) => {
  const start = value.indexOf(words)
  return { start, end: start + words.length }
}

test("faded text stays inside its sentence, unlike a note paragraph", () => {
  const text = "Gây 100 (tối đa 5 lần) sát thương"
  const next = toggleReferenceFormat(text, select(text, "(tối đa 5 lần)"), "muted")!
  assert.equal(next.value, "Gây 100 <muted>(tối đa 5 lần)</muted> sát thương")
  assert.equal(referenceInputPlainText(next.value), text)

  const nodes = parseRichText(next.value, createEntityIndex([], "vi-VN", "vi-VN"), { autoRecognize: false })
  assert.deepEqual(
    nodes.map((node) => node.type),
    ["text", "muted", "text"],
  )
})

test("pressing it again removes the fade, and the state follows the selection", () => {
  const text = "Gây <muted>nhạt</muted> xong"
  const range = select(text, "nhạt")
  assert.equal(referenceFormatState(text, range).muted, true)
  assert.equal(toggleReferenceFormat(text, range, "muted")!.value, "Gây nhạt xong")
})

test("a fade and a color replace each other instead of piling up", () => {
  const text = "Làm chậm mục tiêu"
  const colored = toggleReferenceFormat(text, select(text, "Làm chậm"), "color", "#c36a84")!
  const faded = toggleReferenceFormat(colored.value, select(colored.value, "Làm chậm"), "muted")!
  assert.equal(faded.value, "<muted>Làm chậm</muted> mục tiêu")
  const recolored = toggleReferenceFormat(faded.value, select(faded.value, "Làm chậm"), "color", "#5aadc9")!
  assert.equal(recolored.value, "<color=#5aadc9>Làm chậm</color> mục tiêu")
})

test("clearing removes looks but keeps references out of reach and paragraphs in place", () => {
  const text = "<note>Một <b>đậm</b> <color=#5aadc9>màu</color> <muted>nhạt</muted></note>"
  const range = { start: text.indexOf("Một"), end: text.indexOf("</muted>") }
  assert.equal(toggleReferenceFormat(text, range, "plain")!.value, "<note>Một đậm màu nhạt</note>")
})

test("a note chosen on part of a line belongs in the sentence, on a whole line it stays its own paragraph", () => {
  const text = "Dòng một có chú thích\nDòng hai"
  assert.equal(selectsPartOfLine(text, select(text, "chú thích")), true)
  assert.equal(selectsPartOfLine(text, select(text, "Dòng một có chú thích")), false)
  assert.equal(selectsPartOfLine(text, select(text, "Dòng hai")), false)
  assert.equal(selectsPartOfLine(text, { start: 3, end: 3 }), false)
  assert.equal(selectsPartOfLine(text, select(text, "thích\nDòng")), false)
  const formatted = "<b>Cả</b> dòng"
  assert.equal(selectsPartOfLine(formatted, { start: 3, end: formatted.length }), false, "tags are not words")
})

test("colors already in a text are offered most used first", () => {
  assert.deepEqual(
    colorsUsedIn("<color=#AA6AD8>a</color><color=#5aadc9>b</color><color=#5aadc9>c</color><color=#abc>d</color>"),
    ["#5aadc9", "#aa6ad8"],
  )
})
