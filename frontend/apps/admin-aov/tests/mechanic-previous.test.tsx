import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { RecordedChange } from "../src/features/publishing/components/patch-changes/patch-change-lines"
import { createWindow, installWindow } from "./fixtures/dom"

const rework = (previous: unknown): RecordedChange => ({
  id: "mechanic-1",
  type: "HERO_MECHANIC_CHANGE",
  changeKind: "REWORK",
  mechanicKey: "Chiêu 3",
  description: "Tụ lực rồi phóng ba làn sóng.",
  previous,
})

test("a mechanic change reads before and after with its source, and records the earlier text only where allowed", async () => {
  const dom = createWindow("http://localhost")
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window)
  const { ChangeLines } = await import("../src/features/publishing/components/patch-changes/patch-change-lines")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const client = new QueryClient()
  const render = (change: RecordedChange, canRecordPrevious: boolean) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <ChangeLines changes={[change]} locale="vi-VN" changeSetId="set-1" canRecordPrevious={canRecordPrevious} />
        </QueryClientProvider>,
      ),
    )
  const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(label))
  try {
    await render(
      rework({
        description: "Đứng tụ lực rồi tung chiêu theo hướng chỉ định.",
        sourceUrl: "https://liquipedia.net/honorofkings/index.php?title=Preyta&oldid=390402",
        recordedAt: "2026-11-12T03:00:00Z",
      }),
      true,
    )
    const text = document.body.textContent ?? ""
    assert.match(text, /TrướcĐứng tụ lực rồi tung chiêu theo hướng chỉ định\. Nguồn: liquipedia\.net/)
    assert.match(text, /SauTụ lực rồi phóng ba làn sóng\./)
    assert.equal(
      document.querySelector<HTMLAnchorElement>("a[href*='oldid=390402']")?.getAttribute("rel"),
      "noreferrer",
    )
    // Recorded once and never edited: no way to write it again.
    assert.equal(button("Ghi mô tả trước khi đổi"), undefined)

    await render(rework(null), false)
    assert.equal(button("Ghi mô tả trước khi đổi"), undefined)
    assert.doesNotMatch(document.body.textContent ?? "", /Trước/)

    await render(rework(null), true)
    await act(async () => button("Ghi mô tả trước khi đổi")!.click())
    const form = document.querySelector<HTMLFormElement>('form[aria-label="Mô tả trước khi đổi"]')!
    const field = (selector: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
    const type = (element: HTMLInputElement | HTMLTextAreaElement, value: string) =>
      act(async () => {
        const prototype = Object.getPrototypeOf(element)
        Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value)
        element.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
    await type(field("textarea"), "Bản cũ")
    await type(field("input"), "ftp://example.org")
    await act(async () => form.requestSubmit())
    assert.equal(
      form.querySelector('[role="alert"]')?.textContent,
      "Liên kết nguồn phải bắt đầu bằng http:// hoặc https://.",
    )
  } finally {
    await act(async () => root.unmount())
    restoreGlobals()
  }
})
