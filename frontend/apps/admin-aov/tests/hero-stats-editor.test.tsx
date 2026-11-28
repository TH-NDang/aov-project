import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { fixtureContent } from "./fixtures/hero-workspace-data"
import type { StatRule } from "../src/features/publishing/model/assessment/combat-attributes"
import { withView } from "./fixtures/hero-skills-view"

test("armor is typed the way the game shows it and a malformed value cannot be saved", async () => {
  await withView(async ({ document, render, dom }) => {
    const { HeroStatsEditor } = await import("../src/features/publishing/components/editing/hero-stats-editor")
    let stats: NonNullable<typeof fixtureContent.COMBAT_STATS> = {
      values: [
        { statKey: "ARMOR", baseValue: null, growthPerLevel: null, unit: "POINT" },
        { statKey: "HP", baseValue: 3720, percentValue: null, growthPerLevel: null, unit: "HP" },
      ],
      sources: [],
    }
    const mount = () =>
      render(
        <HeroStatsEditor
          value={stats}
          onChange={(v) => {
            stats = v
          }}
        />,
      )
    const type = async (next: string) => {
      const node = document.querySelector<HTMLInputElement>('input[placeholder="150 | 20%"]')!
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, next)
        node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
      await mount()
      return document.querySelector<HTMLInputElement>('input[placeholder="150 | 20%"]')!
    }
    await mount()
    assert.equal(document.querySelectorAll('input[placeholder="150 | 20%"]').length, 1, "HP keeps its number box")
    assert.match(document.body.textContent!, /Gõ đúng như game hiện: số, dấu |, rồi phần trăm/)
    assert.equal(document.querySelectorAll("select").length, 3, "armor has no unit to pick, HP still does")

    let input = await type("150 | 20%")
    assert.deepEqual(stats.values[0], {
      statKey: "ARMOR",
      baseValue: 150,
      percentValue: 20,
      growthPerLevel: null,
      unit: "POINT",
    })
    assert.equal(input.validationMessage, "")
    assert.match(document.body.textContent!, /Đã đọc: số 150, phần trăm 20%/)

    input = await type("150 |")
    assert.equal(stats.values[0].percentValue, 20, "The last good reading stays until the box parses again")
    assert.match(input.validationMessage, /Thiếu phần trăm sau dấu |/)
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /Thiếu phần trăm/)
    assert.equal(input.getAttribute("aria-invalid"), "true")

    input = await type("145")
    assert.equal(stats.values[0].baseValue, 145)
    assert.equal(stats.values[0].percentValue, null)
    assert.equal(input.validationMessage, "")
    assert.match(document.body.textContent!, /chưa có phần trăm/)
  })
})

