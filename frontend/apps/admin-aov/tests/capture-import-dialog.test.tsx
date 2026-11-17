import assert from "node:assert/strict"
import { test } from "node:test"
import { button, click, render, waitFor, withDom } from "./fixtures/dom"

withDom()

const set = (code: string, capturedOn: string) => ({
  code,
  capturedOn,
  capturedAt: `${capturedOn}T02:00:00Z`,
  sourceTimeZone: "Asia/Ho_Chi_Minh",
  heroes: 3,
})

test("a capture set imports once and opens what was imported", async () => {
  const { CaptureImportDialog } = await import("../src/components/capture-import-dialog")
  const asked: string[] = []
  const opened: string[] = []
  let open = true
  await render(
    <CaptureImportDialog
      open
      title="Nhập bộ ảnh"
      description="Mô tả"
      emptyText="Chưa có bộ ảnh."
      sets={{
        isPending: false,
        isError: false,
        error: null,
        data: [set("old", "2026-11-01"), set("new", "2026-11-11")],
      }}
      importedCodes={["old"]}
      describe={(entry) => ({ name: `Bộ ${entry.code}`, counts: `${entry.heroes} tướng` })}
      importSet={async (capturedOn) => {
        asked.push(capturedOn)
        return { id: `capture-${capturedOn}` }
      }}
      onOpenChange={(next) => {
        open = next
      }}
      onImported={(id) => opened.push(id)}
    />,
  )

  const rows = [...document.querySelectorAll("li")]
  assert.match(rows[0]!.textContent!, /Bộ old.*Đã nhập/)
  assert.equal(button("Nhập", rows[0]!), undefined, "An imported set offers no second import")
  await click(button("Nhập", rows[1]!))

  await waitFor(() => opened.length === 1)
  assert.deepEqual(asked, ["2026-11-11"])
  assert.deepEqual(opened, ["capture-2026-11-11"])
  assert.equal(open, false)
})
