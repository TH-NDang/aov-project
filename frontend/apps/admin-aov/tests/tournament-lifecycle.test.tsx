import assert from "node:assert/strict"
import { test } from "node:test"
import React, { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import type { RecordDeletionImpact } from "@aov/community-contracts"

const channelDescriptor = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel")
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
const { tournamentApi } = await import("../src/features/tournaments/tournament-api")
const { lifecycleUsages, lifecycleErrorUsages } = await import("../src/features/tournaments/record-lifecycle-model")
const { ApiError } = await import("../src/lib/api/errors")
if (channelDescriptor) Object.defineProperty(globalThis, "BroadcastChannel", channelDescriptor)

test("deletion references expose positive counts and only safe local admin links", () => {
  const usages = lifecycleUsages([
    { type: "ROSTER_MEMBERSHIP", count: 2, adminPath: "/tournaments?tab=teams&roster=team" },
    { type: "PUBLICATION_HISTORY", count: 1, adminPath: "https://external.example" },
    { type: "GAME", count: 3, adminPath: "//external.example" },
    { type: "GAME", count: -1, adminPath: "/tournaments" },
    { type: "GAME", count: 0.5, adminPath: "/tournaments" },
    null,
  ])
  assert.equal(usages.length, 3)
  assert.equal(usages[0].count, 2)
  assert.equal(usages[0].path, "/tournaments?tab=teams&roster=team")
  assert.equal(usages[1].label, "Lịch sử xuất bản")
  assert.equal(usages[1].path, undefined)
  assert.equal(usages[2].path, undefined)
  assert.deepEqual(
    lifecycleErrorUsages(
      new ApiError({
        status: 409,
        code: "TOURNAMENT_RECORD_IN_USE",
        ...{ usages: [{ type: "SERIES", count: 1, adminPath: "/tournaments" }] },
      }),
    ),
    [{ type: "SERIES", count: 1, label: "Trận đấu", path: "/tournaments" }],
  )
})

async function withUi(
  run: (context: {
    document: Document
    render: (node: React.ReactNode) => Promise<void>
    click: (label: string) => Promise<void>
    flush: () => Promise<void>
  }) => Promise<void>,
) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:5175/tournaments" })
  const values = {
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    BroadcastChannel: undefined,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    DocumentFragment: dom.window.DocumentFragment,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const flush = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15))
    })
  }
  try {
    await run({
      document: dom.window.document,
      render: async (node) => {
        await act(async () =>
          root.render(
            <QueryClientProvider client={client}>
              <MemoryRouter>{node}</MemoryRouter>
            </QueryClientProvider>,
          ),
        )
        await flush()
      },
      click: async (label) => {
        const button = [...dom.window.document.querySelectorAll<HTMLButtonElement>("button")].find(
          (button) =>
            button.getAttribute("aria-label") === label || button.textContent?.replace(/\s+/g, " ").trim() === label,
        )
        assert.ok(button, label)
        await act(async () => button.click())
        await flush()
      },
      flush,
    })
  } finally {
    await act(async () => root.unmount())
    client.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

const clearImpact: RecordDeletionImpact = { id: "player", version: 7, deletedAt: null, canDelete: true, usages: [] }

test("deletion waits for a reviewed impact, blocks stale or referenced records, then preserves the version", async () => {
  const original = { impact: tournamentApi.deletionImpact, remove: tournamentApi.remove }
  let removed = 0
  let changed = 0
  let resolveImpact!: (value: RecordDeletionImpact) => void
  tournamentApi.deletionImpact = () =>
    new Promise((resolve) => {
      resolveImpact = resolve
    })
  tournamentApi.remove = async (_kind, entry) => {
    removed++
    assert.deepEqual(entry, { id: "player", version: 7 })
    return { ...entry, version: 8, deletedAt: "2026-10-27T00:00:00Z" }
  }
  try {
    await withUi(async ({ render, click, document, flush }) => {
      const { RecordLifecycleActions } = await import("../src/features/tournaments/record-lifecycle-actions")
      await render(
        <RecordLifecycleActions
          kind="players"
          entry={{ id: "player", version: 7 }}
          name="Player"
          onChanged={() => {
            changed++
          }}
        />,
      )
      await click("Xóa Player")
      const confirmation = () =>
        [...document.querySelectorAll<HTMLButtonElement>("button")].find(
          (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Chuyển vào thùng rác",
        )!
      assert.equal(confirmation().disabled, true)
      assert.equal(removed, 0)
      await act(async () =>
        resolveImpact({
          ...clearImpact,
          canDelete: false,
          usages: [{ type: "ROSTER_MEMBERSHIP", count: 2, adminPath: "/tournaments?tab=teams&roster=team" }],
        }),
      )
      await flush()
      assert.equal(confirmation().disabled, true)
      assert.ok(document.querySelector('a[href="/tournaments?tab=teams&roster=team"]'))
      assert.match(document.body.textContent ?? "", /Đội hình2/)
      await click("Giữ lại")
      await click("Xóa Player")
      await act(async () => resolveImpact({ ...clearImpact, version: 8 }))
      await flush()
      assert.equal(confirmation().disabled, true)
      assert.match(document.body.textContent ?? "", /Mục đã thay đổi/)
      await click("Giữ lại")
      await click("Xóa Player")
      await act(async () => resolveImpact(clearImpact))
      await flush()
      assert.equal(confirmation().disabled, false)
      await click("Chuyển vào thùng rác")
      assert.equal(removed, 1)
      assert.equal(changed, 1)
      assert.equal(document.querySelector('[role="alertdialog"]'), null)
    })
  } finally {
    tournamentApi.deletionImpact = original.impact
    tournamentApi.remove = original.remove
  }
})

test("a reference added after preview returns actionable links and disables repeated deletion", async () => {
  const original = { impact: tournamentApi.deletionImpact, remove: tournamentApi.remove }
  let removed = 0
  tournamentApi.deletionImpact = async () => clearImpact
  tournamentApi.remove = async () => {
    removed++
    throw new ApiError({
      status: 409,
      code: "TOURNAMENT_RECORD_IN_USE",
      ...{ usages: [{ type: "GAME", count: 1, adminPath: "/tournaments?series=series" }] },
    })
  }
  try {
    await withUi(async ({ render, click, document }) => {
      const { RecordLifecycleActions } = await import("../src/features/tournaments/record-lifecycle-actions")
      await render(
        <RecordLifecycleActions
          kind="players"
          entry={{ id: "player", version: 7 }}
          name="Player"
          onChanged={() => assert.fail("Blocked record changed")}
        />,
      )
      await click("Xóa Player")
      await click("Chuyển vào thùng rác")
      assert.match(document.body.textContent ?? "", /Chưa thể xóa/)
      assert.ok(document.querySelector('a[href="/tournaments?series=series"]'))
      const confirmation = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Chuyển vào thùng rác",
      )!
      assert.equal(confirmation.disabled, true)
      assert.equal(removed, 1)
    })
  } finally {
    tournamentApi.deletionImpact = original.impact
    tournamentApi.remove = original.remove
  }
})

test("trash restores the exact deleted version and explains blocked parents without hiding the row", async () => {
  const original = tournamentApi.restore
  let calls = 0
  tournamentApi.restore = async (_kind, entry) => {
    calls++
    assert.equal(entry.version, 8)
    throw new ApiError({
      status: 409,
      code: "TOURNAMENT_RESTORE_BLOCKED",
      ...{ usages: [{ type: "TEAM", count: 1, adminPath: "/tournaments?tab=teams&state=deleted" }] },
    })
  }
  try {
    await withUi(async ({ render, click, document }) => {
      const { RecordLifecycleActions } = await import("../src/features/tournaments/record-lifecycle-actions")
      await render(
        <RecordLifecycleActions
          kind="roster-memberships"
          entry={{ id: "membership", version: 8, deletedAt: "2026-10-27T00:00:00Z" }}
          name="Player"
          onChanged={() => assert.fail("Blocked restore changed record")}
        />,
      )
      await click("Khôi phục")
      assert.equal(calls, 1)
      assert.match(document.body.textContent ?? "", /cần khôi phục dữ liệu liên quan trước/)
      assert.ok(document.querySelector('a[href="/tournaments?tab=teams&state=deleted"]'))
      assert.ok([...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Khôi phục")))
    })
  } finally {
    tournamentApi.restore = original
  }
})

test("trash keeps restore behind write permission and refreshes its list after recovery", async () => {
  const original = { list: tournamentApi.list, restore: tournamentApi.restore }
  let deleted = true
  const deletedPlayer = {
    id: "player",
    version: 8,
    createdAt: "",
    updatedAt: "",
    deletedAt: "2026-10-27T00:00:00Z",
    missingFields: [],
    content: { code: "old-player", nickname: "Old player", aliases: ["Earlier name"] },
  }
  tournamentApi.list = async (kind, _signal, filters) => {
    assert.equal(kind, "players")
    assert.equal(typeof filters === "object" ? filters.state : null, "DELETED")
    return (deleted ? [deletedPlayer] : []) as never
  }
  tournamentApi.restore = async (kind, entry) => {
    assert.equal(kind, "players")
    assert.equal(entry.id, "player")
    assert.equal(entry.version, 8)
    deleted = false
    return { id: entry.id, version: 9, deletedAt: null }
  }
  try {
    await withUi(async ({ render, click, document }) => {
      const { RecordTrash } = await import("../src/features/tournaments/record-trash")
      await render(<RecordTrash initialKind="players" actorKey="actor" canWrite={false} />)
      assert.match(document.body.textContent ?? "", /Old player/)
      assert.equal(
        [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Khôi phục")),
        false,
      )
      await render(<RecordTrash initialKind="players" actorKey="actor" canWrite />)
      await click("Khôi phục")
      assert.equal(deleted, false)
      assert.match(document.body.textContent ?? "", /Thùng rác đang trống/)
      assert.doesNotMatch(document.body.textContent ?? "", /Old player/)
    })
  } finally {
    tournamentApi.list = original.list
    tournamentApi.restore = original.restore
  }
})
