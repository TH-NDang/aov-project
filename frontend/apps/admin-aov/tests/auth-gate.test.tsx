import assert from "node:assert/strict"
import { test } from "node:test"
import { button, click, render, type, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json } from "./fixtures/network"

const backend = fakeBackend((request) =>
  request.pathname === "/auth/refresh" ? json({ code: "AUTH_SESSION_EXPIRED", status: 401 }, 401) : undefined,
)
withDom({ globals: () => ({ fetch: backend.fetch }) })

test("the two-step code field keeps only digits", async () => {
  const { verifySession } = await import("../src/app/auth/session")
  const { AuthGate } = await import("../src/app/auth/auth-gate")
  await verifySession()
  await render(
    <AuthGate>
      <p>Đã đăng nhập</p>
    </AuthGate>,
  )
  await click(await waitFor(() => button("Đăng nhập tài khoản")))
  const code = await waitFor(() => document.querySelector<HTMLInputElement>("#admin-otp"))

  await type(code, "12a3-b4D5")

  assert.equal(code.value, "12345")
})
