import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { act, useState } from "react"
import { createMemoryRouter, RouterProvider, useParams, useSearchParams } from "react-router"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { PageTabPanels, PageTabsProvider, usePageTabs } from "../src/app/layout/page-tabs"
import { useChangeEffect } from "../src/hooks/use-change-effect"
import { useTable } from "@tanstack/react-table"
import { dataTableFeatures } from "../src/components/data-table/table-features"
import { HotkeysProvider, useHotkeys } from "../src/app/hotkeys"

const tableRows = [
  { id: "1", name: "A" },
  { id: "2", name: "B" },
  { id: "3", name: "C" },
]
const tableColumns = [{ accessorKey: "name" }]

test("tab sessions preserve drafts, filters, route params, DOM, scroll and query data until closed", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity, refetchOnMount: (query) => query.state.isInvalidated },
    },
  })
  const loads = new Map<string, number>()
  function Page({ name }: { name: string }) {
    const { heroId } = useParams()
    const id = heroId ?? name
    const [search, setSearch] = useSearchParams()
    const [draft, setDraft] = useState("")
    useChangeEffect(() => setDraft(""), [id])
    const table = useTable({
      features: dataTableFeatures,
      data: tableRows,
      columns: tableColumns,
      initialState: { pagination: { pageIndex: 0, pageSize: 1 } },
    })
    const data = useQuery({
      queryKey: ["page", id],
      queryFn: async () => {
        loads.set(id, (loads.get(id) ?? 0) + 1)
        return id
      },
    })
    return (
      <div>
        <span data-testid="route">{id}</span>
        <span data-testid="query">{search.get("q") ?? ""}</span>
        <input data-testid="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button data-testid="edit" onClick={() => setDraft("Unfinished draft")}>
          Edit
        </button>
        <button data-testid="filter" onClick={() => setSearch({ q: id })}>
          Filter
        </button>
        <button data-testid="page" onClick={() => table.setPageIndex(1)}>
          Page 2
        </button>
        <span data-testid="table-page">{table.state.pagination.pageIndex}</span>
        <div data-testid="inner-scroll" style={{ height: 100, overflow: "auto" }}>
          <div style={{ height: 1000 }}>{data.data}</div>
        </div>
      </div>
    )
  }
  function Shell() {
    return (
      <PageTabsProvider>
        <Tabs />
        <PageTabPanels />
      </PageTabsProvider>
    )
  }
  function Tabs() {
    const { enabled, setEnabled } = useHotkeys()
    const { sessions, closeTab, moveTab } = usePageTabs()
    return (
      <nav>
        <button data-testid="toggle-hotkeys" onClick={() => setEnabled(!enabled)}>
          Toggle hotkeys
        </button>
        <button data-testid="move-last" onClick={() => moveTab("/heroes", "/storage")}>
          Move last
        </button>
        <button data-testid="move-first" onClick={() => moveTab("/heroes", "/heroes/airi")}>
          Move first
        </button>
        {sessions.map((session) => (
          <button key={session.path} data-close={session.path} onClick={() => closeTab(session.path)}>
            Close {session.path}
          </button>
        ))}
      </nav>
    )
  }
  const router = createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { path: "/", element: <Page name="home" /> },
          { path: "/heroes", element: <Page name="heroes" /> },
          { path: "/heroes/:heroId", element: <Page name="detail" /> },
          { path: "/storage", element: <Page name="storage" /> },
        ],
      },
    ],
    { initialEntries: ["/heroes"] },
  )
  const root = createRoot(dom.window.document.getElementById("root")!)
  const flush = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
  const navigate = async (to: string) => {
    await act(async () => {
      await router.navigate(to)
    })
    await flush()
  }
  const panel = (path: string) => dom.window.document.querySelector<HTMLElement>(`[data-page-tab="${path}"]`)!
  const click = async (element: Element) => {
    await act(async () => {
      element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await flush()
  }
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <HotkeysProvider>
            <RouterProvider router={router} />
          </HotkeysProvider>
        </QueryClientProvider>,
      )
    })
    await flush()
    const heroesPanel = panel("/heroes")
    const draft = heroesPanel.querySelector<HTMLInputElement>('[data-testid="draft"]')!
    const inner = heroesPanel.querySelector<HTMLElement>('[data-testid="inner-scroll"]')!
    await click(heroesPanel.querySelector('[data-testid="edit"]')!)
    await click(heroesPanel.querySelector('[data-testid="filter"]')!)
    await click(heroesPanel.querySelector('[data-testid="page"]')!)
    await act(async () => {
      heroesPanel.scrollTop = 420
      inner.scrollTop = 170
      heroesPanel.dispatchEvent(new dom.window.Event("scroll"))
      inner.dispatchEvent(new dom.window.Event("scroll", { bubbles: false }))
    })
    await navigate("/heroes/airi?q=skins")
    assert.equal(panel("/heroes/airi").querySelector('[data-testid="route"]')!.textContent, "airi")
    await click(panel("/heroes/airi").querySelector('[data-testid="edit"]')!)
    await navigate("/storage?q=items")
    assert.equal(heroesPanel.hidden, true)
    assert.equal(panel("/storage").querySelector('[data-testid="query"]')!.textContent, "items")
    assert.equal(heroesPanel.querySelector('[data-testid="query"]')!.textContent, "heroes")
    // Simulate a browser resetting hidden scroll regions; activation must restore them.
    heroesPanel.scrollTop = 0
    inner.scrollTop = 0
    await navigate("/heroes?q=heroes")
    assert.equal(panel("/heroes"), heroesPanel)
    assert.equal(panel("/heroes").querySelector('[data-testid="draft"]'), draft)
    assert.equal(draft.value, "Unfinished draft")
    assert.equal(heroesPanel.querySelector('[data-testid="table-page"]')!.textContent, "1")
    assert.equal(heroesPanel.scrollTop, 420)
    assert.equal(inner.scrollTop, 170)
    assert.equal(loads.get("heroes"), 1)
    await click(dom.window.document.querySelector('[data-testid="move-last"]')!)
    assert.deepEqual(
      [...dom.window.document.querySelectorAll("[data-close]")].map((node) => node.getAttribute("data-close")),
      ["/heroes/airi", "/storage", "/heroes"],
    )
    assert.equal(router.state.location.pathname, "/heroes")
    assert.equal(panel("/heroes"), heroesPanel)
    assert.equal(draft.value, "Unfinished draft")
    assert.equal(heroesPanel.scrollTop, 420)
    assert.equal(inner.scrollTop, 170)
    await click(dom.window.document.querySelector('[data-testid="move-first"]')!)
    assert.deepEqual(
      [...dom.window.document.querySelectorAll("[data-close]")].map((node) => node.getAttribute("data-close")),
      ["/heroes", "/heroes/airi", "/storage"],
    )
    await navigate("/heroes/airi?q=skins")
    assert.equal(
      panel("/heroes/airi").querySelector<HTMLInputElement>('[data-testid="draft"]')!.value,
      "Unfinished draft",
    )
    assert.equal(panel("/heroes/airi").querySelector('[data-testid="query"]')!.textContent, "skins")
    await navigate("/heroes/tamyn")
    assert.equal(panel("/heroes/tamyn").querySelector('[data-testid="route"]')!.textContent, "tamyn")
    assert.equal(panel("/heroes/airi").querySelector('[data-testid="route"]')!.textContent, "airi")
    await click(dom.window.document.querySelector('[data-close="/heroes/airi"]')!)
    assert.equal(dom.window.document.querySelector('[data-page-tab="/heroes/airi"]'), null)
    await navigate("/heroes/airi")
    assert.equal(panel("/heroes/airi").querySelector<HTMLInputElement>('[data-testid="draft"]')!.value, "")
    await click(dom.window.document.querySelector('[data-close="/heroes/airi"]')!)
    assert.equal(router.state.location.pathname, "/heroes/tamyn")
    await navigate("/storage")
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["page", "heroes"], refetchType: "none" })
    })
    await navigate("/heroes?q=heroes")
    assert.equal(loads.get("heroes"), 2)
    assert.equal(panel("/heroes").querySelector<HTMLInputElement>('[data-testid="draft"]')!.value, "Unfinished draft")
    const pressShortcut = async (key: string, modifiers: KeyboardEventInit) => {
      await act(async () => {
        dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, cancelable: true, ...modifiers }))
      })
      await flush()
    }
    await pressShortcut("3", { ctrlKey: true })
    assert.equal(router.state.location.pathname, "/heroes/tamyn")
    await pressShortcut("1", { altKey: true })
    assert.equal(router.state.location.pathname, "/heroes")
    assert.equal(router.state.location.search, "?q=heroes")
    await pressShortcut("9", { ctrlKey: true })
    assert.equal(router.state.location.pathname, "/heroes/tamyn")
    await click(dom.window.document.querySelector('[data-testid="toggle-hotkeys"]')!)
    assert.equal(dom.window.localStorage.getItem("aov-admin:hotkeys-enabled"), "false")
    await pressShortcut("1", { ctrlKey: true })
    assert.equal(router.state.location.pathname, "/heroes/tamyn")
    await pressShortcut("w", { altKey: true })
    assert.ok(panel("/heroes/tamyn"))
    await click(dom.window.document.querySelector('[data-testid="toggle-hotkeys"]')!)
    await pressShortcut("1", { ctrlKey: true })
    await pressShortcut("w", { altKey: true })
    assert.equal(dom.window.document.querySelector('[data-page-tab="/heroes"]'), null)
    assert.equal(router.state.location.pathname, "/storage")
    await pressShortcut("w", { ctrlKey: true })
    assert.equal(router.state.location.pathname, "/heroes/tamyn")
  } finally {
    await act(async () => root.unmount())
    router.dispose()
    client.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
