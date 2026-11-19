/**
 * The one browser set-up of Stream's DOM tests. A test file calls `withDom()` once at the top, before it imports a
 * screen, and gets a jsdom window in English installed as the global browser until its last test ends. `renderAt`
 * mounts screens at an address inside a router and a query client, `serve` answers the services' requests, and
 * `click`, `type` and `waitFor` act and wait the way a reader does.
 */
import assert from "node:assert/strict"
import { after, afterEach } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"

/** Constructors and objects of the window that React, the router and the components reach for as globals. */
const WINDOW_GLOBALS = [
  "document",
  "navigator",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "HTMLElement",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLFormElement",
  "HTMLImageElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "Element",
  "Node",
  "Text",
  "DocumentFragment",
  "MutationObserver",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "FocusEvent",
  "InputEvent",
] as const

/** A ResizeObserver that never reports, for menus that only need it to exist. */
class QuietResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mounted = new Set<() => Promise<void>>()

async function unmountAll() {
  for (const unmount of [...mounted]) await unmount()
}

/** Installs one English window for the whole test file. What a test mounts is unmounted when that test ends. */
export function withDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  })
  const window = dom.window
  window.localStorage.setItem("aov-stream-locale", "en")
  const values: Record<string, unknown> = {
    React,
    window,
    fetch: globalThis.fetch,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    ResizeObserver: QuietResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
    ...Object.fromEntries(WINDOW_GLOBALS.map((key) => [key, window[key]])),
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  afterEach(unmountAll)
  after(async () => {
    await unmountAll()
    window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
  return window
}

export type Sent = { method: string; path: string; query: URLSearchParams; body: unknown }
type Answer = unknown | ((sent: Sent) => unknown)

/**
 * Answers the requests of both services from `answers`, keyed by method and path below the service root, such as
 * `GET /me/follows`; a value is sent as JSON, a function answers from the request, anything unlisted is a 404. Returns
 * every request sent, in order.
 */
export function serve(answers: Record<string, Answer>) {
  const sent: Sent[] = []
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost/")
    const request: Sent = {
      method: init.method ?? "GET",
      path: url.pathname.replace(/^\/api\/(community|wiki)\/v1/, ""),
      query: url.searchParams,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    }
    sent.push(request)
    const answer = answers[`${request.method} ${request.path}`]
    if (answer === undefined) return Response.json({ code: "NOT_FOUND" }, { status: 404 })
    const value = typeof answer === "function" ? await (answer as (sent: Sent) => unknown)(request) : answer
    if (value instanceof Response) return value
    return value === undefined ? new Response(null, { status: 204 }) : Response.json(value)
  }) as typeof fetch
  return { sent, to: (key: string) => sent.filter((request) => `${request.method} ${request.path}` === key) }
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Lets resolved requests and the renders they cause finish; it waits for no condition and no fixed time. */
export async function flush(rounds = 3) {
  for (let round = 0; round < rounds; round++) await act(tick)
}

function CurrentLocation() {
  const { pathname, search } = useLocation()
  return <output className="test-location">{pathname + search}</output>
}

/** Where the router is now, as path and query. */
export const currentLocation = () => document.querySelector(".test-location")?.textContent ?? ""

/** Mounts `routes` at the address `path`, inside a router and a fresh query client without retries. */
export async function renderAt(path: string, routes: Record<string, ReactNode>) {
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            {Object.entries(routes).map(([route, element]) => (
              <Route key={route} path={route} element={element} />
            ))}
          </Routes>
          <CurrentLocation />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  )
  await flush()
  const unmount = async () => {
    if (!mounted.delete(unmount)) return
    await act(async () => root.unmount())
    client.clear()
    host.remove()
  }
  mounted.add(unmount)
  return { container: host, client, unmount }
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 5))

/**
 * Waits until `condition` returns something other than false, null or undefined, and returns it. A condition that
 * throws counts as not met yet; when time runs out the last error, or `message`, fails the test.
 */
export async function waitFor<T>(condition: () => T | false | null | undefined, message?: string): Promise<T> {
  const deadline = Date.now() + 3000
  let failure: unknown
  for (;;) {
    try {
      const value = condition()
      if (value !== false && value !== null && value !== undefined) return value
      failure = undefined
    } catch (error) {
      failure = error
    }
    if (Date.now() > deadline) break
    await act(pause)
  }
  if (failure instanceof Error && !message) throw failure
  assert.fail(message ?? `Condition was not met. Page text: ${pageText()}`)
}

/** The button or link whose text or accessible name is `label`, or else the first one that contains it. */
export function control(label: string, scope: ParentNode = document) {
  const controls = [...scope.querySelectorAll<HTMLElement>("button, a, [role=menuitem]")]
  const named = (candidate: HTMLElement) => [candidate.textContent?.trim(), candidate.getAttribute("aria-label")]
  return (
    controls.find((candidate) => named(candidate).includes(label)) ??
    controls.find((candidate) => named(candidate).some((name) => name?.includes(label)))
  )
}

/** The field whose label starts with `label`. */
export function field<Field extends Element = HTMLInputElement>(label: string, scope: ParentNode = document) {
  const found = [...scope.querySelectorAll("label")].find((candidate) =>
    candidate.textContent?.trim().startsWith(label),
  )
  const input = found?.querySelector<Field>("input, textarea, select")
  assert.ok(input, `Missing field ${label}`)
  return input
}

/** Clicks an element inside act, failing with `what` when it is missing. */
export async function click(element: Element | null | undefined, what = "element") {
  assert.ok(element, `Missing ${what}`)
  await act(async () => (element as HTMLElement).click())
  await flush()
}

/** Presses a key on an element, such as Enter on a menu button. */
export async function press(element: Element | null | undefined, key: string, what = "element") {
  assert.ok(element, `Missing ${what}`)
  await act(async () => element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })))
  await flush()
}

/** Sets the value of a field the way a person types or picks it, so React sees the change. */
export async function type(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input) as object, "value")?.set
  await act(async () => {
    setter?.call(input, value)
    input.dispatchEvent(
      new window.Event(input instanceof window.HTMLSelectElement ? "change" : "input", { bubbles: true }),
    )
  })
}

/** The text of the page, with runs of white space read as one space. */
export const pageText = () => (document.body.textContent ?? "").replace(/\s+/g, " ")
