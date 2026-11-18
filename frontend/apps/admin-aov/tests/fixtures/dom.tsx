/**
 * The one browser set-up of the Admin DOM tests. A test file calls `withDom()` once at the top, before it imports any
 * app module, and gets a jsdom window installed as the global browser until its last test ends. `render` mounts a
 * tree inside a fresh query client, `waitFor` waits for a condition and `flush` lets pending work settle.
 */
import assert from "node:assert/strict"
import { after, afterEach } from "node:test"
import { JSDOM, type DOMWindow } from "jsdom"
import * as React from "react"
import { act, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export type DomOptions = {
  /** Address of the page; routers and search params read it. */
  url?: string
  /** Markup of the page body before anything is mounted. */
  html?: string
  /**
   * Globals beyond the browser basics, read from the new window. Observers are left out unless a test asks, because
   * the app checks whether they exist and behaves differently without them.
   */
  globals?: (window: DOMWindow) => Record<string, unknown>
}

export type Dom = { window: DOMWindow; document: Document; close: () => void }

function storageOf(window: DOMWindow, name: "localStorage" | "sessionStorage") {
  try {
    return window[name]
  } catch {
    return undefined
  }
}

/** Constructors and functions every page has; the app and its libraries reach for them as globals. */
function browserBasics(window: DOMWindow): Record<string, unknown> {
  return {
    React,
    window,
    document: window.document,
    navigator: window.navigator,
    // A window without an address has an opaque origin and refuses storage; such tests never use it.
    localStorage: storageOf(window, "localStorage"),
    sessionStorage: storageOf(window, "sessionStorage"),
    HTMLElement: window.HTMLElement,
    HTMLAnchorElement: window.HTMLAnchorElement,
    HTMLButtonElement: window.HTMLButtonElement,
    HTMLFormElement: window.HTMLFormElement,
    HTMLImageElement: window.HTMLImageElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    Element: window.Element,
    Node: window.Node,
    NodeFilter: window.NodeFilter,
    Text: window.Text,
    DocumentFragment: window.DocumentFragment,
    MutationObserver: window.MutationObserver,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    FocusEvent: window.FocusEvent,
    InputEvent: window.InputEvent,
    StorageEvent: window.StorageEvent,
    Image: window.Image,
    getComputedStyle: window.getComputedStyle.bind(window),
    // A window made without pretendToBeVisual has no animation frames; those tests never asked for them.
    requestAnimationFrame: window.requestAnimationFrame?.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame?.bind(window),
    // Node's own channel would carry the session between test files that run at the same time.
    BroadcastChannel: undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
  }
}

/**
 * Installs `values` as globals and returns the function that puts the previous ones back, for a global a test swaps
 * while its window stays, such as an observer or `fetch`.
 */
export function installGlobals(values: Record<string, unknown>): () => void {
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  return () => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

/**
 * Installs `window` as the global browser with the basics every page has, plus `extra` (observers, fetch, overrides).
 * Returns the function that puts the previous globals back. Tests that build their own window use it directly.
 */
export function installWindow(window: DOMWindow, extra: Record<string, unknown> = {}): () => void {
  return installGlobals({ ...browserBasics(window), ...extra })
}

/**
 * Runs `run` with `values` installed as globals and puts the previous ones back afterwards, for modules that read a
 * global while they load, such as the session that opens a BroadcastChannel, or a test that swaps one for its length.
 */
export async function withGlobals<T>(values: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
  const restore = installGlobals(values)
  try {
    return await run()
  } finally {
    restore()
  }
}

/** A jsdom window at `url`, the way every Admin test builds one. */
export const createWindow = (url = "http://localhost/", html = '<div id="root"></div>') =>
  new JSDOM(html, { url, pretendToBeVisual: true })

/** The document of static markup, such as what `renderToStaticMarkup` returns; nothing is installed as a global. */
export const parseHtml = (markup: string) => new JSDOM(markup).window.document

/** The document of an SVG file, read as XML the way a browser reads an image; nothing is installed as a global. */
export const parseSvg = (markup: string) => new JSDOM(markup, { contentType: "image/svg+xml" }).window.document

/** Installs a window as the global browser now; `close` puts the previous globals back. */
export function openDom({ url, html, globals }: DomOptions = {}): Dom {
  const dom = createWindow(url, html)
  const restore = installWindow(dom.window, globals?.(dom.window))

  let closed = false
  return {
    window: dom.window,
    document: dom.window.document,
    close() {
      if (closed) return
      closed = true
      dom.window.close()
      restore()
    },
  }
}

const mounted = new Set<() => Promise<void>>()
const closing: (() => unknown)[] = []

/** Runs `cleanup` after the last test but while the window still exists, such as ending a session. */
export function beforeDomCloses(cleanup: () => unknown) {
  closing.push(cleanup)
}

async function tearDown(dom: Dom) {
  await unmountAll()
  while (closing.length) await closing.pop()!()
  dom.close()
}

async function unmountAll() {
  for (const unmount of [...mounted]) await unmount()
}

/**
 * Installs one window for the whole test file; it closes after the last test. What a test mounts is unmounted when
 * that test ends, so every test starts from an empty page.
 */
export function withDom(options: DomOptions = {}): Dom {
  const dom = openDom(options)
  afterEach(unmountAll)
  after(() => tearDown(dom))
  return dom
}

/** Runs one test in a window of its own, for tests that need a page address or globals no other test shares. */
export async function inDom(options: DomOptions, run: (dom: Dom) => Promise<void>) {
  const dom = openDom(options)
  try {
    await run(dom)
  } finally {
    await tearDown(dom)
  }
}

export function testQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
}

export type RenderOptions = {
  /** The query client to share with the test; a fresh one without retries by default. */
  client?: QueryClient
  /** Wraps the tree, such as in a router or a provider the screen needs. */
  wrap?: (node: ReactNode) => ReactNode
  /** Element to mount in; a new element at the end of the body by default. */
  container?: HTMLElement
}

export type Rendered = {
  container: HTMLElement
  client: QueryClient
  rerender: (node: ReactNode) => Promise<void>
  unmount: () => Promise<void>
}

/**
 * Mounts a tree inside what the app puts around every screen (query client, tooltips, confirm dialog), then lets its
 * first requests settle.
 */
export async function render(node: ReactNode, { client = testQueryClient(), wrap, container }: RenderOptions = {}) {
  const { createRoot } = await import("react-dom/client")
  const { ConfirmDialogHost } = await import("../../src/components/confirm-dialog")
  const { TooltipProvider } = await import("@aov/ui/components/tooltip")
  const host = container ?? document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  const tree = (content: ReactNode) => (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        {wrap ? wrap(content) : content}
        <ConfirmDialogHost />
      </TooltipProvider>
    </QueryClientProvider>
  )

  await act(async () => root.render(tree(node)))
  await flush()

  const unmount = async () => {
    if (!mounted.delete(unmount)) return
    await act(async () => root.unmount())
    client.clear()
    if (!container) host.remove()
  }
  mounted.add(unmount)
  const rendered: Rendered = {
    container: host,
    client,
    rerender: async (next) => {
      await act(async () => root.render(tree(next)))
    },
    unmount,
  }
  return rendered
}

/**
 * A `render` for a test that changes the props of one screen step by step: the first call mounts the tree, later calls
 * draw the new tree in the same root and let it settle.
 */
export function renderer(options: RenderOptions = {}) {
  let view: Rendered | undefined
  return async (node: ReactNode) => {
    if (!view) view = await render(node, options)
    else {
      await view.rerender(node)
      await flush()
    }
    return view
  }
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
// Tests without a page (a query client, a fake service) wait outside act, which React expects only with a window.
const inPage = () => (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT === true

/**
 * Lets resolved requests and the renders they cause finish; it waits for no condition and no fixed time. Without a
 * page it lets a query client deliver what its requests answered.
 */
export async function flush(rounds = 3) {
  for (let round = 0; round < rounds; round++) await (inPage() ? act(tick) : tick())
}

export type WaitOptions = { timeout?: number; message?: string }

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 5))

/**
 * Waits until `condition` returns something other than false, null or undefined, and returns it; a string second
 * argument is the failure message. A condition that
 * throws counts as not met yet; when time runs out the last error, or `message`, fails the test. It works with or
 * without a page, so unit tests of caches and services wait with it too.
 */
export async function waitFor<T>(
  condition: () => T | false | null | undefined,
  options: WaitOptions | string = {},
): Promise<T> {
  const { timeout = 3000, message } = typeof options === "string" ? { message: options } : options
  const deadline = Date.now() + timeout
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
    await (inPage() ? act(pause) : pause())
  }
  if (failure instanceof Error && !message) throw failure
  const page = globalThis.document ? ` Page text: ${globalThis.document.body.textContent ?? ""}` : ""
  assert.fail(message ?? `Condition was not met within ${timeout} ms.${page}`)
}

