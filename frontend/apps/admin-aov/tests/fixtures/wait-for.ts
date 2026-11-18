import assert from "node:assert/strict"
import { act } from "react"

/** How long a condition may take before the test fails. */
const TIMEOUT_MS = 2000
/** How often the condition is checked while waiting. */
const POLL_MS = 5

/**
 * Lets timers and React work run until `condition` holds. Use it for work a library defers to a later task, such as
 * Radix calling `onCloseAutoFocus` from a zero-delay timer after a dialog unmounts: `await act(...)` waits only one
 * `setImmediate`, so whether that timer has fired when it resolves depends on how busy the machine is. Each wait runs
 * inside `act`, so updates made by those timers are flushed before the condition is checked again.
 */
export async function waitFor(condition: () => boolean, message = "Expected UI state was not reached") {
  const deadline = Date.now() + TIMEOUT_MS
  while (!condition()) {
    assert.ok(Date.now() < deadline, message)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    })
  }
}
