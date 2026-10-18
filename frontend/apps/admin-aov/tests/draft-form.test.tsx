import assert from "node:assert/strict"
import { test } from "node:test"
import "fake-indexeddb/auto"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import { draftKey, draftRepository } from "../src/app/drafts/draft-store"
import type { PublicationOverview } from "../src/features/publishing/publication-overview"

test("season forms restore invalid input and saving one market preserves another market's draft", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/game-configuration" })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const fixture = createHeroFixture()
  const scheduleWrites: unknown[] = []
  const scheduleData: PublicationOverview = {
    asOf: "2026-10-18T00:00:00Z",
    assignments: [],
    rulesets: [],
    seasons: [],
    variants: [],
    releases: [],
    seasonSchedules: [],
    markets: ["vn", "th"].map((id) => ({
      id,
      code: id.toUpperCase(),
      displayName: id,
      available: true,
      currentRulesetId: null,
      currentSeasonId: null,
      currentReleaseId: null,
    })),
  }
  let showSchedule = false
  let failed = true
  let saved = 0
  let request: unknown
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/admin/me"))
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        displayName: "Editor",
        capabilities: ["catalog:read", "patch:write"],
      })
    if (String(input).endsWith("/admin/seasons/season/schedules")) {
      scheduleWrites.push(JSON.parse(String(init?.body)))
      return Response.json({})
    }
    if (String(input).endsWith("/admin/seasons")) {
      if (init?.method === "POST") {
        request = JSON.parse(String(init.body))
        return failed
          ? Response.json({ detail: "Storage unavailable" }, { status: 503 })
          : Response.json({ id: "new-season" })
      }
      return Response.json([])
    }
    return fixture.fetcher(input, init)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    DocumentFragment: dom.window.DocumentFragment,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    Event: dom.window.Event,
    FormData: dom.window.FormData,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    fetch: fetcher,
    BroadcastChannel: undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { SeasonSetup } = await import("../src/features/publishing/season-setup")
  const { SeasonScheduleForm } = await import("../src/features/publishing/shared-version-setup")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const mount = () =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            {showSchedule ? (
              <SeasonScheduleForm seasonId="season" data={scheduleData} />
            ) : (
              <SeasonSetup onDone={() => saved++} />
            )}
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
  const input = (name: string) => dom.window.document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
  const type = (name: string, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input(name), value)
      input(name).dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 200 && !check(); i++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(check(), "Expected draft form state was not reached")
  }
  try {
    await verifySession()
    await mount()
    await waitFor(() => !!input("code") && !input("code").closest("fieldset")!.disabled)
    await type("code", "2026-s5")
    await type("displayName", "Mùa đang nhập")
    await type("year", "20")
    await act(async () => {
      for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.flush(key)
      root.render(null)
    })
    draftRepository.store.setState({ slots: {} })
    await mount()
    await waitFor(() => input("displayName")?.value === "Mùa đang nhập")
    assert.equal(input("year").value, "20", "Invalid input must remain recoverable")
    assert.equal(saved, 0)
    await type("year", "2026")
    await act(async () => {
      const discard = [...dom.window.document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Bỏ bản nháp"),
      )!
      assert.equal(discard.type, "button")
      discard.click()
    })
    await act(async () => {
      const keep = [...dom.window.document.querySelectorAll("button")].find(
        (button) => button.textContent === "Giữ lại",
      )!
      assert.equal(keep.type, "button")
      keep.click()
    })
    assert.equal(request, undefined, "Draft actions must never submit the enclosing form")
    assert.equal(input("code").value, "2026-s5")
    await act(async () =>
      dom.window.document
        .querySelector("form")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    )
    await waitFor(() => !!dom.window.document.querySelector('[role="alert"]'))
    assert.equal(saved, 0)
    assert.equal(input("code").value, "2026-s5")
    assert.ok(Object.values(draftRepository.store.getState().slots).some((slot) => slot.record))
    failed = false
    await act(async () =>
      dom.window.document
        .querySelector("form")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    )
    await waitFor(() => saved === 1)
    assert.deepEqual(request, {
      code: "2026-s5",
      displayName: "Mùa đang nhập",
      seasonYear: 2026,
      seasonNumber: null,
      beforeSeasonId: null,
    })
    assert.ok(Object.values(draftRepository.store.getState().slots).every((slot) => !slot.record))
    await act(async () => root.render(null))
    const scheduleKey = draftKey("fixture", "editor", "schedule:/admin/seasons/season/schedules")
    draftRepository.put(
      scheduleKey,
      { regionId: "", dates: {}, sources: {} },
      {
        regionId: "th",
        dates: {
          "vn:start": { text: "10/09/2026", withTime: false, time: "" },
          "th:start": { text: "15/09/2026", withTime: false, time: "" },
        },
        sources: {},
      },
      null,
    )
    await draftRepository.flush(scheduleKey)
    draftRepository.store.setState({ slots: {} })
    showSchedule = true
    await mount()
    await act(async () =>
      [...dom.window.document.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Thiết lập lịch thị trường"))!
        .click(),
    )
    await waitFor(
      () => dom.window.document.querySelector<HTMLInputElement>('[aria-label="Bắt đầu mùa"]')?.value === "15/09/2026",
    )
    await act(async () =>
      dom.window.document
        .querySelector("form")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    )
    await waitFor(() => scheduleWrites.length === 1 && !dom.window.document.querySelector("form"))
    assert.deepEqual(scheduleWrites[0], {
      regionId: "th",
      startsAt: null,
      startsOn: "2026-09-15",
      endsAt: null,
      endsOn: null,
    })
    const retained = draftRepository.slot(scheduleKey).record!
    assert.equal((retained.value as { dates: Record<string, { text: string }> }).dates["vn:start"].text, "10/09/2026")
    assert.equal((retained.base as { dates: Record<string, { text: string }> }).dates["vn:start"], undefined)
    assert.ok(retained, "Saving Thailand must not discard the unsaved Vietnam schedule")
  } finally {
    await act(async () => root.unmount())
    for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.remove(key)
    await logout()
    cache.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
