import assert from "node:assert/strict"
import { test } from "node:test"
import { button, click, render, withDom } from "./fixtures/dom"

withDom()

test("a failed read says why and offers to read again", async () => {
  const { ErrorState } = await import("../src/components/query-state")
  let retried = 0
  await render(<ErrorState error={new Error("Máy chủ không trả lời.")} onRetry={() => retried++} />)

  assert.equal(document.querySelector('[role="alert"]')!.textContent, "Máy chủ không trả lời.Thử lại")
  await click(button("Thử lại"))

  assert.equal(retried, 1)
})

test("a failed read with nothing to retry shows only its message", async () => {
  const { ErrorState } = await import("../src/components/query-state")
  await render(<ErrorState message="Không đọc được danh sách." />)

  assert.equal(document.querySelector('[role="alert"]')!.textContent, "Không đọc được danh sách.")
  assert.equal(button("Thử lại"), undefined)
})
