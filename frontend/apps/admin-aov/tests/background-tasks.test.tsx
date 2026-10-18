import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act, useEffect, useState } from "react"
import { MemoryRouter, useNavigate } from "react-router"
import { BackgroundTasksProvider, useBackgroundTasks } from "../src/app/background-tasks"
import { PersistentWorkspace } from "../src/app/layout/persistent-workspace"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ImportJob } from "../src/features/publishing/import-jobs"

test("server dismissals survive fresh clients and reconcile failures without hiding new or running work", async () => {
  const originals = new Map<string, PropertyDescriptor | undefined>()
  let actor = { issuer: "test-issuer", subject: "editor", capabilities: ["hero:write"] }
  const job: ImportJob = {
    id: "completed-job",
    status: "COMPLETED",
    completed: 2,
    total: 2,
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:01:00Z",
    notificationDismissed: false,
    results: [],
  }
  const server = new Map<string, ImportJob[]>([
    ["editor", [job]],
    ["other-editor", [{ ...job }]],
  ])
  let failure: "none" | "offline" | "lost-response" = "none"
  let release: (() => void) | undefined
  let delay = false
  let requests = 0
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input)
    if (path.endsWith("/auth/refresh")) return Response.json({ accessToken: "test-token", expiresIn: 3600 })
    if (path.endsWith("/admin/me")) return Response.json(actor)
    if (path.endsWith("/auth/logout")) return new Response(null, { status: 204 })
    if (path.endsWith("/import/jobs")) return Response.json(server.get(actor.subject) ?? [])
    if (path.endsWith("/notification-dismissal")) {
      assert.equal(init?.method, "PUT")
      requests++
      const subject = actor.subject
      if (delay)
        await new Promise<void>((resolve) => {
          release = resolve
        })
      if (failure === "offline") throw new Error("Offline")
      const id = path.split("/").at(-2)
      const saved = server
        .get(subject)!
        .map((item) => (item.id === id ? { ...item, notificationDismissed: true } : item))
      server.set(subject, saved)
      if (failure === "lost-response") throw new Error("Response lost")
      return Response.json(saved.find((item) => item.id === id))
    }
    throw new Error(`Unexpected test request: ${path}`)
  }
  const setGlobal = (key: string, value: unknown) => {
    if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  let dom: JSDOM
  const openWindow = () => {
    dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing/import" })
    Object.defineProperty(dom.window, "matchMedia", {
      value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    })
    for (const [key, value] of Object.entries({
      React,
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement,
      localStorage: dom.window.localStorage,
      sessionStorage: dom.window.sessionStorage,
      BroadcastChannel: undefined,
      fetch: fetcher,
      IS_REACT_ACT_ENVIRONMENT: true,
    }))
      setGlobal(key, value)
  }
  openWindow()
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { BackgroundTaskStatus } = await import("../src/app/layout/background-task-status")
  const { SidebarProvider } = await import("@aov/ui/components/sidebar")
  const { createRoot } = await import("react-dom/client")
  const newCache = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    })
  let cache = newCache()
  let root = createRoot(dom!.window.document.getElementById("root")!)
  const mount = async () =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            <BackgroundTasksProvider>
              <SidebarProvider>
                <BackgroundTaskStatus />
              </SidebarProvider>
            </BackgroundTasksProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
  const count = () => dom!.window.document.querySelectorAll('li > a[href="/publishing/import"]').length
  const button = () => dom!.window.document.querySelector<HTMLButtonElement>("li > button[aria-label]")
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    }
    assert.ok(condition(), "Expected UI state was not reached")
  }
  const refresh = async () =>
    act(async () => {
      await cache.refetchQueries({ queryKey: ["hero-import-jobs"] })
    })
  const click = async () => act(async () => button()!.click())
  try {
    await verifySession()
    const legacyKey = "dismissed-imports:test-issuer:editor"
    dom!.window.localStorage.setItem(legacyKey, JSON.stringify([JSON.stringify([job.id, job.status])]))
    await mount()
    await waitFor(() => count() === 1)
    assert.equal(requests, 0, "Legacy local preferences must not silently write to the server")
    await click()
    await waitFor(() => count() === 0)
    assert.equal(server.get("editor")![0].notificationDismissed, true)

    // A reload uses a fresh query cache and reads the server again.
    await act(async () => root.unmount())
    cache.clear()
    cache = newCache()
    root = createRoot(dom!.window.document.getElementById("root")!)
    await mount()
    await refresh()
    assert.equal(count(), 0)

    // Another browser has neither the original local storage nor the original cache.
    await act(async () => root.unmount())
    cache.clear()
    dom!.window.close()
    openWindow()
    cache = newCache()
    root = createRoot(dom!.window.document.getElementById("root")!)
    await mount()
    await refresh()
    assert.equal(dom!.window.localStorage.length, 0)
    assert.equal(count(), 0)

    server.set("editor", [{ ...job, status: "RUNNING", notificationDismissed: true }])
    await refresh()
    await waitFor(() => count() === 1)
    assert.ok(dom!.window.document.querySelector('[role="progressbar"]'))
    assert.equal(button(), null, "Running jobs cannot be dismissed even with a stale dismissal flag")

    server.set("editor", [{ ...job, id: "new-job" }])
    await refresh()
    await waitFor(() => button() !== null)
    failure = "offline"
    await click()
    await waitFor(() => dom!.window.document.querySelector('[role="alert"]') !== null)
    assert.equal(count(), 1, "A failed save must keep the notification visible for retry")
    assert.equal(server.get("editor")![0].notificationDismissed, false)
    failure = "none"
    await click()
    await waitFor(() => count() === 0)

    // A dismissal made in another tab/browser arrives through the existing polling query.
    server.set("editor", [{ ...job, id: "remote-job" }])
    await refresh()
    await waitFor(() => count() === 1)
    server.set("editor", [{ ...job, id: "remote-job", notificationDismissed: true }])
    await refresh()
    await waitFor(() => count() === 0)

    server.set("editor", [{ ...job, id: "uncertain-job" }])
    await refresh()
    await waitFor(() => count() === 1)
    failure = "lost-response"
    await click()
    await waitFor(() => count() === 0)
    assert.equal(dom!.window.document.querySelector('[role="alert"]'), null)
    failure = "none"

    server.set("editor", [{ ...job, id: "pending-job" }])
    await refresh()
    await waitFor(() => count() === 1)
    delay = true
    await click()
    await waitFor(() => release !== undefined)
    assert.equal(count(), 1, "Do not hide before the server acknowledges the write")
    await waitFor(() => button()!.disabled)
    actor = { ...actor, subject: "other-editor" }
    await act(async () => verifySession())
    await waitFor(() => button() !== null && !button()!.disabled)
    release!()
    await waitFor(() => server.get("editor")![0].notificationDismissed)
    assert.equal(count(), 1, "A previous account's pending mutation must not hide the current account's job")
    delay = false
    actor = { ...actor, subject: "editor" }
    await act(async () => verifySession())
    await refresh()
    await waitFor(() => count() === 0)
  } finally {
    release?.()
    await act(async () => root.unmount())
    await logout()
    cache.clear()
    dom!.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

test("background work survives route exit and returns with progress and result intact", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing/import" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  let mounts = 0
  let unmounts = 0
  function Runner() {
    const { updateTask } = useBackgroundTasks()
    const [result, setResult] = useState("Ready")
    useEffect(() => {
      mounts++
      return () => {
        unmounts++
      }
    }, [])
    return (
      <button
        id="run"
        onClick={async () => {
          setResult("Running")
          const task = {
            id: "import",
            title: "Import",
            path: "/publishing/import",
            description: "Saving",
            completed: 0,
            total: 2,
          }
          updateTask({ ...task, status: "running" })
          await pending
          updateTask({ ...task, status: "completed", completed: 2 })
          setResult("Saved 2")
        }}
      >
        {result}
      </button>
    )
  }
  function Controls() {
    const navigate = useNavigate()
    const { tasks } = useBackgroundTasks()
    return (
      <>
        <button id="leave" onClick={() => navigate("/profile")}>
          Leave
        </button>
        <button id="return" onClick={() => navigate("/publishing/import")}>
          Return
        </button>
        <output>{tasks.map((task) => `${task.status}:${task.completed}/${task.total}`).join()}</output>
      </>
    )
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const click = async (id: string) =>
    act(async () => {
      dom.window.document.getElementById(id)!.click()
    })
  try {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/publishing/import"]}>
          <BackgroundTasksProvider>
            <Controls />
            <PersistentWorkspace path="/publishing/import">
              <Runner />
            </PersistentWorkspace>
          </BackgroundTasksProvider>
        </MemoryRouter>,
      )
    })
    await click("run")
    await click("leave")
    assert.equal(dom.window.document.querySelector("[data-workspace]")!.hasAttribute("hidden"), true)
    assert.equal(unmounts, 0)
    assert.equal(dom.window.document.querySelector("output")!.textContent, "running:0/2")
    const warning = new dom.window.Event("beforeunload", { cancelable: true })
    dom.window.dispatchEvent(warning)
    assert.equal(warning.defaultPrevented, true)
    await act(async () => {
      finish()
      await pending
    })
    assert.equal(dom.window.document.querySelector("output")!.textContent, "completed:2/2")
    await click("return")
    assert.equal(dom.window.document.querySelector("[data-workspace]")!.hasAttribute("hidden"), false)
    assert.equal(dom.window.document.getElementById("run")!.textContent, "Saved 2")
    assert.equal(mounts, 1)
    const finished = new dom.window.Event("beforeunload", { cancelable: true })
    dom.window.dispatchEvent(finished)
    assert.equal(finished.defaultPrevented, false)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
