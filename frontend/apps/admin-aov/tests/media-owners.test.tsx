import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import type { MediaOwner } from "../src/features/media/media-owners"

const garena: MediaOwner = {
  id: "garena",
  name: "Garena / Liên Quân Mobile",
  contactUrl: null,
  assetCount: 5481,
  version: 0,
}
const shortGarena: MediaOwner = { id: "short", name: "Garena", contactUrl: null, assetCount: 2, version: 3 }

test("owner names match ignoring case and whitespace and flag look-alike spellings", async () => {
  const { exactOwner, ownerKey, similarOwner } = await import("../src/features/media/media-owner-names")
  const owners = [garena, shortGarena]

  assert.equal(ownerKey("  GARENA   /  Liên Quân Mobile "), "garena / liên quân mobile")
  assert.equal(exactOwner("garena / liên  quân mobile", owners)?.id, "garena")
  assert.equal(similarOwner("garena / liên  quân mobile", owners), undefined, "The same owner is not a look-alike")
  assert.equal(similarOwner("Garena Lien Quan Mobile", owners)?.id, "garena", "Accents and punctuation are ignored")
  assert.equal(similarOwner("Liên Quân", owners)?.id, "garena", "Words of an existing name suggest it")
  assert.equal(similarOwner("BOOM Esports", owners), undefined)
  assert.equal(similarOwner("", owners), undefined)
})

test("owner suggestions fill the field only on request and the catalog renames and merges owners", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/image-management", pretendToBeVisual: true })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  let owners = [garena, shortGarena]
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "test", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        capabilities: ["catalog:read", "media:write"],
      })
    const method = init?.method ?? "GET"
    if (path === "/admin/media/owners" && method === "GET")
      return Response.json({ items: owners, page: 0, size: 100, totalElements: owners.length })
    const update = path.match(/^\/admin\/media\/owners\/([^/]+)(\/merge)?$/)
    if (update && method !== "GET") {
      const body = JSON.parse(String(init?.body))
      writes.push({ method, path, body })
      if (update[2]) {
        owners = owners.filter((owner) => owner.id !== update[1])
        return Response.json(garena)
      }
      owners = owners.map((owner) => (owner.id === update[1] ? { ...owner, name: body.name, version: 4 } : owner))
      return Response.json(owners.find((owner) => owner.id === update[1]))
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { MediaSourceFields } = await import("../src/features/media/media-source-fields")
  const { MediaOwnersSheet } = await import("../src/features/media/media-owners-sheet")
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const waitFor = async (condition: () => boolean) => {
    for (let i = 0; i < 150 && !condition(); i++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), document.body.textContent ?? "")
  }
  const button = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.trim() === text)
  const click = async (node: HTMLElement | null | undefined) => {
    assert.ok(node)
    await act(async () => node.click())
  }
  const type = async (field: HTMLInputElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(field, value)
      field.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  }
  let source: MediaSourceInput = { type: "OTHER", label: "Ảnh chụp từ game Liên Quân", ownerName: null }
  function Form() {
    const [value, setValue] = React.useState(source)
    source = value
    return (
      <MediaSourceFields value={value} onChange={(next) => setValue({ ...next, ownerName: next.ownerName ?? null })} />
    )
  }
  const ownerField = () =>
    [...document.querySelectorAll("label")]
      .find((label) => label.textContent?.trim() === "Chủ sở hữu / tên cần credit")!
      .querySelector("input")!

  try {
    await verifySession()
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <Form />
        </QueryClientProvider>,
      ),
    )
    await waitFor(() => !!button("Garena / Liên Quân Mobile"))
    assert.equal(ownerField().value, "", "Suggestions never fill the owner by themselves")
    assert.equal(document.querySelectorAll("datalist option").length, 2)
    await click(button("Garena / Liên Quân Mobile"))
    assert.equal(source.ownerName, "Garena / Liên Quân Mobile")

    await type(ownerField(), "Lien Quan")
    await waitFor(() => document.body.textContent!.includes("Gần giống chủ sở hữu đã có"))
    assert.equal(source.ownerName, "Lien Quan", "A look-alike is only flagged")
    await click(button("Dùng tên này"))
    assert.equal(source.ownerName, "Garena / Liên Quân Mobile")
    await type(ownerField(), "BOOM Esports")
    assert.doesNotMatch(document.body.textContent!, /Gần giống chủ sở hữu đã có/)

    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MediaOwnersSheet writable onClose={() => {}} />
        </QueryClientProvider>,
      ),
    )
    await waitFor(() => document.querySelectorAll('[aria-label="Danh sách chủ sở hữu"] li').length === 2)
    assert.match(document.body.textContent!, /5481 ảnh/)
    assert.match(document.body.textContent!, /Gần giống “Garena \/ Liên Quân Mobile”/)

    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Sửa Garena"]'))
    const nameField = [...document.querySelectorAll("label")]
      .find((label) => label.textContent?.trim().startsWith("Tên chủ sở hữu"))!
      .querySelector("input")!
    await type(nameField, "Garena VN")
    await click(button("Lưu"))
    await waitFor(() => writes.length === 1)
    assert.deepEqual(writes[0], {
      method: "PUT",
      path: "/admin/media/owners/short",
      body: { name: "Garena VN", contactUrl: null, expectedVersion: 3 },
    })
    await waitFor(() => document.body.textContent!.includes("Garena VN"))

    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Gộp Garena VN vào chủ sở hữu khác"]'))
    assert.match(document.body.textContent!, /2 ảnh đang ghi “Garena VN” sẽ chuyển sang “Garena \/ Liên Quân Mobile”/)
    await click(button("Gộp"))
    await waitFor(() => writes.length === 2)
    assert.deepEqual(writes[1], {
      method: "POST",
      path: "/admin/media/owners/short/merge",
      body: { targetId: "garena", expectedVersion: 4 },
    })
    await waitFor(() => document.querySelectorAll('[aria-label="Danh sách chủ sở hữu"] li').length === 1)
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