/** Clicks an element inside act, failing with `what` when it is missing. */
export async function click(element: Element | null | undefined, what = "element") {
  assert.ok(element, `Missing ${what}`)
  await act(async () => (element as HTMLElement).click())
  await flush()
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

/** Sets the value of a field the way a person types it, so React sees the change. */
export async function type(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(field) as object
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  await act(async () => {
    setter?.call(field, value)
    field.dispatchEvent(new window.Event("input", { bubbles: true }))
  })
}

/** Chooses an option of a native select. */
export async function choose(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set
  await act(async () => {
    setter?.call(select, value)
    select.dispatchEvent(new window.Event("change", { bubbles: true }))
  })
}

/** The open confirm dialog of the app, if any. */
export const confirmDialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]')

/** Answers the open confirm dialog with the button that carries `label`. */
export async function answerConfirm(label: string) {
  const dialog = await waitFor(confirmDialog, { message: "No confirm dialog opened" })
  await click(button(label, dialog), `confirm button ${label}`)
}

/** Answers the media queries jsdom leaves out; `matches` decides each query, such as a wide screen for every one. */
export function answerMediaQueries(window: DOMWindow, matches: (query: string) => boolean = () => false) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: matches(query),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }),
  })
}

/** A ResizeObserver that never reports, for screens that only need it to exist. */
export class QuietResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
