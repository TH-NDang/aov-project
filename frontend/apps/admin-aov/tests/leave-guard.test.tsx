import assert from "node:assert/strict"
import { test } from "node:test"
import { answerConfirm, click, confirmDialog, render, waitFor, withDom } from "./fixtures/dom"

withDom()

async function guardedPage() {
  const { createMemoryRouter, Link, RouterProvider, useSearchParams } = await import("react-router")
  const { confirmDiscard } = await import("../src/components/confirm-dialog")
  const { leavingPage, useLeaveGuard } = await import("../src/hooks/use-leave-guard")
  function Editor() {
    const [, setParams] = useSearchParams()
    useLeaveGuard(leavingPage(true), () =>
      confirmDiscard({ title: "Rời trang?", description: "Bạn đang có thay đổi chưa lưu." }),
    )
    return (
      <>
        <h1>Trang sửa</h1>
        <button type="button" onClick={() => setParams({ tab: "next" })}>
          Đổi tab
        </button>
        <Link to="/other">Trang khác</Link>
      </>
    )
  }
  const router = createMemoryRouter(
    [
      { path: "/editor", element: <Editor /> },
      { path: "/other", element: <h1>Trang khác</h1> },
    ],
    { initialEntries: ["/editor"] },
  )
  await render(<RouterProvider router={router} />)
  return router
}

const link = () => document.querySelector<HTMLAnchorElement>('a[href="/other"]')

test("leaving a page with unsaved edits asks and stays when the editor refuses", async () => {
  const router = await guardedPage()

  await click(link(), "link")
  await waitFor(confirmDialog)
  await answerConfirm("Ở lại chỉnh sửa")

  await waitFor(() => !confirmDialog())
  assert.equal(router.state.location.pathname, "/editor")
})

test("leaving a page with unsaved edits goes on once the editor accepts", async () => {
  const router = await guardedPage()

  await click(link(), "link")
  await answerConfirm("Bỏ thay đổi")

  await waitFor(() => router.state.location.pathname === "/other")
})

test("changing the query string of the same page does not ask", async () => {
  const router = await guardedPage()

  await click([...document.querySelectorAll("button")].find((node) => node.textContent === "Đổi tab"))

  await waitFor(() => router.state.location.search === "?tab=next")
  assert.equal(confirmDialog(), null)
})
