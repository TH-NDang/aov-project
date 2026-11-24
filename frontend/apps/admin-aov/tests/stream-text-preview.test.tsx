import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { button, click, render, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json, type Handler } from "./fixtures/network"
import { fillReferenceInput, referenceInput, referenceInputValue } from "./fixtures/reference-input"
import { sessionRoutes, signIn } from "./fixtures/session"

let peopleAnswer = () => json({ items: [] })
const lists: Handler = ({ service, pathname }) => {
  if (service === "community" && pathname === "/references")
    return json({
      items: [
        { id: "aog", kind: "CIRCUIT", name: "Đấu Trường Danh Vọng", shortName: "AOG", path: "/pages/aog" },
        { id: "box", kind: "TEAM", name: "Box Gaming", shortName: "BOX", path: "/teams/box" },
      ],
    })
  if (service === "community" && pathname === "/references/people") return peopleAnswer()
  if (service === "community" && pathname === "/references/CIRCUIT/aog")
    return json({ id: "aog", kind: "CIRCUIT", name: "Đấu Trường Danh Vọng", logoUrl: "https://img.example/aog.png" })
  if (service === "wiki" && pathname === "/reference-catalog") return json({ settings: { entities: [] } })
  if (service === "wiki" && pathname === "/game-modes") return json({ items: [] })
}
const backend = fakeBackend(sessionRoutes(), lists)
withDom({ url: "http://localhost/terminology", globals: () => ({ fetch: backend.fetch }) })

async function preview() {
  await signIn()
  const { ReferencePreviewWorkspace } = await import("../src/features/terminology/reference-preview-workspace")
  function Harness() {
    const [kind, setKind] = React.useState<"GAME" | "STREAM">("STREAM")
    const [texts, setTexts] = React.useState({ GAME: "Sát thương", STREAM: "" })
    return (
      <ReferencePreviewWorkspace
        kind={kind}
        onKindChange={setKind}
        value={texts[kind]}
        onChange={(text) => setTexts((current) => ({ ...current, [kind]: text }))}
        locale="vi-VN"
        onLocaleChange={() => {}}
        entities={[]}
        fallbackLocale="vi-VN"
        autoRecognize
      />
    )
  }
  await render(<Harness />)
  await waitFor(() => !document.body.textContent?.includes("Đang tải danh sách tên"))
  return { write: (text: string) => act(async () => fillReferenceInput(referenceInput(document), text)) }
}

const rows = () =>
  [...document.querySelectorAll<HTMLAnchorElement>('[aria-label="Stream sẽ liên kết"] a')].map((link) => [
    link.querySelector(".type-body")?.textContent,
    new URL(link.href).pathname,
  ])

test("a text for Stream lists the names that become links and where they open", async () => {
  const { write } = await preview()

  await write("AOG gọi tên Box Gaming")

  await waitFor(() => rows().length === 2)
  assert.deepEqual(rows(), [
    ["Đấu Trường Danh Vọng", "/pages/aog"],
    ["Box Gaming", "/teams/box"],
  ])
})

test("a record is listed with its own logo, and with the mark of its kind where it has none", async () => {
  const { write } = await preview()

  await write("AOG gọi tên Box Gaming")

  const logos = () =>
    [...document.querySelectorAll('[aria-label="Stream sẽ liên kết"] li')].map((row) => row.querySelector("img")?.src)
  await waitFor(() => logos()[0])
  assert.deepEqual(logos(), ["https://img.example/aog.png", undefined])
})

test("a name in the wrong letter case says how to write it", async () => {
  const { write } = await preview()

  await write("aog")

  await waitFor(() =>
    document.body.textContent?.includes("Chưa nhận “aog”. Viết “AOG” để liên kết tới Đấu Trường Danh Vọng."),
  )
  assert.deepEqual(rows(), [])
})

test("each kind of text keeps its own, and clearing one brings back that one", async () => {
  const { write } = await preview()
  await write("AOG")
  await click(button("Xóa"))

  await click(button("Văn bản game"))
  assert.equal(referenceInputValue(referenceInput(document)), "Sát thương")
  assert.equal(button("Khôi phục nội dung"), undefined)

  await click(button("Văn bản Stream"))
  await click(button("Khôi phục nội dung"))
  assert.equal(referenceInputValue(referenceInput(document)), "AOG")
})

test("a list that fails says so and still tries the names that came", async () => {
  peopleAnswer = () => json({ code: "INTERNAL_ERROR" }, 500)
  const { write } = await preview()
  await write("AOG")
  await waitFor(() => document.querySelector('[role="alert"]')?.textContent?.includes("Chưa tải đủ danh sách tên"))
  assert.equal(rows().length, 1)

  peopleAnswer = () => json({ items: [] })
  await click(button("Thử lại"))

  await waitFor(() => !document.querySelector('[role="alert"]'))
})
