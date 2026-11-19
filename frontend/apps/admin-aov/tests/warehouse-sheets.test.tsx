import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { withWarehouseUi } from "./fixtures/warehouse-ui"

test("order popup compares peers, retains the proposed order on failure and saves only after confirmation", async () => {
  await withWarehouseUi(async ({ document, render, click }) => {
    const { WarehouseOrderPicker } =
      await import("../src/features/warehouse/components/secondary/warehouse-order-picker")
    const original = ["First", "Second", "Third"].map((name) => ({ id: name, name, iconAssetId: null }))
    const calls: string[][] = []
    await render(
      <WarehouseOrderPicker
        label="Thứ tự các hệ"
        items={original}
        onSave={async (ids) => {
          calls.push(ids)
          if (calls.length === 1) throw new Error("A peer has changed. Reload and retry.")
        }}
      />,
    )
    await click("Thứ tự các hệ")
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.equal(calls.length, 0)
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đưa Second lên"]')!.click())
    assert.deepEqual(
      [...document.querySelectorAll("ol li")].map((row) =>
        row.querySelector('[aria-label^="Kéo "]')?.getAttribute("aria-label"),
      ),
      ["Kéo Second", "Kéo First", "Kéo Third"],
    )
    await click("Lưu thứ tự")
    assert.deepEqual(calls[0], ["Second", "First", "Third"])
    assert.ok(document.querySelector('[role="alert"]')?.textContent?.includes("A peer has changed"))
    assert.ok(document.querySelector('[role="dialog"]'))
    await click("Lưu thứ tự")
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.deepEqual(
      original.map((item) => item.id),
      ["First", "Second", "Third"],
    )
  })
})

test("branch editor replaces numeric ordering with the peer popup and hides suitability without dropping translations", async () => {
  await withWarehouseUi(async ({ document, render, click }) => {
    const { EnchantmentBranchEditor } =
      await import("../src/features/warehouse/components/secondary/enchantment-branch-editor")
    const branch = {
      code: "forest",
      version: 1,
      displayOrder: 0,
      iconAssetId: null,
      backgroundAssetId: null,
      color: null,
      translations: [{ locale: "vi-VN", name: "Forest", description: "Description", suitability: "Keep legacy value" }],
    }
    await render(
      <EnchantmentBranchEditor
        branch={branch}
        branches={[branch]}
        locale="vi-VN"
        onClose={() => {}}
        onSave={async () => {}}
        onReorderBranches={async () => {}}
      />,
    )
    assert.equal(
      [...document.querySelectorAll("label")].some((node) => node.textContent?.includes("Thứ tự hiển thị")),
      false,
    )
    await click("Thứ tự các hệ")
    assert.ok(document.querySelector('ol[aria-label="Thứ tự các hệ"]'))
    await click("Hủy")
    await act(async () => {
      const tab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((node) =>
        node.textContent?.includes("Bản dịch"),
      )!
      tab.dispatchEvent(new document.defaultView!.MouseEvent("mousedown", { button: 0, bubbles: true }))
      tab.click()
    })
    assert.equal(document.body.textContent?.includes("Vai trò phù hợp"), false)
    assert.equal(branch.translations[0].suitability, "Keep legacy value")
  })
})

test("warehouse sheets fork or resume a draft only from their single pencil and open it editing", async () => {
  await withWarehouseUi(async ({ document, render, click }) => {
    const window = document.defaultView!
    const { SecondaryEditor } = await import("../src/features/warehouse/components/secondary/secondary-editor")
    const { newSecondaryContent } = await import("../src/features/warehouse/model/secondary-content")
    const calls: string[] = []
    const props = {
      kind: "enchantments" as const,
      code: "sung-man",
      content: newSecondaryContent("enchantments", "vi-VN", "tower"),
      branches: [],
      locale: "vi-VN",
      isNew: false,
      rulesetId: "standard",
      onClose() {},
      onSave: async () => {},
    }
    const create = async (draft: { cause: string }) => {
      calls.push("fork:" + draft.cause)
    }
    // The pencil on a published version opens a menu; nothing starts until a choice is made.
    const openMenu = async (label: string) =>
      act(async () => {
        document
          .querySelector(`button[aria-label="${label}"]`)!
          .dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
      })
    const choose = async (text: string) =>
      act(async () => {
        ;[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
          .find((item) => item.textContent?.includes(text))!
          .click()
      })
    await render(<SecondaryEditor {...props} readOnly onCreateDraft={create} />)
    assert.deepEqual<string[]>(calls, [])
    assert.equal(document.querySelector('button[aria-label="Hệ phù hiệu"]'), null)
    await openMenu("Tạo nháp và sửa phù hiệu")
    assert.deepEqual<string[]>(calls, [])
    assert.ok(document.body.textContent?.includes("Cập nhật theo patch"))
    await choose("Sửa nội dung")
    await render(
      <SecondaryEditor
        {...props}
        readOnly
        onCreateDraft={create}
        onOpenDraft={(section) => calls.push("open:" + section)}
        openDraftNo={4}
      />,
    )
    await openMenu("Mở nháp và sửa phù hiệu")
    await choose("Mở bản nháp #4")
    assert.deepEqual(calls, ["fork:CONTENT_CORRECTION", "open:mechanics"])
    await render(<SecondaryEditor key="draft" {...props} initialSection="translations" />)
    assert.equal(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(), "Nội dung")
    assert.equal(document.querySelector<HTMLInputElement>("input")?.disabled, false)
    // One pencil for the whole page, already pressed because the draft opened editing.
    assert.equal(document.querySelector('button[aria-label="Xem lại phù hiệu"]')?.getAttribute("aria-pressed"), "true")
    assert.equal(document.querySelector('button[aria-label^="Sửa "]'), null)
    await render(
      <SecondaryEditor key="arcana" {...props} kind="arcana" content={newSecondaryContent("arcana", "vi-VN")} />,
    )
    await click("Sửa ngọc")
    await click("Thêm chỉ số")
    assert.equal(document.querySelectorAll('#secondary-section-stats input[type="number"]').length, 1)
    await click("Xem lại ngọc")
    assert.equal(document.querySelectorAll('input[type="number"]').length, 0)
    await render(<SecondaryEditor key="restricted" {...props} readOnly />)
    assert.equal(document.querySelector('button[aria-label*="sửa"]'), null)
  })
})

test("descriptions join lines wrapped by the game's text box and keep stat, effect and sentence breaks", async () => {
  const { joinWrappedLines } = await import("../src/features/warehouse/components/sheet/warehouse-sheet")
  assert.equal(
    joinWrappedLines("Sát thương gây ra cho\ntướng địch tăng 3% nhưng\nsát thương phải chịu cũng tăng"),
    "Sát thương gây ra cho tướng địch tăng 3% nhưng sát thương phải chịu cũng tăng",
  )
  const item = "+40 Công vật lý\n+20% Tốc đánh\n\nKích hoạt - Vô hình: lập tức tàng hình.\n(Hồi chiêu: 75 giây)"
  assert.equal(joinWrappedLines(item), item)
  assert.equal(joinWrappedLines("Kết thúc câu.\nmở đầu câu mới"), "Kết thúc câu.\nmở đầu câu mới")
})
