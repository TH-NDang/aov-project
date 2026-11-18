import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router"
import { createWindow, flush, installWindow } from "./fixtures/dom"

const dom = createWindow("http://localhost/", '<div id="root"></div><button id="origin">Origin</button>')
installWindow(dom.window)

const document = dom.window.document

async function mounted(element: React.ReactNode) {
  const { createRoot } = await import("react-dom/client")
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(element))
  await flush()
  return async () => {
    await act(async () => root.unmount())
    host.remove()
  }
}

const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]')

function dialogButton(label: string) {
  const button = [...(dialog()?.querySelectorAll("button") ?? [])].find((entry) => entry.textContent === label)
  assert.ok(button, `Expected "${label}" in the dialog`)
  return button
}

async function click(element: HTMLElement) {
  await act(async () => element.click())
  await flush()
}

test("the shared question is red, opens on Cancel, answers once and returns focus", async () => {
  const { ConfirmDialogHost, confirmAction } = await import("../src/components/confirm-dialog")
  const unmount = await mounted(<ConfirmDialogHost />)
  const origin = document.getElementById("origin")!
  const options = {
    title: "Hủy bản nháp này?",
    description: "Bản đã xuất bản vẫn được giữ lại.",
    confirmLabel: "Xác nhận",
  }
  // Wrapped so awaiting the dialog opening does not also wait for its answer.
  const ask = async (custom: Parameters<typeof confirmAction>[0] = options) => {
    let answer: Promise<boolean> | undefined
    await act(async () => {
      answer = confirmAction(custom)
    })
    await flush()
    return { answer: answer! }
  }

  try {
    origin.focus()
    const refused = await ask({ ...options, confirmLabel: "Hủy bản nháp", cancelLabel: "Giữ bản nháp" })
    assert.match(dialog()!.textContent!, /Hủy bản nháp này\?/)
    assert.match(dialog()!.textContent!, /Bản đã xuất bản vẫn được giữ lại\./)
    assert.match(dialogButton("Hủy bản nháp").className, /bg-destructive/, "The action must read as dangerous")
    assert.equal(document.activeElement, dialogButton("Giữ bản nháp"), "A stray Enter must keep the user's work")
    await click(dialogButton("Giữ bản nháp"))
    assert.equal(await refused.answer, false)
    assert.equal(dialog(), null)
    assert.equal(document.activeElement, origin, "Focus returns to where the question was asked")

    const accepted = await ask()
    assert.equal(document.activeElement, dialogButton("Hủy"), "Cancel keeps its default label")
    await click(dialogButton(options.confirmLabel))
    assert.equal(await accepted.answer, true)

    const escaped = await ask()
    await act(async () => {
      document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    await flush()
    assert.equal(await escaped.answer, false, "Escape is a refusal")
    assert.equal(dialog(), null)

    const replaced = await ask()
    const newest = await ask({ ...options, title: "Câu hỏi mới hơn?", confirmLabel: "Đồng ý" })
    assert.equal(await replaced.answer, false, "A newer question cancels the one still open")
    assert.match(dialog()!.textContent!, /Câu hỏi mới hơn\?/)
    await click(dialogButton("Đồng ý"))
    assert.equal(await newest.answer, true)
    assert.equal(document.activeElement, origin, "Replacing a question keeps the original focus target")
  } finally {
    await unmount()
  }
})

test("closing a tab waits for the answer and keeps the tab when refused", async () => {
  const { ConfirmDialogHost, confirmDiscard } = await import("../src/components/confirm-dialog")
  const { PageTabPanels, PageTabsProvider, usePageCloseGuard, usePageTabs } =
    await import("../src/app/layout/page-tabs")
  const { HotkeysProvider } = await import("../src/app/hotkeys")

  function Page() {
    usePageCloseGuard(() => confirmDiscard({ title: "Đóng trang?", description: "Có thay đổi chưa lưu." }))
    return <p>Dirty page</p>
  }
  function Tabs() {
    const { sessions, closeTab } = usePageTabs()
    return (
      <>
        {sessions.map((session) => (
          <button key={session.path} data-close={session.path} onClick={() => closeTab(session.path)}>
            Close {session.path}
          </button>
        ))}
      </>
    )
  }
  const router = createMemoryRouter(
    [
      {
        element: (
          <HotkeysProvider>
            <PageTabsProvider>
              <Tabs />
              <PageTabPanels />
            </PageTabsProvider>
          </HotkeysProvider>
        ),
        children: [
          { path: "/", element: <p>Home</p> },
          { path: "/dirty", element: <Page /> },
        ],
      },
    ],
    { initialEntries: ["/"] },
  )
  const unmount = await mounted(
    <>
      <RouterProvider router={router} />
      <ConfirmDialogHost />
    </>,
  )
  const closeButton = () => document.querySelector<HTMLElement>('[data-close="/dirty"]')

  try {
    await act(async () => {
      await router.navigate("/dirty")
    })
    await flush()
    await click(closeButton()!)
    assert.ok(dialog(), "Closing a dirty tab asks first")
    assert.ok(closeButton(), "The tab stays open while the question is unanswered")

    await click(dialogButton("Ở lại chỉnh sửa"))
    assert.ok(closeButton(), "Refusing keeps the tab")
    assert.equal(router.state.location.pathname, "/dirty")

    await click(closeButton()!)
    await click(dialogButton("Bỏ thay đổi"))
    assert.equal(closeButton(), null, "Accepting closes the tab")
    assert.equal(router.state.location.pathname, "/")
  } finally {
    await unmount()
  }
})

test("browser Back waits for the answer while edits are unsaved", async () => {
  const { ConfirmDialogHost } = await import("../src/components/confirm-dialog")
  const { HeroNavigationGuard } = await import("../src/features/publishing/components/hero-navigation-guard")
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <HeroNavigationGuard unsafe busy={false} />
            <Outlet />
          </>
        ),
        children: [
          { path: "/list", element: <p>List</p> },
          { path: "/edit", element: <p>Edit</p> },
        ],
      },
    ],
    { initialEntries: ["/list", "/edit"], initialIndex: 1 },
  )
  const unmount = await mounted(
    <>
      <RouterProvider router={router} />
      <ConfirmDialogHost />
    </>,
  )
  const back = async () => {
    await act(async () => {
      await router.navigate(-1)
    })
    await flush()
  }

  try {
    await back()
    assert.ok(dialog(), "Back asks before dropping unsaved edits")
    assert.equal(router.state.location.pathname, "/edit")

    await click(dialogButton("Ở lại chỉnh sửa"))
    assert.equal(router.state.location.pathname, "/edit", "Refusing stays on the page")

    await back()
    await click(dialogButton("Bỏ thay đổi"))
    assert.equal(router.state.location.pathname, "/list", "Accepting finishes the navigation")
    assert.equal(dialog(), null)
  } finally {
    await unmount()
  }
})
