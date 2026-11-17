import assert from "node:assert/strict"
import { before, beforeEach, test } from "node:test"
import * as React from "react"
import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import type { MediaOwner } from "../src/features/media/media-owners"
import { answerConfirm, button, click, confirmDialog, render, type, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json, page } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const garena: MediaOwner = {
  id: "garena",
  name: "Garena / Liên Quân Mobile",
  contactUrl: null,
  assetCount: 5481,
  version: 0,
}
const shortGarena: MediaOwner = { id: "short", name: "Garena", contactUrl: null, assetCount: 2, version: 3 }

let owners: MediaOwner[] = []
const writes: { method: string; path: string; body: unknown }[] = []
const backend = fakeBackend(sessionRoutes({ capabilities: ["catalog:read", "media:write"] }), (request) => {
  if (request.pathname === "/admin/media/owners" && request.method === "GET") return page(owners, { size: 100 })
  const update = request.pathname.match(/^\/admin\/media\/owners\/([^/]+)(\/merge)?$/)
  if (!update || request.method === "GET") return undefined
  writes.push({ method: request.method, path: request.pathname, body: request.body })
  if (update[2]) {
    owners = owners.filter((owner) => owner.id !== update[1])
    return json(garena)
  }
  const body = request.body as { name: string }
  owners = owners.map((owner) => (owner.id === update[1] ? { ...owner, name: body.name, version: 4 } : owner))
  return json(owners.find((owner) => owner.id === update[1]))
})
withDom({
  url: "http://localhost/image-management",
  globals: (window) => {
    Object.defineProperty(window, "matchMedia", {
      value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    })
    return { fetch: backend.fetch }
  },
})

before(signIn)
beforeEach(() => {
  owners = [garena, shortGarena]
  writes.length = 0
})

const text = () => document.body.textContent ?? ""
const ownerRows = () => document.querySelectorAll('[aria-label="Danh sách chủ sở hữu"] li')

async function ownersSheet() {
  const { MediaOwnersSheet } = await import("../src/features/media/media-owners-sheet")
  const rendered = await render(<MediaOwnersSheet writable onClose={() => {}} />)
  await waitFor(() => ownerRows().length === 2)
  return rendered
}

test("owner names match ignoring case and whitespace and flag look-alike spellings", async () => {
  const { exactOwner, ownerKey, similarOwner } = await import("../src/features/media/media-owner-names")
  const all = [garena, shortGarena]

  assert.equal(ownerKey("  GARENA   /  Liên Quân Mobile "), "garena / liên quân mobile")
  assert.equal(exactOwner("garena / liên  quân mobile", all)?.id, "garena")
  assert.equal(similarOwner("garena / liên  quân mobile", all), undefined, "The same owner is not a look-alike")
  assert.equal(similarOwner("Garena Lien Quan Mobile", all)?.id, "garena", "Accents and punctuation are ignored")
  assert.equal(similarOwner("Liên Quân", all)?.id, "garena", "Words of an existing name suggest it")
  assert.equal(similarOwner("BOOM Esports", all), undefined)
  assert.equal(similarOwner("", all), undefined)
})

test("owner suggestions fill the field only on request", async () => {
  const { MediaSourceFields } = await import("../src/features/media/media-source-fields")
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
      .find((label) => label.textContent?.trim() === "Chủ sở hữu / tên cần ghi công")!
      .querySelector("input")!

  const { unmount } = await render(<Form />)
  await waitFor(() => button("Garena / Liên Quân Mobile"))
  assert.equal(ownerField().value, "", "Suggestions never fill the owner by themselves")
  assert.equal(document.querySelectorAll("datalist option").length, 2)
  await click(button("Garena / Liên Quân Mobile"))
  assert.equal(source.ownerName, "Garena / Liên Quân Mobile")

  await type(ownerField(), "Lien Quan")
  await waitFor(() => text().includes("Gần giống chủ sở hữu đã có"))
  assert.equal(source.ownerName, "Lien Quan", "A look-alike is only flagged")
  await click(button("Dùng tên này"))
  assert.equal(source.ownerName, "Garena / Liên Quân Mobile")
  await type(ownerField(), "BOOM Esports")
  assert.doesNotMatch(text(), /Gần giống chủ sở hữu đã có/)
  await unmount()
})

test("the owner catalog renames an owner for every image", async () => {
  const { unmount } = await ownersSheet()
  assert.match(text(), /5481 ảnh/)
  assert.match(text(), /Gần giống “Garena \/ Liên Quân Mobile”/)

  await click(document.querySelector('button[aria-label="Sửa Garena"]'), "edit button")
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
  await waitFor(() => text().includes("Garena VN"))
  await unmount()
})

test("merging an owner asks first because it cannot be undone", async () => {
  const { unmount } = await ownersSheet()
  await click(document.querySelector('button[aria-label="Gộp Garena vào chủ sở hữu khác"]'), "merge button")
  assert.match(text(), /2 ảnh đang ghi “Garena” sẽ chuyển sang “Garena \/ Liên Quân Mobile”/)

  await click(button("Gộp"))
  assert.match(confirmDialog()!.textContent!, /Gộp “Garena” vào “Garena \/ Liên Quân Mobile”\?/)
  assert.match(confirmDialog()!.textContent!, /Không hoàn tác được/)
  await answerConfirm("Hủy")
  assert.deepEqual(writes, [], "Refusing keeps both owners")

  await click(button("Gộp"))
  await answerConfirm("Gộp")
  await waitFor(() => writes.length === 1)
  assert.deepEqual(writes[0], {
    method: "POST",
    path: "/admin/media/owners/short/merge",
    body: { targetId: "garena", expectedVersion: 3 },
  })
  await waitFor(() => ownerRows().length === 1)
  await unmount()
})