test("a stat without a percent in the game drops one when the row switches to it", async () => {
  await withView(async ({ document, render, dom }) => {
    const { HeroStatsEditor } = await import("../src/features/publishing/components/editing/hero-stats-editor")
    let stats: NonNullable<typeof fixtureContent.COMBAT_STATS> = {
      values: [{ statKey: "ARMOR", baseValue: 150, percentValue: 20, growthPerLevel: null, unit: "POINT" }],
      sources: [],
    }
    const mount = () =>
      render(
        <HeroStatsEditor
          value={stats}
          onChange={(v) => {
            stats = v
          }}
        />,
      )
    await mount()
    assert.equal(document.querySelector<HTMLInputElement>('input[placeholder="150 | 20%"]')!.value, "150 | 20%")
    const select = document.querySelector("select")!
    await act(async () => {
      select.value = "MOVEMENT_SPEED"
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    assert.equal(stats.values[0].percentValue, null)
    assert.equal(stats.values[0].baseValue, 150)
  })
})

test("a hero can override a shared stat and switch back without storing a copy", async () => {
  await withView(async ({ document, render, click }) => {
    const { HeroStatsEditor } = await import("../src/features/publishing/components/editing/hero-stats-editor")
    const rule: StatRule = {
      statKey: "CRITICAL_DAMAGE",
      baseValue: 200,
      percentValue: null,
      growthPerLevel: null,
      capValue: null,
      unit: "PERCENT",
      sourceUrl: "https://example.com/source",
      version: 1,
    }
    // A stat with only a cap is no value to inherit: each hero keeps its own.
    const capOnly: StatRule = { ...rule, statKey: "MOVEMENT_SPEED", unit: "POINT", baseValue: null, capValue: 800 }
    let stats: NonNullable<typeof fixtureContent.COMBAT_STATS> = { values: [], sources: [] }
    const mount = () =>
      render(
        <HeroStatsEditor
          value={stats}
          rules={[rule, capOnly]}
          onChange={(v) => {
            stats = v
          }}
        />,
      )
    await mount()
    await click(
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Đặt giá trị riêng"))!,
    )
    assert.deepEqual(stats.values, [
      { statKey: "CRITICAL_DAMAGE", baseValue: null, growthPerLevel: null, unit: "PERCENT" },
    ])
    await mount()
    assert.match(document.body.textContent!, /Sát thương chí mạng/)
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Dùng mặc định chung"]')!)
    assert.deepEqual(stats.values, [])
    await mount()
    assert.match(document.body.textContent!, /Mặc định chung.*Sát thương chí mạng 200%.*Đặt giá trị riêng/)
    assert.doesNotMatch(document.body.textContent!, /Tốc chạy/)
  })
})

test("stat choices and calendar inputs preserve unknown data, zero and missing values", async () => {
  await withView(async ({ dom, document, render, click }) => {
    const { SectionEditor } = await import("../src/features/publishing/components/editing/section-editor")
    let value = structuredClone(fixtureContent.COMBAT_STATS!)
    value.values.push({ statKey: "CUSTOM_STAT", baseValue: 17, growthPerLevel: null, unit: "custom-unit" })
    value.sources = [
      {
        label: "Source",
        sourceUrl: null,
        observedAt: "2026-11-01T02:43:10.386Z",
        verificationState: "VERIFIED",
        note: null,
      },
    ]
    const mount = () =>
      render(
        <SectionEditor
          section="COMBAT_STATS"
          value={value}
          locale="vi-VN"
          onChange={(next) => {
            value = next as typeof value
          }}
        />,
      )
    const select = async (node: HTMLSelectElement, next: string) => {
      await act(async () => {
        node.value = next
        node.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
      })
      await mount()
    }
    const type = async (node: HTMLInputElement, next: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, next)
        node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
      await mount()
    }
    await mount()
    assert.doesNotMatch(document.body.textContent!, /BCP 47|ISO 8601|Mã chỉ số \(HP/)
    const choice = document.querySelector<HTMLSelectElement>("select")!
    assert.equal(choice.selectedOptions[0].textContent, "Máu")
    assert.equal(choice.querySelector<HTMLOptionElement>('option[value="ARMOR"]')!.disabled, true)
    await select(choice, "CRITICAL_CHANCE")
    assert.equal(value.values[0].unit, "PERCENT")
    await type(document.querySelector<HTMLInputElement>('input[type="number"]')!, "0")
    assert.equal(value.values[0].baseValue, 0)
    await type(document.querySelector<HTMLInputElement>('input[type="number"]')!, "")
    assert.equal(value.values[0].baseValue, null)
    assert.deepEqual(value.values[2], {
      statKey: "CUSTOM_STAT",
      baseValue: 17,
      growthPerLevel: null,
      unit: "custom-unit",
    })
    const openSources = () => click(document.querySelector<HTMLButtonElement>('[aria-label="Nguồn tham khảo (1)"]')!)
    const applySources = async () => {
      await click(document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')!)
      await mount()
    }
    await openSources()
    assert.equal(
      value.sources[0].observedAt,
      "2026-11-01T02:43:10.386Z",
      "Opening the calendar must not rewrite source precision",
    )
    await type(document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!, "2026-11-04T10:15:00")
    await applySources()
    assert.equal(value.sources[0].observedAt, new Date("2026-11-04T10:15:00").toISOString())
    await openSources()
    await type(document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!, "")
    await applySources()
    assert.equal(value.sources[0].observedAt, null)
  })
})

test("the values every hero shares are edited in a sheet, with the rise per level and the cap", async () => {
  await withView(async ({ document, render, click, dom, fixture, waitFor }) => {
    const { HeroStatsEditor } = await import("../src/features/publishing/components/editing/hero-stats-editor")
    await render(<HeroStatsEditor value={{ values: [], sources: [] }} onChange={() => {}} />)
    await click(
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Sửa mặc định chung"))!,
    )
    await waitFor(() => !!document.querySelector('[data-stat-rule="MOVEMENT_SPEED"]'))
    const movement = document.querySelector('[data-stat-rule="MOVEMENT_SPEED"]')!
    assert.match(movement.textContent!, /Tốc chạy.*Tối đa 800/)
    assert.match(document.querySelector('[data-stat-rule="HP"]')!.textContent!, /Mỗi tướng một giá trị/)

    await click(document.querySelector<HTMLButtonElement>('[aria-label="Sửa mặc định Giảm hồi chiêu"]')!)
    const field = (label: string) =>
      Array.from(document.querySelectorAll("label"))
        .find((node) => node.textContent?.startsWith(label))!
        .querySelector("input")!
    const type = async (label: string, next: string) =>
      act(async () => {
        const node = field(label)
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, next)
        node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
    await type("Cấp 1 (%)", "0")
    await type("Tối đa (%)", "40")
    await click(Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Lưu")!)
    await waitFor(() => fixture.statRuleWrites.length > 0)
    assert.deepEqual(fixture.statRuleWrites[0], {
      key: "COOLDOWN_REDUCTION",
      method: "PUT",
      body: {
        unit: "PERCENT",
        baseValue: 0,
        percentValue: null,
        growthPerLevel: null,
        capValue: 40,
        sourceUrl: null,
        expectedVersion: 0,
      },
    })
  })
})
