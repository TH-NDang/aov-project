import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { render, withDom } from "./fixtures/dom"

withDom({ url: "http://localhost:5175/tournaments/event" })

const { useWorkspaceKeys } = await import("../src/features/competition/workspace/use-workspace-keys")

const calls: string[] = []
function Keys() {
  useWorkspaceKeys({
    save: () => calls.push("save"),
    undo: () => calls.push("undo"),
    redo: () => calls.push("redo"),
    step: (index) => calls.push(`step ${index}`),
  })
  return <input aria-label="Field" />
}

const press = (init: KeyboardEventInit, target: EventTarget = document.body) =>
  act(async () => {
    target.dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }))
  })

test("the workspace saves, steps through its edits and opens a step from the keyboard", async () => {
  calls.length = 0
  const rendered = await render(<Keys />)

  await press({ key: "s", ctrlKey: true })
  await press({ key: "z", ctrlKey: true })
  await press({ key: "Z", ctrlKey: true, shiftKey: true })
  await press({ key: "4", code: "Digit4", altKey: true })

  assert.deepEqual(calls, ["save", "undo", "redo", "step 3"])
  await rendered.unmount()
})

test("undo inside a field stays the browser's own, and saving still works there", async () => {
  calls.length = 0
  const rendered = await render(<Keys />)
  const field = document.querySelector("input")!

  await press({ key: "z", ctrlKey: true }, field)
  await press({ key: "s", ctrlKey: true }, field)

  assert.deepEqual(calls, ["save"])
  await rendered.unmount()
})
