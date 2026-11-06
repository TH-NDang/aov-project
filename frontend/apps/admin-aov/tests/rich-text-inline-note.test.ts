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

test("a skill number followed by seconds is an amount of time, not that skill", () => {
  const index = createEntityIndex(
    [1, 2, 3, 4].map((slot) => ({
      kind: "term" as const,
      id: `skill-${slot}`,
      translations: [{ locale: "vi-VN", name: `Chiêu ${slot}`, aliases: [], description: "" }],
    })),
    "vi-VN",
    "vi-VN",
  )
  const references = (text: string) =>
    parseRichText(text, index).flatMap((node) => (node.type === "reference" ? [node.label] : []))

  for (const slot of [1, 2, 3, 4]) {
    assert.deepEqual(references(`giảm hồi tất cả chiêu ${slot} giây`), [], `chiêu ${slot} giây`)
    assert.deepEqual(references(`Chiêu ${slot} gây sát thương`), [`Chiêu ${slot}`])
  }
  assert.deepEqual(references("giảm hồi chiêu 1.5 giây"), [])
  assert.deepEqual(references("giảm hồi chiêu 3 s"), [])
  assert.deepEqual(references("dùng chiêu 3, sau 2 giây"), ["chiêu 3"], "seconds further along change nothing")
  assert.deepEqual(references("trúng Chiêu 2 giây sau"), [], "the words right after the number decide")
})

test("a skill's later form can be written as a phase, a variant or a form, and the bare slot stays unresolved", () => {
  const heroId = "11111111-1111-4111-8111-111111111111"
  const owner = {
    id: heroId,
    kind: "hero" as const,
    translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "" }],
  }
  const skill = (variantNo: number) => ({
    id: `${heroId}.skill-2-${variantNo}`,
    kind: "skill" as const,
    heroId,
    owner,
    revisionId: "22222222-2222-4222-8222-222222222222",
    skillKey: `skill-2-${variantNo}`,
    sourceSlot: 2,
    variantNo,
    autoMatch: true,
    translations: [{ locale: "vi-VN", name: `Dạng ${variantNo}`, aliases: [], description: "" }],
  })
  const index = createEntityIndex([owner, skill(1), skill(2)], "vi-VN", "vi-VN")
  const found = (text: string) =>
    parseRichText(text, index).flatMap((node) =>
      node.type === "reference" ? [`${node.label} > ${node.entity.id}`] : [],
    )
  const second = `${heroId}.skill-2-2`

  for (const words of ["chiêu 2 giai đoạn 2", "Chiêu 2 biến thể 2", "chiêu 2 dạng 2"])
    assert.deepEqual(found(`Kích hoạt ${words} ngay`), [`${words} > ${second}`])
  assert.deepEqual(found("chiêu 2 giai đoạn 1"), [`chiêu 2 giai đoạn 1 > ${heroId}.skill-2-1`])
  assert.deepEqual(found("dùng chiêu 2 rồi"), [], "the bare slot could be either form")
  assert.deepEqual(found("chiêu 2 giai đoạn 3"), [], "a form this hero does not have names nothing")
  assert.deepEqual(found("Airi chiêu 2 dạng 2"), [`Airi chiêu 2 dạng 2 > ${second}`], "the owner may come first")
  assert.deepEqual(found("chiêu 2 biến thể 2 của Airi"), [`chiêu 2 biến thể 2 của Airi > ${second}`])
})

test("a phase of a skill stored as one entry leaves the reference on the slot alone", () => {
  const heroId = "33333333-3333-4333-8333-333333333333"
  const owner = {
    id: heroId,
    kind: "hero" as const,
    translations: [{ locale: "vi-VN", name: "Aoi", aliases: [], description: "" }],
  }
  const index = createEntityIndex(
    [
      owner,
      {
        id: `${heroId}.skill-2-1`,
        kind: "skill" as const,
        heroId,
        owner,
        revisionId: "44444444-4444-4444-8444-444444444444",
        skillKey: "skill-2-1",
        sourceSlot: 2,
        variantNo: 1,
        autoMatch: true,
        translations: [{ locale: "vi-VN", name: "Long trảo", aliases: [], description: "" }],
      },
    ],
    "vi-VN",
    "vi-VN",
  )
  const found = (text: string) =>
    parseRichText(text, index).flatMap((node) =>
      node.type === "reference" ? [`${node.label} > ${node.entity.kind}`] : [],
    )

  assert.deepEqual(found("Trạng thái phi hành: Kích hoạt chiêu 2 giai đoạn 2."), ["chiêu 2 > skill"])
  assert.deepEqual(found("chiêu 2 biến thể 2"), ["chiêu 2 > skill"])
  assert.deepEqual(found("Aoi chiêu 2 giai đoạn 2"), ["Aoi chiêu 2 > skill"])
  assert.deepEqual(found("giảm hồi chiêu 2 giây"), [], "seconds still win")
})

test("colors already in a text are offered most used first", () => {
  assert.deepEqual(
    colorsUsedIn("<color=#AA6AD8>a</color><color=#5aadc9>b</color><color=#5aadc9>c</color><color=#abc>d</color>"),
    ["#5aadc9", "#aa6ad8"],
  )
})
