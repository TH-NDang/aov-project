import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { MediaDeletion } from "../src/features/media/model/media-deletion"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

test("image deletion requires verified references and confirmation, survives reload and refreshes the library", async () => {
  const dom = createWindow("http://localhost/image-management")
  let restoreGlobals = () => {}
  let capabilities = ["catalog:read", "media:write"]
  let competitionCapabilities = ["tournament:read", "tournament:write"]
  let references = 1
  let statusUnavailable = true
  let progress: MediaDeletion | null = null
  let completeCount = 0
  let releaseDeletion: (() => void) | undefined
  const posts: { expectedVersion: number; reason: string }[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input), "http://localhost").pathname
    if (path.endsWith("/auth/refresh")) return Response.json({ accessToken: "test", expiresIn: 3600 })
    if (path.endsWith("/auth/logout")) return new Response(null, { status: 204 })
    if (path === "/api/wiki/v1/admin/me")
      return Response.json({ issuer: "fixture", subject: "editor", type: "HUMAN", capabilities })
    if (path === "/api/community/v1/admin/me") return Response.json({ capabilities: competitionCapabilities })
    if (path.endsWith("/users/me")) return Response.json({ locale: "vi-VN" })
    if (path.endsWith("/deletion")) {
      if (statusUnavailable) return Response.json({ code: "UNAVAILABLE", status: 503 }, { status: 503 })
      return progress
        ? Response.json(progress)
        : Response.json({ code: "MEDIA_DELETION_NOT_FOUND", status: 404 }, { status: 404 })
    }
    if (path.endsWith("/usages")) return Response.json({ counts: { current: 0, draft: 0, historical: 0 } })
    if (path.endsWith("/usage")) return Response.json({ references })
    if (path.endsWith("/delete")) {
      assert.equal(init?.method, "POST")
      posts.push(JSON.parse(String(init.body)))
      await new Promise<void>((resolve) => {
        releaseDeletion = resolve
      })
      progress = {
        assetId: "sample",
        state: posts.length === 1 ? "ORIGIN_DELETED" : "COMPLETE",
        expectedVersion: 7,
        objects: 2,
        publicUrls: 2,
        lastError: posts.length === 1 ? "MEDIA_CACHE_PURGE_FAILED" : null,
        requestedAt: "2026-11-01T12:00:00Z",
        completedAt: posts.length === 1 ? null : "2026-11-01T12:01:00Z",
      }
      return posts.length === 1
        ? Response.json({ code: "MEDIA_CACHE_PURGE_FAILED", status: 502 }, { status: 502 })
        : Response.json(progress)
    }
    throw new Error(`Unexpected request: ${path}`)
  }
  restoreGlobals = installWindow(dom.window, {
    fetch: fetcher,
  })
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { ImageDeleteAction } = await import("../src/features/media/components/library/image-delete-action")
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document

  const button = (text: string, scope: ParentNode = document) =>
    [...scope.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!
  const dialog = () => document.querySelector('[role="dialog"]')!
  const render = async (key: string, state = "ACTIVE", version = 7) => {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <ImageDeleteAction
            key={key}
            asset={{
              id: "sample",
              semanticType: "OTHER",
              version,
              state,
              currentUrl: "/sample.png",
              currentVersionId: "v2",
            }}
            label="Ảnh kiểm tra"
            versionCount={2}
            onBusyChange={() => {}}
            onDeleted={() => {
              completeCount++
            }}
          />
        </QueryClientProvider>,
      ),
    )
  }
  try {
    await verifySession()
    await render("initial")
    await waitFor(() => !!button("Xóa ảnh"))
    await act(async () => button("Xóa ảnh").click())
    await waitFor(() => !!document.querySelector('[role="alert"]'))
    assert.equal(button("Xóa vĩnh viễn").disabled, true)
    assert.equal(posts.length, 0)

    statusUnavailable = false
    await act(async () => button("Kiểm tra lại").click())
    await waitFor(() => document.body.textContent!.includes("Ảnh còn 1 liên kết"))
    assert.equal(button("Xóa vĩnh viễn").disabled, true)
    references = 0
    await act(async () => button("Kiểm tra lại").click())
    await waitFor(() => document.body.textContent!.includes("Ảnh không còn liên kết sử dụng."))
    assert.equal(button("Xóa vĩnh viễn").disabled, true)
    await act(async () => {
      const textarea = document.querySelector("textarea")!
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")!.set!.call(
        textarea,
        "  Ảnh tải thử  ",
      )
      textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    assert.equal(button("Xóa vĩnh viễn").disabled, true)
    await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await waitFor(() => !button("Xóa vĩnh viễn").disabled)
    await act(async () => {
      button("Xóa vĩnh viễn").click()
      button("Xóa vĩnh viễn").click()
    })
    await waitFor(() => posts.length === 1)
    assert.deepEqual(posts[0], { expectedVersion: 7, reason: "Ảnh tải thử" })
    assert.equal(button("Hủy").disabled, true)
    await act(async () => releaseDeletion!())
    await waitFor(() => document.body.textContent!.includes("Còn bước dọn bản ảnh lưu đệm."))
    assert.equal(completeCount, 0)

    // Recreate the component and clear its cached progress as a browser reload would.
    await act(async () => root.render(<></>))
    client.removeQueries({ queryKey: ["media-deletion", "sample"] })
    client.setQueryData(["media", "list", "library"], { pages: [] })
    await render("resumed", "BLOCKED", 8)
    await waitFor(() => !!button("Tiếp tục xóa"))
    await act(async () => button("Tiếp tục xóa").click())
    await waitFor(() => !!dialog() && !button("Tiếp tục xóa", dialog()).disabled)
    assert.equal(document.querySelector("textarea"), null)
    await act(async () => button("Tiếp tục xóa", dialog()).click())
    await waitFor(() => posts.length === 2)
    assert.equal(posts[1].expectedVersion, 7)
    await act(async () => releaseDeletion!())
    await waitFor(() => completeCount === 1)
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(client.getQueryState(["media", "list", "library"])?.isInvalidated, true)

    progress = null
    client.removeQueries({ queryKey: ["media-deletion", "sample"] })
    competitionCapabilities = ["tournament:read"]
    client.setQueryData(["community", "tournaments", "me", "fixture:editor"], { capabilities: competitionCapabilities })
    await render("no-competition-write")
    await act(async () => button("Xóa ảnh").click())
    await waitFor(() => document.body.textContent!.includes("Cần quyền chỉnh sửa ảnh"))
    assert.equal(button("Xóa vĩnh viễn").disabled, true)
    assert.equal(posts.length, 2)

    capabilities = ["catalog:read"]
    await act(async () => {
      await verifySession()
    })
    await render("reader")
    assert.equal(button("Xóa ảnh"), undefined)
    assert.equal(posts.length, 2)
  } finally {
    await act(async () => root.unmount())
    await logout()
    client.clear()
    dom.window.close()
    restoreGlobals()
  }
})
