import assert from "node:assert/strict"
import { test } from "node:test"
import "fake-indexeddb/auto"
import { JSDOM } from "jsdom"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import { draftKey, draftRepository } from "../src/app/drafts/draft-store"
import type { PublicationOverview } from "../src/features/publishing/api/publication-overview"
import { installWindow, waitFor } from "./fixtures/dom"

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
        capabilities: ["catalog:read", "patch:write", "patch:publish"],
      })
    if (String(input).endsWith("/admin/seasons/season/schedules")) {
      scheduleWrites.push(JSON.parse(String(init?.body)))
      return Response.json({})
    }
    if (String(input).endsWith("/admin/patch-variants/patch/releases")) {
      scheduleWrites.push(JSON.parse(String(init?.body)))
      return Response.json({ id: "new-release" })
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
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window, {
    FormData: dom.window.FormData,
    fetch: fetcher,
  })
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { SeasonSetup } = await import("../src/features/publishing/components/setup/season-setup")
  const { ScheduleForm } = await import("../src/features/publishing/components/setup/shared-version-setup")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const mount = () =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            {showSchedule ? (
              <ScheduleForm endpoint="/admin/seasons/season/schedules" data={scheduleData} seasonId="season" />
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
        .find((button) => button.textContent?.includes("Thiết lập lịch mùa"))!
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
    const { MarketSchedule } = await import("../src/features/publishing/components/setup/market-schedule")
    const marketData: PublicationOverview = {
      ...scheduleData,
      markets: scheduleData.markets.map((m) => ({ ...m, currentRulesetId: "shared" })),
      seasons: [{ id: "season", code: "s4", displayName: "S4", ordinal: 4 }],
      variants: [
        {
          id: "patch",
          patchId: "patch",
          seasonId: "season",
          rulesetId: "shared",
          rulesetOrdinal: 2,
          patchCode: "October",
          status: "PUBLISHED",
        },
      ],
    }
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            <MarketSchedule marketId="vn" data={marketData} locale="vi-VN" onClose={() => {}} />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    assert.equal(dom.window.document.querySelector("select"), null, "A single patch is already selected")
    const day = () => dom.window.document.querySelector<HTMLInputElement>('[aria-label="Ngày phát hành"]')!
    await waitFor(() => !!day() && !day().closest("fieldset")!.disabled)
    assert.equal(dom.window.document.querySelector('[aria-label="Thị trường"]'), null)
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(day(), "30/10/2026")
      day().dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    await act(async () => {
      day().form!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
    })
    await waitFor(() => scheduleWrites.length === 2)
    assert.deepEqual(scheduleWrites[1], {
      regionId: "vn",
      seasonId: "season",
      effectiveOn: "2026-10-30",
      effectiveAt: null,
      sourceUrl: null,
    })
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            <MarketSchedule
              data={marketData}
              marketId="th"
              initialMode="season"
              suggestedSeason={marketData.seasons[0]}
              suggestedPatch={marketData.variants[0]}
              onClose={() => {}}
              locale="vi-VN"
            />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    const button = (label: string) =>
      [...dom.window.document.querySelectorAll("button")].find((node) => node.textContent?.trim() === label)
    assert.ok(dom.window.document.querySelector('[role="dialog"] img[src="/images/flags/th.svg"]'))
    assert.ok(dom.window.document.querySelector('[aria-label="Bắt đầu mùa"]'))
    await act(async () => button("Patch áp dụng")!.click())
    assert.equal(scheduleWrites.length, 2, "Selecting a market alone must not apply a patch")
    await act(async () => button("Đặt October làm patch hiện tại")!.click())
    await waitFor(() => scheduleWrites.length === 3)
    const applied = scheduleWrites[2] as { regionId: string; seasonId: string; effectiveAt: string }
    assert.equal(applied.regionId, "th")
    assert.equal(applied.seasonId, "season")
    assert.ok(Math.abs(Date.now() - Date.parse(applied.effectiveAt)) < 60000)
    const locked = {
      ...marketData,
      markets: marketData.markets.map((m) => ({ ...m, available: false, currentRulesetId: null })),
    }
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            <MarketSchedule marketId="th" data={locked} initialMode="patch" locale="vi-VN" onClose={() => {}} />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => !!day() && !day().closest("fieldset")!.disabled)
    assert.equal(button("Đặt October làm patch hiện tại"), undefined)
    assert.equal(button("Thêm giờ"), undefined)
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(day(), "02/11/2026")
      day().dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    await act(async () =>
      day().form!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    )
    await waitFor(() => scheduleWrites.length === 4)
    assert.deepEqual(scheduleWrites[3], {
      regionId: "th",
      seasonId: "season",
      effectiveOn: "2026-11-02",
      effectiveAt: null,
      sourceUrl: null,
    })
  } finally {
    await act(async () => root.unmount())
    for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.remove(key)
    await logout()
    cache.clear()
    dom.window.close()
    restoreGlobals()
  }
})
