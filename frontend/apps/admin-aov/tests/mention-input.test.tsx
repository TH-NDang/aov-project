import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { createEntityIndex, parseRichText, type EntityKind, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { createReferenceSearchIndex, rankReferenceChoices } from "@aov/ui/lib/entity-rich-text-editor"
import { referenceInputNodes } from "@aov/ui/lib/reference-input-dom"
import { render, withDom } from "./fixtures/dom"
import { fillReferenceInput, referenceInput, referenceInputValue } from "./fixtures/reference-input"

withDom()

const entity = (kind: EntityKind, id: string, name: string, short?: string): EntityReference => ({
  id,
  kind,
  autoMatch: true,
  translations: [{ locale: "vi-VN", name, aliases: [], description: "", shortNames: short ? [short] : [] }],
})
const entities = [
  entity("circuit", "rpl", "RoV Pro League", "RPL"),
  entity("team", "box", "Box Gaming", "BOX"),
  entity("team", "inbox", "Inbox Boys"),
  { ...entity("player", "kaisa", "Kaisa"), teamIds: ["box"] },
]

/** A field in a page, with what it last gave its form and how often it was sent. */
async function field(props: { initial?: string; chat?: boolean } = {}) {
  const { MentionInput } = await import("@aov/ui/components/mention-input")
  const state = { value: props.initial ?? "", sent: 0 }
  function Harness() {
    const [value, setValue] = React.useState(props.initial ?? "")
    return (
      <MentionInput
        label="Bình luận"
        value={value}
        onChange={(next) => {
          state.value = next
          setValue(next)
        }}
        onSubmit={props.chat ? () => (state.sent += 1) : undefined}
        entities={entities}
        locale="vi-VN"
        placeholder="Viết bình luận…"
      />
    )
  }
  await render(<Harness />)
  const type = (text: string) => act(async () => fillReferenceInput(referenceInput(document), text))
  const key = (name: string, extras: KeyboardEventInit = {}) =>
    act(async () => {
      referenceInput(document).dispatchEvent(
        new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...extras }),
      )
    })
  const options = () =>
    [...document.querySelectorAll('[role="option"]')].map((option) => option.querySelector(".font-medium")?.textContent)
  return { state, type, key, options }
}

test("an at sign lists what it can name, the closest first, and Enter puts the choice in the text", async () => {
  const { state, type, key, options } = await field()

  await type("Chúc mừng @box")
  assert.deepEqual(options(), ["Box Gaming", "Inbox Boys"])
  await key("Enter")

  assert.equal(state.value, "Chúc mừng <ref=team:box>Box Gaming</ref> ")
  assert.equal(referenceInputValue(referenceInput(document)), state.value)
  assert.deepEqual(options(), [])
})

test("people of one name are told apart by the team they were with last", async () => {
  await field()
  await act(async () => fillReferenceInput(referenceInput(document), "@kaisa"))

  const option = document.querySelector('[role="option"]')!
  assert.ok(option.textContent?.includes("Tuyển thủ · Box Gaming"))
})

test("a short name finds its record", async () => {
  const { type, options } = await field()

  await type("@rpl")

  assert.deepEqual(options(), ["RoV Pro League"])
})

test("words after an at sign that name nothing leave no list over the text", async () => {
  const { type } = await field()

  await type("@không có ai")

  assert.equal(document.querySelector('[role="listbox"]'), null)
})

test("Escape closes the list and keeps what was typed", async () => {
  const { type, key, options } = await field()
  await type("@kai")
  assert.deepEqual(options(), ["Kaisa"])

  await key("Escape")

  assert.deepEqual(options(), [])
  assert.equal(referenceInputValue(referenceInput(document)), "@kai")
})

test("in a chat Enter sends and Shift with Enter starts a line", async () => {
  const { state, type, key } = await field({ chat: true })
  await type("Trận hay quá")

  await key("Enter", { shiftKey: true })
  assert.equal(state.sent, 0)
  assert.equal(state.value, "Trận hay quá\n")
  await key("Enter")

  assert.equal(state.sent, 1)
})

test("Enter on an open list chooses instead of sending", async () => {
  const { state, type, key } = await field({ chat: true })
  await type("@kai")

  await key("Enter")

  assert.equal(state.sent, 0)
  assert.equal(state.value, "<ref=player:kaisa>Kaisa</ref> ")
})

test("a saved text opens with its mentions in one piece and its other tags as typed", async () => {
  await field({ initial: "<b>Chào</b> <ref=team:box>Box Gaming</ref>" })
  const input = referenceInput(document)

  assert.equal(input.querySelectorAll("[data-reference-token]").length, 1)
  assert.equal(input.querySelector("strong"), null)
  assert.ok(input.textContent?.includes("<b>Chào</b>"))
})

test("what the field writes is what readers see as a link", () => {
  const nodes = parseRichText(
    "Chúc mừng <ref=team:box>Box Gaming</ref> vô địch RPL",
    createEntityIndex(entities, "vi-VN", "vi-VN", { scope: "all" }),
    { markup: "references" },
  )

  assert.deepEqual(
    nodes.flatMap((node) => (node.type === "reference" ? [node.entity.id] : [])),
    ["box", "rpl"],
  )
})

test("without formatting a text has references and nothing else", () => {
  assert.deepEqual(
    referenceInputNodes("<b>a</b><ref=team:box>Box</ref>", false).map((node) => node.type),
    ["text", "reference"],
  )
})

test("an empty search keeps the order of names", () => {
  const choices = createReferenceSearchIndex(entities, "vi-VN", "vi-VN")

  assert.equal(rankReferenceChoices(choices, ""), choices)
})
