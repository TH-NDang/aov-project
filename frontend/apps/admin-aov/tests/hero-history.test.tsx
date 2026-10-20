import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture, fixturePreviousRevision } from "./fixtures/hero-workspace-data"
import type { Revision } from "../src/features/publishing/types"

test("hero history distinguishes baseline from changes and preserves the selected comparison", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero/fixture-hero" })
  const fixture = createHeroFixture(false, true)
  const unexpected: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).includes("/admin/items?"))
      return Response.json({ items: [], page: 0, size: 100, totalElements: 0 })
    try {
      return await fixture.fetcher(input, init)
    } catch (failure) {
      unexpected.push(String(input))
      throw failure
    }
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroRevisionHistory } = await import("../src/features/publishing/hero-revision-history")
  const { DescriptionComparison } = await import("../src/features/publishing/hero-comparison-view")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document
  const opened: Revision[] = []
  const current = fixture.revision
  const otherRuleset = { ...fixturePreviousRevision, id: "fixture-other-ruleset", revisionNo: 9, rulesetId: "other" }
  const discarded: Revision = { ...fixturePreviousRevision, id: "fixture-discarded", revisionNo: 8, state: "DISCARDED" }
  const render = async (revision = current, disabled = false) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <HeroRevisionHistory
              heroId={current.heroId}
              revision={revision}
              revisions={[current, fixturePreviousRevision, otherRuleset, discarded]}
              locale="vi-VN"
              content={fixture.content}
              onOpenRevision={(value) => opened.push(value)}
              disabled={disabled}
            />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 150 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), "Expected hero comparison state was not reached")
  }
  const choose = async (select: HTMLSelectElement, value: string) =>
    act(async () => {
      select.value = value
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
  const click = async (button: HTMLButtonElement) => act(async () => button.click())
  const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === label)!
  const sourceSelect = () => document.querySelector<HTMLSelectElement>("label select")!
  try {
    for (const [before, after] of [
      ["Sát thương 120 (+50% công phép).\nLàm chậm 1 giây.", "Sát thương 150 (+60% công phép).\nLàm chậm 1,5 giây."],
      ["Giữ nguyên.", "Giữ nguyên. Thêm lá chắn."],
      ["Giữ nguyên. Bỏ lá chắn.", "Giữ nguyên."],
    ]) {
      await act(async () => root.render(<DescriptionComparison before={before} after={after} mode="split" />))
      const previous = document.querySelector('[data-description-side="before"]')!
      const current = document.querySelector('[data-description-side="after"]')!
      assert.equal(previous.textContent, before)
      assert.equal(current.textContent, after)
      assert.equal(previous.querySelector("ins"), null)
      assert.equal(current.querySelector("del"), null)
      assert.ok(previous.querySelector("del") || current.querySelector("ins"))
    }
    await act(async () =>
      root.render(<DescriptionComparison before="<b>Giữ nguyên</b>" after="<i>Giữ nguyên</i>" mode="split" />),
    )
    assert.equal(document.querySelector('[data-description-side="before"] strong')?.textContent, "Giữ nguyên")
    assert.equal(document.querySelector('[data-description-side="after"] em')?.textContent, "Giữ nguyên")
    assert.equal(document.querySelector("del, ins"), null)
    await verifySession()
    await render()
    await waitFor(() => document.body.textContent!.includes("Chưa đủ dữ liệu để xác định phần thay đổi"))
    assert.equal(document.querySelectorAll("article").length, 0)
    assert.equal(document.querySelector('[aria-label="Lọc phần thay đổi"]'), null)
    assert.deepEqual(fixture.comparisonRequests, [{ revisionId: current.id, fromRevisionId: null }])
    assert.deepEqual(
      [...sourceSelect().options].map((option) => option.value),
      ["", fixturePreviousRevision.id],
    )
    assert.equal(document.querySelector('button[aria-label="Mở phiên bản 9"]'), null)
    assert.equal(document.querySelector('button[aria-label="Mở phiên bản 8"]'), null)

    await choose(sourceSelect(), fixturePreviousRevision.id)
    await waitFor(() => document.querySelectorAll("article").length === 2)
    assert.equal(fixture.comparisonRequests.at(-1)!.fromRevisionId, fixturePreviousRevision.id)
    assert.equal(document.querySelector("del")?.textContent, "280")
    assert.equal(document.querySelector("ins")?.textContent, "300")
    const numeric = [...document.querySelectorAll("article")].find((item) => item.textContent!.includes("+200"))!
    assert.match(numeric.textContent!, /3\.300/)
    assert.match(numeric.textContent!, /3\.500/)
    assert.ok(![...document.querySelectorAll("article h4")].some((item) => item.textContent!.includes("Thông tin")))
    const filter = document.querySelector<HTMLSelectElement>('[aria-label="Lọc phần thay đổi"]')!
    assert.deepEqual(
      [...filter.options].map((option) => option.value),
      ["", "skills", "combatStats"],
    )

    await choose(filter, "skills")
    assert.equal(document.querySelectorAll("article").length, 1)
    await click(button("Hai cột"))
    const beforeDescription = document.querySelector('[data-description-side="before"]')!
    const afterDescription = document.querySelector('[data-description-side="after"]')!
    assert.equal(beforeDescription.querySelector("del")?.textContent, "280")
    assert.equal(beforeDescription.querySelector("ins"), null)
    assert.equal(afterDescription.querySelector("ins")?.textContent, "300")
    assert.equal(afterDescription.querySelector("del"), null)
    assert.match(document.querySelector("article")!.textContent!, /Gây 280 sát thương vật lý/)
    assert.match(document.querySelector("article")!.textContent!, /Gây 300 sát thương vật lý/)
    assert.equal(sourceSelect().value, fixturePreviousRevision.id)
    assert.equal(fixture.comparisonRequests.length, 2)

    await render({ ...current, version: current.version + 1 })
    await waitFor(() => fixture.comparisonRequests.length === 3 && document.querySelectorAll("article").length === 1)
    assert.equal(sourceSelect().value, fixturePreviousRevision.id)
    assert.equal(fixture.comparisonRequests.at(-1)!.fromRevisionId, fixturePreviousRevision.id)
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Mở phiên bản 1"]')!)
    assert.deepEqual(opened, [fixturePreviousRevision])

    await render({ ...current, version: current.version + 1 }, true)
    const open = document.querySelector<HTMLButtonElement>('button[aria-label="Mở phiên bản 1"]')!
    assert.equal(open.disabled, true)
    await click(open)
    assert.equal(opened.length, 1)

    await render(fixturePreviousRevision)
    await waitFor(() => document.body.textContent!.includes("Chưa đủ dữ liệu để xác định phần thay đổi"))
    assert.equal(sourceSelect().value, "")
    assert.deepEqual(fixture.comparisonRequests.at(-1), {
      revisionId: fixturePreviousRevision.id,
      fromRevisionId: null,
    })
    assert.equal(document.querySelectorAll("article").length, 0)
    assert.deepEqual(unexpected, [])
    assert.equal(fixture.writes.length, 0)
  } finally {
    await act(async () => root.unmount())
    await logout()
    client.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
