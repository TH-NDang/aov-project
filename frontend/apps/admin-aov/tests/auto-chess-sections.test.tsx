import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { before, test } from "node:test"
import { act, useState, type ComponentType } from "react"
import type { GuideContent } from "../src/features/game-modes/game-mode-api"
import type { GuideManifest } from "../src/features/game-modes/game-mode-import"
import { answerConfirm, button, click, QuietResizeObserver, render, type, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

// The rich-text fields ask for the reference catalog; it answers nothing, which they show as an empty catalog.
const backend = fakeBackend(sessionRoutes({ capabilities: ["gamemode:write"] }))
withDom({
  url: "http://localhost/game-modes/mode-1",
  globals: () => ({ fetch: backend.fetch, ResizeObserver: QuietResizeObserver }),
})
before(signIn)

const { MemoryRouter } = await import("react-router")

const sections = {
  ...(await import("../src/features/game-modes/auto-chess/units-section")),
  ...(await import("../src/features/game-modes/auto-chess/traits-section")),
  ...(await import("../src/features/game-modes/auto-chess/items-section")),
  ...(await import("../src/features/game-modes/auto-chess/blessings-section")),
  ...(await import("../src/features/game-modes/auto-chess/quests-section")),
  ...(await import("../src/features/game-modes/auto-chess/lineups-section")),
}
type SectionProps = import("../src/features/game-modes/auto-chess/guide-model").SectionProps
const { guideContentFromManifest } = await import("../src/features/game-modes/game-mode-import")

// The small encyclopedia sample: 2 traits, 3 units, 1 item group with 2 items, 1 blessing, 1 quest, 1 lineup.
const manifest = JSON.parse(
  readFileSync(new URL("./fixtures/game-modes/bach-khoa.json", import.meta.url), "utf8"),
) as GuideManifest
const sample = () => guideContentFromManifest(manifest, new Map())

/** Draws one section over a draft held in state, as the editor does, and hands back the latest draft. */
async function edit(Section: ComponentType<SectionProps>) {
  const draft = { current: sample() }
  function Host() {
    const [content, setContent] = useState<GuideContent>(draft.current)
    return (
      <Section
        content={content}
        saved={null}
        setContent={(next: GuideContent) => {
          draft.current = next
          setContent(next)
        }}
        image={() => undefined}
        upload={async () => "uploaded"}
      />
    )
  }
  const view = await render(<Host />, { wrap: (node) => <MemoryRouter>{node}</MemoryRouter> })
  return Object.assign(draft, { unmount: view.unmount })
}

const heading = () => document.querySelector("h2")?.textContent?.replace(/\s+/g, " ").trim()
const detailTitle = () => document.querySelectorAll("h2")[1]?.textContent?.trim()
const row = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("li > button")].find((entry) => entry.textContent?.includes(name))

test("the units list groups the pieces by cost and the one picked opens beside it", async () => {
  const draft = await edit(sections.UnitsSection)

  assert.equal(heading(), `Quân cờ ${draft.current.units.length}`)
  const [first, second] = draft.current.units
  assert.equal(detailTitle(), first!.name, "the first piece opens first")
  await click(row(second!.name), "second unit row")
  assert.equal(detailTitle(), second!.name)
  assert.equal(row(second!.name)?.getAttribute("aria-current"), "true")
})

test("adding a unit appends an empty piece and opens it", async () => {
  const draft = await edit(sections.UnitsSection)
  const before = draft.current.units.length

  await click(button("Thêm"), "add button")

  assert.equal(draft.current.units.length, before + 1)
  assert.deepEqual(draft.current.units.at(-1), {
    code: "",
    name: "",
    cost: 1,
    traitCodes: [],
    complete: false,
    skill: null,
    stats: null,
    portraitAssetId: null,
  })
  assert.equal(detailTitle(), "Quân cờ mới")
})

test("renaming a new unit names its code too, and a cost moves it to that cost group", async () => {
  const draft = await edit(sections.UnitsSection)
  await click(button("Thêm"), "add button")
  const name = [...document.querySelectorAll<HTMLLabelElement>("label")]
    .find((label) => label.textContent?.trim() === "Tên")!
    .querySelector("input")!

  await type(name, "Tướng Mới")
  await click(
    [...document.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Giá"] button')].find(
      (entry) => entry.textContent === "4",
    ),
    "cost 4",
  )

  const unit = draft.current.units.at(-1)!
  assert.equal(unit.name, "Tướng Mới")
  assert.equal(unit.code, "tuong-moi", "an unsaved code follows the name")
  assert.equal(unit.cost, 4)
  assert.match(document.body.textContent ?? "", /4 vàng/)
})

test("the list search keeps only the entries whose name holds the words, accents aside", async () => {
  const draft = await edit(sections.UnitsSection)
  const [first] = draft.current.units
  const search = document.querySelector<HTMLInputElement>('input[placeholder="Tìm…"]')!

  await type(
    search,
    first!.name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase(),
  )

  await waitFor(() => document.querySelectorAll("li > button").length === 1, "One row stays")
  assert.ok(row(first!.name))
})

test("the traits, items and blessings lists each add an entry of their own kind", async () => {
  const kinds = [
    [sections.TraitsSection, "Phe/Nghề", (content: GuideContent) => content.traits.length],
    [sections.ItemsSection, "Trang bị", (content: GuideContent) => content.items.length],
    [sections.BlessingsSection, "Chúc phúc", (content: GuideContent) => content.blessings.length],
  ] as const
  for (const [Section, title, count] of kinds) {
    const draft = await edit(Section)
    const before = count(draft.current)
    assert.equal(heading(), `${title} ${before}`)

    await click(button("Thêm"), `add ${title}`)

    assert.equal(count(draft.current), before + 1, title)
    await draft.unmount()
  }
})

test("the quests list adds a quest at the end", async () => {
  const draft = await edit(sections.QuestsSection as ComponentType<SectionProps>)
  const before = draft.current.quests.length

  await click(button("Thêm nhiệm vụ"), "add quest")

  assert.equal(draft.current.quests.length, before + 1)
})

test("the lineups list opens the first lineup on its board and adds a new one", async () => {
  const draft = await edit(sections.LineupsSection as ComponentType<SectionProps>)
  const before = draft.current.lineups.length
  assert.equal(heading(), `Đội hình đề xuất ${before}`)
  assert.equal(detailTitle(), draft.current.lineups[0]!.name)
  assert.match(document.body.textContent ?? "", /Bàn cờ/)

  await click(button("Thêm"), "add lineup")

  assert.equal(draft.current.lineups.length, before + 1)
})

test("deleting the open entry asks first and keeps it when refused", async () => {
  const draft = await edit(sections.TraitsSection)
  const before = draft.current.traits.length
  const menu = document.querySelector<HTMLButtonElement>('button[aria-label="Tùy chọn khác"]')
  assert.ok(menu, "the entry has its options menu")
  const open = async () => {
    await act(async () => {
      menu!.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    await waitFor(() => document.querySelector('[role="menuitem"]'), "The menu opens")
    const remove = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === "Xóa",
    )
    await click(remove, "delete item")
  }

  await open()
  await answerConfirm("Hủy")
  assert.equal(draft.current.traits.length, before)

  await open()
  await answerConfirm("Xóa")
  assert.equal(draft.current.traits.length, before - 1)
})
