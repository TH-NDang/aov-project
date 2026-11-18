import assert from "node:assert/strict"
import { after, test } from "node:test"
import { createMemoryRouter, RouterProvider } from "react-router"
import { act } from "react"
import { button, click, flush, render, withDom } from "./fixtures/dom"

const { window } = withDom({ url: "http://localhost:5175/tournaments" })

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { RegistryImportSheet } = await import("../src/features/tournaments/components/registry-import")

const original = { list: tournamentApi.list, create: tournamentApi.create }
after(() => Object.assign(tournamentApi, original))

test("file selection previews named records without mutation until the explicit start action", async () => {
  let writes = 0
  tournamentApi.list = async (_kind, _signal, filters) => {
    assert.deepEqual(filters, { state: "ALL" })
    return []
  }
  tournamentApi.create = async (_kind, content) => {
    writes++
    return { id: "team", version: 1, createdAt: "", updatedAt: "", missingFields: [], deletedAt: null, content }
  }
  const router = createMemoryRouter([{ path: "/", element: <RegistryImportSheet onClose={() => {}} /> }])
  const view = await render(<RouterProvider router={router} />)
  try {
    const input = document.querySelector<HTMLInputElement>('[aria-label="Chọn file nhập dữ liệu"]')!
    assert.ok(input)
    const text = JSON.stringify({
      schemaVersion: 1,
      teams: [{ content: { code: "verified-team", name: "Verified Team" } }],
    })
    const file = new window.File([text], "teams.json", { type: "application/json" })
    Object.defineProperty(file, "text", { value: async () => text })
    Object.defineProperty(input, "files", { configurable: true, value: [file] })
    await act(async () => input.dispatchEvent(new window.Event("change", { bubbles: true })))
    await flush()
    assert.match(document.body.textContent ?? "", /Verified Team/)
    assert.match(document.body.textContent ?? "", /1 mục/)
    assert.equal(writes, 0)

    const start = button("Bắt đầu nhập")
    assert.equal(start?.disabled, false)
    await click(start, "start button")
    assert.equal(writes, 1)
    assert.match(document.body.textContent ?? "", /Đã nhập xong/)
    assert.match(document.body.textContent ?? "", /1 \/ 1/)
  } finally {
    await view.unmount()
    router.dispose()
  }
})
