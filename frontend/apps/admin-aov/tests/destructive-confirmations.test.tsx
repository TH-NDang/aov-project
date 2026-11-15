import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { HeroShop, HeroShopPrice, SkinAcquisition } from "../src/features/publishing/publishing-api"
import type { AdminVideo } from "../src/features/videos/video-model"
import type { Revision } from "../src/features/publishing/types"

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", pretendToBeVisual: true })
const document = dom.window.document
const requests: { method: string; path: string }[] = []

const price = (capturedOn: string, goldPrice: number): HeroShopPrice => ({
  availability: "ON_SALE",
  goldPrice,
  voucherPrice: 999,
  capturedOn,
  needsReview: false,
  note: null,
})
const skinStep = (capturedOn: string, voucherPrice: number): SkinAcquisition => ({
  skinKey: "fixture-skin",
  method: "VOUCHER",
  voucherPrice,
  eventName: null,
  capturedOn,
  needsReview: false,
  note: null,
})
const shop: HeroShop = {
  region: "VN",
  at: "2026-11-15T00:00:00Z",
  price: price("2026-11-01", 18888),
  skins: [],
  priceHistory: [price("2026-11-01", 18888), price("2026-10-01", 13888)],
  skinHistory: [],
}

const fetcher: typeof fetch = async (input, init) => {
  const path = String(input).replace("/api/wiki/v1", "")
  const method = init?.method ?? "GET"
  requests.push({ method, path })
  if (path === "/auth/refresh") return Response.json({ accessToken: "fixture-only", expiresIn: 3600 })
  if (path === "/auth/logout") return new Response(null, { status: 204 })
  if (path === "/admin/me")
    return Response.json({
      issuer: "fixture",
      subject: "editor",
      type: "HUMAN",
      displayName: "UI fixture",
      capabilities: ["hero:write", "hero:publish"],
    })
  if (path.startsWith("/admin/heroes/fixture-hero/shop") && method === "GET") return Response.json(shop)
  if (method === "DELETE") return new Response(null, { status: 204 })
  if (path === "/admin/seasons") return Response.json([{ id: "season-1" }])
  if (path === "/admin/heroes/import/contexts?seasonId=season-1")
    return Response.json([
      {
        contextId: "context-old",
        rulesetId: "rules",
        patchVariantId: "variant-old",
        seasonName: "S1",
        patchCode: "1.0",
      },
      {
        contextId: "context-new",
        rulesetId: "rules",
        patchVariantId: "variant-new",
        seasonName: "S1",
        patchCode: "1.1",
      },
    ])
  if (path.endsWith("/baseline-context")) return Response.json({ id: "draft", version: 2 })
  return Response.json({ detail: `Unexpected ${method} ${path}` }, { status: 404 })
}

const originals = new Map<string, PropertyDescriptor | undefined>()
before(async () => {
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession } = await import("../src/app/auth/session")
  await verifySession()
})

after(async () => {
  const { logout } = await import("../src/app/auth/session")
  await logout()
  dom.window.close()
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

async function settle() {
  for (let attempt = 0; attempt < 5; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

async function mounted(element: React.ReactNode) {
  const { createRoot } = await import("react-dom/client")
  const { ConfirmDialogHost } = await import("../src/components/confirm-dialog")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        {element}
        <ConfirmDialogHost />
      </QueryClientProvider>,
    ),
  )
  await settle()
  return async () => {
    await act(async () => root.unmount())
    client.clear()
    host.remove()
  }
}

const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]')

function button(label: string, scope: ParentNode = document) {
  const found = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (entry) => entry.getAttribute("aria-label") === label || entry.textContent?.trim() === label,
  )
  assert.ok(found, `Expected a "${label}" button`)
  return found
}

async function click(element: HTMLElement) {
  await act(async () => element.click())
  await settle()
}

const writes = () => requests.filter((request) => request.method !== "GET")

/** Refusing the question sends nothing; accepting it sends exactly the one write. */
async function expectAskedBeforeWrite(trigger: () => HTMLElement, title: RegExp, accept: string, cancel = "Hủy") {
  requests.length = 0
  await click(trigger())
  assert.ok(dialog(), "The action asks first")
  assert.match(dialog()!.textContent!, title)
  assert.deepEqual(writes(), [], "Nothing is written while the question is open")

  await click(button(cancel, dialog()!))
  assert.equal(dialog(), null)
  assert.deepEqual(writes(), [], "Refusing keeps the data")

  await click(trigger())
  await click(button(accept, dialog()!))
  assert.equal(writes().length, 1, "Accepting sends the change once")
  return writes()[0]
}

