import assert from "node:assert/strict"
import { test } from "node:test"
import React, { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { DocumentView, TeamContent } from "@aov/community-contracts"

const channel = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel")
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
const { activityLabel, recordReason, regionsNamedBy, tournamentTiming } =
  await import("../src/features/tournaments/record-reason")
const { createTournamentApi, tournamentApi } = await import("../src/features/tournaments/tournament-api")
if (channel) Object.defineProperty(globalThis, "BroadcastChannel", channel)

const NOW = new Date("2026-11-07T05:00:00Z")
const ZONE = "Asia/Ho_Chi_Minh"
const timing = (startsOn?: string, endsOn?: string, status?: "ONGOING" | "FINISHED") =>
  tournamentTiming({ startsOn, endsOn, status }, NOW, ZONE)

test("a tournament says how it stands against today", () => {
  assert.equal(timing("2026-08-29", "2026-11-07", "ONGOING"), "Kết thúc hôm nay")
  assert.equal(timing("2026-10-30", "2026-11-15", "ONGOING"), "Còn 8 ngày")
  assert.equal(timing("2026-11-08", "2026-11-08"), "Bắt đầu ngày mai")
  assert.equal(timing("2026-11-16", "2026-11-17"), "Bắt đầu sau 9 ngày")
  assert.equal(timing("2026-10-19", "2026-11-01", "FINISHED"), "Kết thúc 6 ngày trước")
  assert.equal(timing("2026-10-01", "2026-12-01", "FINISHED"), "", "declared over: no countdown")
  assert.equal(timing("2017-01-08", "2017-01-08", "FINISHED"), "", "too far back to matter")
  assert.equal(timing(undefined, undefined), "", "no date, nothing to say")
})

test("a row says why it sits where it does", () => {
  const row = (extra: Partial<DocumentView<TeamContent>>) =>
    ({ content: { code: "a", name: "A" }, ...extra }) as DocumentView<TeamContent>
  assert.equal(activityLabel(null), "Chưa ghi nhận trận nào")
  assert.match(activityLabel("2019-02-24"), /^Hoạt động 24\/02\/2019$/)
  assert.match(recordReason("teams", row({ lastActiveOn: "2026-10-25", context: "TOURNAMENT" })), /^Trong giải này · /)
  assert.match(recordReason("players", row({ lastActiveOn: "2026-10-25", context: "TEAM" })), /^Từng ở đội này · /)
  assert.equal(recordReason("players", row({})), "Chưa ghi nhận trận nào")
  assert.match(
    recordReason("tournaments", {
      ...row({ context: "PARTICIPANT" }),
      content: { code: "t", name: "T", region: "VN", startsOn: "2026-10-19", endsOn: "2026-11-01" },
    } as never),
    /^Đã tham gia · 19\/10\/2026 – 01\/11\/2026$/,
  )
})

test("typing a place still reaches its tournaments", () => {
  assert.deepEqual(regionsNamedBy(""), [])
  assert.ok(regionsNamedBy("thai").includes("TH"), "accents do not matter")
  assert.ok(regionsNamedBy("VN").includes("VN"), "the code works too")
  assert.deepEqual(regionsNamedBy("không có nơi này"), [])
})

test("lists ask the server for its order and walking a whole list does not pay for it", async () => {
  const seen: URL[] = []
  const api = createTournamentApi(async (path) => {
    seen.push(new URL(path, "http://localhost"))
    return { items: [], totalElements: 0, page: 0, size: 30 } as never
  })

  await api.list("players")
  await api.list("series", undefined, { tournamentId: "event" })
  assert.equal(seen[0].searchParams.get("sort"), "UPDATED", "looking rows up by id needs no ranking")
  assert.equal(seen[1].searchParams.get("sort"), null, "matches have their own order and take no sort")

  await api.pick("players", { q: "sai", teamId: "club", tournamentId: "event", page: 2 })
  const picker = seen[2].searchParams
  assert.equal(seen[2].pathname, "/admin/players")
  assert.equal(picker.get("sort"), null, "a picker takes the default order")
  assert.deepEqual(
    [picker.get("q"), picker.get("teamId"), picker.get("tournamentId"), picker.get("page"), picker.get("size")],
    ["sai", "club", "event", "2", "30"],
  )

  await api.searchTournaments({ q: "", status: "", tier: "A", alsoRegions: ["TH", "VN"], sort: "RECENT", page: 0 })
  const hub = seen[3].searchParams
  assert.equal(hub.get("tier"), "A")
  assert.equal(hub.get("alsoRegions"), "TH,VN")
  assert.equal(hub.get("sort"), "RECENT")
  assert.equal(hub.has("q"), false, "empty filters are left out")
  assert.equal(hub.has("status"), false, "empty filters are left out")

  await api.searchTournaments({ alsoRegions: [] })
  assert.equal(seen[4].searchParams.has("alsoRegions"), false)
})

async function withDom(run: (document: Document, window: JSDOM["window"]) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:5175/tournaments", pretendToBeVisual: true })
  const values = {
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: dom.window.requestAnimationFrame,
    cancelAnimationFrame: dom.window.cancelAnimationFrame,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  try {
    await run(dom.window.document, dom.window)
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (globalThis as Record<string, unknown>)[key]
    }
    dom.window.close()
  }
}

test("the picker shows the server's rows with their reasons, leaves out what is taken and passes its context on", async () => {
  await withDom(async (document, window) => {
    const asked: unknown[] = []
    const pick = tournamentApi.pick
    tournamentApi.pick = (async (_kind: string, filters: unknown) => {
      asked.push(filters)
      return {
        items: [
          {
            id: "ours",
            content: { code: "ours", name: "Đội của giải" },
            lastActiveOn: "2026-10-25",
            context: "TOURNAMENT",
          },
          { id: "taken", content: { code: "taken", name: "Đã thêm" }, lastActiveOn: "2026-11-01" },
          { id: "old", content: { code: "old", name: "Đội cũ" } },
        ],
        totalElements: 3,
        page: 0,
        size: 30,
      }
    }) as never
    const chosen: string[] = []
    // Radix decides at import time whether a document exists, so this comes after the DOM above.
    const { RecordPicker } = await import("../src/features/tournaments/record-picker")
    const { createRoot } = await import("react-dom/client")
    const root = createRoot(document.getElementById("root")!)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    try {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <RecordPicker
              kind="teams"
              value=""
              label="Thêm đội"
              context={{ tournamentId: "event" }}
              exclude={["taken"]}
              onChange={(id) => chosen.push(id)}
            />
          </QueryClientProvider>,
        ),
      )
      assert.equal(asked.length, 0, "nothing loads until the picker is opened")

      const trigger = document.querySelector("button")!
      await act(async () => {
        trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
      assert.deepEqual(asked[0], { q: "", tournamentId: "event", page: 0 })

      const options = () => [...document.querySelectorAll<HTMLButtonElement>(".tournament-picker-options > button")]
      for (let attempt = 0; attempt < 50 && !options().length; attempt++)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20))
        })
      const buttons = options()
      const text = buttons.map((button) => button.textContent)
      assert.equal(buttons.length, 2, "the row already taken is left out")
      assert.match(text[0]!, /^Đội của giải\s*Trong giải này · Hoạt động 25\/10\/2026$/)
      assert.match(text[1]!, /^Đội cũ\s*Chưa ghi nhận trận nào$/)

      await act(async () => buttons[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true })))
      assert.deepEqual(chosen, ["ours"])
    } finally {
      await act(async () => root.unmount())
      client.clear()
      tournamentApi.pick = pick
    }
  })
})
