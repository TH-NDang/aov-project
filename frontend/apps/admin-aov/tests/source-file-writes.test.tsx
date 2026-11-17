import assert from "node:assert/strict"
import { before, beforeEach, test } from "node:test"
import { answerConfirm, answerMediaQueries, button, click, render, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const details = {
  id: "file-1",
  path: "raw/shop/a.png",
  sha256: "a".repeat(64),
  sizeBytes: 1200,
  contentType: "application/json",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  version: 2,
  collection: { id: "c1", code: "shop", category: "SHOP_CAPTURE", label: "Cửa hàng" },
  otherPlaces: [],
  usages: [],
}

let deleteAnswer = () => json({ code: "INTERNAL_ERROR", status: 500, detail: "Boom" }, 500)
const backend = fakeBackend(sessionRoutes({ capabilities: ["catalog:read", "catalog:write"] }), (request) => {
  if (request.pathname === "/admin/source-files/file-1" && request.method === "GET") return json(details)
  if (request.pathname === "/admin/source-files/file-1/delete") return deleteAnswer()
  return undefined
})
withDom({
  globals: (window) => {
    answerMediaQueries(window, () => true)
    return { fetch: backend.fetch }
  },
})

before(signIn)
beforeEach(() => {
  backend.requests.length = 0
})

const deletes = () => backend.requests.filter((request) => request.pathname.endsWith("/delete"))

async function fileSheet(onClose: () => void) {
  const { Toaster } = await import("sonner")
  const { queryClient } = await import("../src/app/providers")
  const { SourceFileSheet } = await import("../src/features/files/source-file-sheet")
  await render(<SourceFileSheet fileId="file-1" writable onClose={onClose} />, {
    client: queryClient,
    wrap: (node) => (
      <>
        {node}
        <Toaster />
      </>
    ),
  })
  await waitFor(() => button("Bỏ khỏi bộ"))
}

test("a file that cannot be removed says so once and keeps the sheet open", async () => {
  let closed = 0
  await fileSheet(() => closed++)

  await click(button("Bỏ khỏi bộ"))
  await answerConfirm("Bỏ khỏi bộ")

  await waitFor(() => document.body.textContent?.includes("Thao tác không thành công."))
  const messages = document.body.textContent!.split("Thao tác không thành công.").length - 1
  assert.equal(messages, 1, "The failure is shown once, in the shared toast")
  assert.equal(deletes().length, 1)
  assert.equal(closed, 0)
})

test("a file being removed cannot be removed a second time", async () => {
  let release = () => {}
  deleteAnswer = () => {
    const answer = new Promise<Response>((resolve) => {
      release = () => resolve(new Response(null, { status: 204 }))
    })
    return answer as unknown as Response
  }
  let closed = 0
  await fileSheet(() => closed++)

  await click(button("Bỏ khỏi bộ"))
  await answerConfirm("Bỏ khỏi bộ")
  await waitFor(() => deletes().length === 1)

  assert.equal(button("Bỏ khỏi bộ")?.disabled, true)
  release()
  await waitFor(() => closed === 1)
  assert.equal(deletes().length, 1)
})
