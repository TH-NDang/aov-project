import assert from "node:assert/strict"
import { before, test } from "node:test"
import { act, type ReactNode } from "react"
import { button as findButton, click, confirmDialog as dialog, flush, render, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json, noContent, type ApiRequest } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"
import type { HeroShop, HeroShopPrice, SkinAcquisition } from "../src/features/publishing/api/publishing-api"
import type { AdminVideo } from "../src/features/videos/video-model"
import type { Revision } from "../src/features/publishing/api/types"

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

const storageTable = {
  id: "t1",
  name: "Bảng thử",
  version: 1,
  columns: ["id", "name"],
  idColumn: "id",
  rows: [
    { id: "1", name: "Một" },
    { id: "2", name: "Hai" },
  ],
  archived: false,
}

const backend = fakeBackend(
  sessionRoutes({ capabilities: ["hero:write", "hero:publish"] }),
  ({ method, path, body }) => {
    if (path === "/__storage/") return json([{ ...storageTable, rows: undefined, rowCount: 2 }])
    if (path === "/__storage/t1" && method === "GET") return json(storageTable)
    if (path === "/__storage/t1" && method === "PUT") return json(body)
    if (path.startsWith("/admin/heroes/fixture-hero/shop") && method === "GET") return json(shop)
    if (method === "DELETE") return noContent()
    if (path === "/admin/seasons") return json([{ id: "season-1" }])
    if (path === "/admin/heroes/import/contexts?seasonId=season-1")
      return json([
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
    if (path.endsWith("/baseline-context")) return json({ id: "draft", version: 2 })
    return undefined
  },
)
const requests: ApiRequest[] = backend.requests
const dom = withDom({ globals: () => ({ fetch: backend.fetch }) })

before(signIn)

async function mounted(element: ReactNode) {
  return (await render(element)).unmount
}

function button(label: string, scope: ParentNode = document) {
  const found = findButton(label, scope)
  assert.ok(found, `Expected a "${label}" button`)
  return found
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
  const { HeroShopPanel } = await import("../src/features/publishing/components/skins/hero-shop")
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
  const { SkinAcquisitionEditor } = await import("../src/features/publishing/components/skins/hero-shop")
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
  const { BaselineContextForm } = await import("../src/features/publishing/components/import/baseline-context-form")
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
    await flush()
    const submit = () => button("Đổi patch")
    const write = await expectAskedBeforeWrite(submit, /Đổi patch của bản nhập dữ liệu\?/, "Đổi patch", "Quay lại")
    assert.equal(write.method, "POST")
    assert.match(write.path, /\/drafts\/draft\/baseline-context$/)
    assert.equal(moved.length, 1)
  } finally {
    await unmount()
  }
})

test("deleting a row of a JSON table asks first", async () => {
  const { MemoryRouter } = await import("react-router")
  const { StoragePage } = await import("../src/features/storage/storage-page")
  const { unmount } = await render(<StoragePage />, {
    wrap: (node) => <MemoryRouter initialEntries={["/storage?table=t1"]}>{node}</MemoryRouter>,
  })
  try {
    const deleteButton = await waitFor(() =>
      document.querySelector<HTMLButtonElement>('button[aria-label="Xóa dòng 1"]'),
    )
    const write = await expectAskedBeforeWrite(() => deleteButton, /Xóa dòng dữ liệu?/, "Xóa")
    assert.equal(write.method, "PUT")
    assert.deepEqual((write.body as typeof storageTable).rows, [{ id: "2", name: "Hai" }])
  } finally {
    await unmount()
  }
})
