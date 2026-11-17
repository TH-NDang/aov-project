import assert from "node:assert/strict"
import { test } from "node:test"
import { render, waitFor, withDom } from "./fixtures/dom"

withDom()

test("an old address keeps its query and hash when it sends the reader to the moved page", async () => {
  const { createMemoryRouter, RouterProvider } = await import("react-router")
  const { MovedRedirect } = await import("../src/app/moved-redirect")
  const router = createMemoryRouter(
    [
      { path: "/image-management", element: <MovedRedirect to="/files" /> },
      { path: "/files", element: <h1>Quản lý tệp</h1> },
    ],
    { initialEntries: ["/image-management?asset=a-1&tab=images#credit"] },
  )

  await render(<RouterProvider router={router} />)

  await waitFor(() => router.state.location.pathname === "/files")
  assert.equal(router.state.location.search, "?asset=a-1&tab=images")
  assert.equal(router.state.location.hash, "#credit")
  assert.equal(router.state.historyAction, "REPLACE", "Back does not return to the old address")
})