test("deleting a dated hero price asks first", async () => {
  const { HeroShopPanel } = await import("../src/features/publishing/hero-shop")
  const unmount = await mounted(<HeroShopPanel heroId="fixture-hero" canWrite />)
  try {
    const deleteButton = () => document.querySelector<HTMLButtonElement>('button[aria-label^="Xóa mốc giá"]')!
    assert.ok(deleteButton(), "The price history lists its dated steps")
    const write = await expectAskedBeforeWrite(deleteButton, /Xóa mốc giá .+\?/, "Xóa mốc giá")
    assert.equal(write.method, "DELETE")
    assert.match(write.path, /^\/admin\/heroes\/fixture-hero\/shop\/prices\/2026-11-01\?region=VN$/)
  } finally {
    await unmount()
  }
})

test("deleting a dated skin acquisition asks first", async () => {
  const { SkinAcquisitionEditor } = await import("../src/features/publishing/hero-shop")
  const history = [skinStep("2026-11-01", 699), skinStep("2026-10-01", 499)]
  const unmount = await mounted(
    <SkinAcquisitionEditor
      heroId="fixture-hero"
      skinKey="fixture-skin"
      value={history[0]}
      history={history}
      canWrite
      editing={false}
      onDraftChange={() => {}}
    />,
  )
  try {
    const deleteButton = () => document.querySelector<HTMLButtonElement>('button[aria-label^="Xóa mốc"]')!
    const write = await expectAskedBeforeWrite(deleteButton, /Xóa mốc cách nhận .+\?/, "Xóa mốc")
    assert.equal(write.method, "DELETE")
    assert.match(write.path, /\/shop\/skins\/fixture-skin\/2026-11-01\?region=VN$/)
  } finally {
    await unmount()
  }
})

test("deleting a video asks in the shared question", async () => {
  const { VideoRow } = await import("../src/features/videos/video-row")
  const video: AdminVideo = {
    id: "video-1",
    subjectKind: "HERO",
    subjectId: "fixture-hero",
    subjectKey: null,
    purpose: "GUIDE_BASIC",
    title: "Hướng dẫn",
    note: null,
    url: "https://example.com/video",
    provider: "OTHER",
    providerVideoId: null,
    startSeconds: 0,
    durationSeconds: null,
    channelName: null,
    publishedOn: null,
    patchVariantId: null,
    displayOrder: 0,
    status: "DRAFT",
    origin: "MANUAL",
    version: 1,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  }
  let deleted = 0
  const unmount = await mounted(
    <ul>
      <VideoRow
        video={video}
        busy={false}
        onEdit={() => {}}
        onStatus={() => {}}
        onDelete={() => {
          deleted++
        }}
      />
    </ul>,
  )
  try {
    await click(button("Xóa video"))
    assert.match(dialog()!.textContent!, /Xóa video này\?/)
    assert.match(button("Xóa", dialog()!).className, /bg-destructive/, "Deleting reads as dangerous")
    await click(button("Giữ lại", dialog()!))
    assert.equal(deleted, 0, "Refusing keeps the video")

    await click(button("Xóa video"))
    await click(button("Xóa", dialog()!))
    assert.equal(deleted, 1)
  } finally {
    await unmount()
  }
})

test("moving a baseline to another patch asks first", async () => {
  const { BaselineContextForm } = await import("../src/features/publishing/baseline-context-form")
  const revision = {
    id: "draft",
    heroId: "fixture-hero",
    version: 1,
    rulesetId: "rules",
    effectiveFromPatchVariantId: "variant-old",
  } as Revision
  const moved: Revision[] = []
  const unmount = await mounted(
    <BaselineContextForm
      revision={revision}
      disabled={false}
      onMove={async (result) => {
        moved.push(result)
      }}
    />,
  )
  try {
    const select = document.querySelector<HTMLSelectElement>("select")!
    await act(async () => {
      select.value = "context-new"
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await settle()
    const submit = () => button("Đổi patch")
    const write = await expectAskedBeforeWrite(submit, /Đổi patch của bản nhập dữ liệu\?/, "Đổi patch", "Quay lại")
    assert.equal(write.method, "POST")
    assert.match(write.path, /\/drafts\/draft\/baseline-context$/)
    assert.equal(moved.length, 1)
  } finally {
    await unmount()
  }
})
