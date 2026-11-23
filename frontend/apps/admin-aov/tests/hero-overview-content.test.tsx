import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { fixtureContent } from "./fixtures/hero-workspace-data"
import { withView } from "./fixtures/hero-skills-view"

test("hero overview shows the hero's positions and five-point ratings without changing stored content", async () => {
  await withView(async ({ document, render, click }) => {
    const { HeroContent } = await import("../src/features/publishing/components/workspace/hero-content")
    const content = structuredClone(fixtureContent)
    content.PROFILE!.translations[0].summary = "Giới thiệu dài cần giữ đầy đủ khi người xem mở rộng. ".repeat(10)
    Object.assign(content.OVERVIEW_RATINGS!, { survivability: null })
    content.PROFILE!.positions = ["TOP", "JUNGLE"]
    const original = JSON.stringify(content)
    await render(
      <MemoryRouter>
        <HeroContent content={content} locale="vi-VN" editable={false} busy={false} onEdit={() => {}} />
      </MemoryRouter>,
    )
    const role = document.querySelector('[aria-label="Vai trò: Sát thủ"]')!
    assert.equal(role.querySelector("img"), null)
    assert.equal(role.querySelector("svg")!.getAttribute("fill"), "currentColor")
    const position = document.querySelector('[aria-label="Vị trí đi: Đi rừng"]')!
    assert.equal(position.querySelector("img"), null)
    assert.equal(position.querySelector("svg")!.getAttribute("fill"), "currentColor")
    assert.equal(position.querySelector("svg")!.getAttribute("aria-hidden"), "true")
    assert.match(document.body.textContent!, /3\.5\/5/)
    assert.match(document.body.textContent!, /4\/5/)
    assert.match(document.body.textContent!, /Sinh tồnChưa có/)
    assert.doesNotMatch(document.body.textContent!, /\/10/)
    const expand = document.querySelector<HTMLButtonElement>('button[aria-controls][aria-expanded="false"]')!
    assert.ok(expand)
    await click(expand)
    assert.equal(expand.getAttribute("aria-expanded"), "true")
    assert.equal(
      document.getElementById(expand.getAttribute("aria-controls")!)!.textContent,
      content.PROFILE!.translations[0].summary,
    )
    // The lore waits behind one icon on the hero card and opens in its own window.
    assert.equal(document.querySelector("[role=dialog]"), null)
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Đọc cốt truyện"]')!)
    assert.ok(
      document.querySelector("[role=dialog]")?.textContent?.includes(content.PROFILE!.translations[0].lore!),
      "The lore opens in its own window",
    )
    assert.equal(JSON.stringify(content), original)
    const withoutLore = structuredClone(content)
    withoutLore.PROFILE!.translations[0].lore = null
    await render(
      <MemoryRouter>
        <HeroContent content={withoutLore} locale="vi-VN" editable={false} busy={false} onEdit={() => {}} />
      </MemoryRouter>,
    )
    assert.equal(document.querySelector('button[aria-label="Đọc cốt truyện"]'), null)
    assert.equal(document.querySelector('button[aria-label^="Cốt truyện"]'), null)
  })
})

test("five-point rating edits preserve stored scale, fractional values, zero and missing input", async () => {
  await withView(async ({ dom, document, render }) => {
    const { SectionEditor } = await import("../src/features/publishing/components/editing/section-editor")
    let value = structuredClone(fixtureContent.OVERVIEW_RATINGS!)
    const mount = () =>
      render(
        <SectionEditor
          section="OVERVIEW_RATINGS"
          value={value}
          locale="vi-VN"
          onChange={(next) => {
            value = next as typeof value
          }}
        />,
      )
    await mount()
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="number"]')]
    assert.deepEqual(
      inputs.map((input) => input.value),
      ["2", "3.5", "3", "4"],
    )
    assert.ok(inputs.every((input) => input.max === "5"))
    for (const [display, stored] of [
      ["3.5", 7],
      ["0", 0],
      ["5", 10],
      ["", NaN],
    ] as const) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(inputs[0], display)
        inputs[0].dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
      assert.equal(value.survivability, stored)
      assert.equal(value.scaleCode, "GAME_OVERVIEW_10")
      await mount()
    }
  })
})
