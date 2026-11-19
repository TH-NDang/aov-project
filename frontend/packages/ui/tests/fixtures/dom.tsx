/**
 * The one browser set-up of the shared library's DOM tests. A test file calls `withDom()` once at the top, before it
 * imports a component, and gets a jsdom window installed as the global browser until its last test ends. `render`
 * mounts a tree, `click` and `type` act the way a reader does, and `waitFor` waits for a condition.
 */
import assert from "node:assert/strict"
import { after, afterEach } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act, type ReactNode } from "react"

/** Constructors and objects of the window that React and the components reach for as globals. */
const WINDOW_GLOBALS = [
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLFormElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "Element",
  "Node",
  "Text",
  "DocumentFragment",
  "MutationObserver",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "InputEvent",
] as const

const mounted = new Set<() => Promise<void>>()

async function unmountAll() {
  for (const unmount of [...mounted]) await unmount()
}

/** Installs one window for the whole test file. What a test mounts is unmounted when that test ends. */
export function withDom(url = "http://localhost/") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url, pretendToBeVisual: true })
  const window = dom.window
  const values: Record<string, unknown> = {
    React,
    window,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
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

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Lets resolved promises and the renders they cause finish; it waits for no condition and no fixed time. */
export async function flush(rounds = 3) {
  for (let round = 0; round < rounds; round++) await act(tick)
}

/** Mounts a tree in a new element at the end of the body, then lets its first requests settle. */
export async function render(node: ReactNode) {
  const { createRoot } = await import("react-dom/client")
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  await act(async () => root.render(node))
  await flush()
  const unmount = async () => {
    if (!mounted.delete(unmount)) return
    await act(async () => root.unmount())
    host.remove()
  }
  mounted.add(unmount)
  return { container: host, unmount }
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
  assert.fail(message ?? `Condition was not met. Page text: ${document.body.textContent ?? ""}`)
}

/** The button whose text or accessible name is `label`, or else the first one that contains it. */
export function button(label: string, scope: ParentNode = document) {
  const buttons = [...scope.querySelectorAll<HTMLButtonElement>("button")]
  const named = (candidate: HTMLButtonElement) => [candidate.textContent?.trim(), candidate.getAttribute("aria-label")]
  return (
    buttons.find((candidate) => named(candidate).includes(label)) ??
    buttons.find((candidate) => named(candidate).some((name) => name?.includes(label)))
  )
}

/** The field whose label reads `label`. */
export function field(label: string, scope: ParentNode = document) {
  const labels = [...scope.querySelectorAll("label")]
  const found = labels.find((candidate) => candidate.textContent?.trim() === label)
  assert.ok(found, `Missing field ${label}`)
  const input = found.htmlFor ? document.getElementById(found.htmlFor) : found.querySelector("input, textarea, select")
  assert.ok(input, `Field ${label} has no input`)
  return input as HTMLInputElement
}

/** Clicks an element inside act, failing with `what` when it is missing. */
export async function click(element: Element | null | undefined, what = "element") {
  assert.ok(element, `Missing ${what}`)
  await act(async () => (element as HTMLElement).click())
  await flush()
}

/** Sets the value of a field the way a person types it, so React sees the change. */
export async function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input) as object, "value")?.set
  await act(async () => {
    setter?.call(input, value)
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
  })
}

/** The text of the page, with runs of white space read as one space. */
export const pageText = () => (document.body.textContent ?? "").replace(/\s+/g, " ")
