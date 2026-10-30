import { createContext, useContext, useEffect, useSyncExternalStore, type RefObject } from "react"
import { ImageIcon } from "lucide-react"
import type { PageTabPreviewStore } from "./page-tab-preview-store"

export const PageTabPreviewContext = createContext<PageTabPreviewStore | null>(null)

// Preview the top of each page consistently, including when its live scroll position changes.
export function createPreviewFilter(panel: HTMLElement, signal: AbortSignal) {
  const bounds = panel.getBoundingClientRect()
  const scrollOffsets = new WeakMap<Element, { x: number; y: number }>()
  const scrollOffset = (element: Element): { x: number; y: number } => {
    const cached = scrollOffsets.get(element)
    if (cached) return cached
    const parent = element.parentElement
    const inherited = parent && panel.contains(parent) ? scrollOffset(parent) : { x: 0, y: 0 }
    const offset = { x: inherited.x + element.scrollLeft, y: inherited.y + element.scrollTop }
    scrollOffsets.set(element, offset)
    return offset
  }
  return (node: HTMLElement) => {
    if (signal.aborted) return false
    if (!(node instanceof Element)) return true
    if (node.matches('script, style, iframe, video, canvas, input[type="password"], [data-preview-exclude]'))
      return false
    const rect = node.getBoundingClientRect()
    if (!rect.width && !rect.height) return getComputedStyle(node).display === "contents"
    const offset = node.parentElement ? scrollOffset(node.parentElement) : { x: 0, y: 0 }
    return rect.top + offset.y < bounds.bottom && rect.left + offset.x < bounds.right
  }
}

async function capturePagePreview(panel: HTMLElement, signal: AbortSignal) {
  const { toSvg } = await import("html-to-image")
  if (signal.aborted || panel.hidden || !panel.isConnected) return null
  const { width, height } = panel.getBoundingClientRect()
  if (!width || !height) return null
  const backgroundColor = getComputedStyle(document.body).backgroundColor
  const svg = await toSvg(panel, {
    width,
    height,
    skipFonts: true,
    includeQueryParams: true,
    backgroundColor,
    filter: createPreviewFilter(panel, signal),
    fetchRequestInit: { signal },
    imagePlaceholder: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E",
    style: { overflow: "hidden", pointerEvents: "none" },
  })
  if (signal.aborted) return null
  const snapshot = new DOMParser().parseFromString(decodeURIComponent(svg.slice(svg.indexOf(",") + 1)), "image/svg+xml")
  // Removing offscreen rows must not stretch the remaining rows to the table's original height.
  snapshot.querySelectorAll<HTMLElement>("table, thead, tbody, tfoot").forEach((node) => {
    node.style.height = "auto"
    node.style.minHeight = "0"
  })
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(snapshot))}`
  await image.decode()
  if (signal.aborted) return null
  const canvas = document.createElement("canvas")
  canvas.width = 560
  canvas.height = Math.min(560, Math.round((height / width) * 560))
  const context = canvas.getContext("2d")
  if (!context) return null
  context.fillStyle = backgroundColor
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, 560, (height / width) * 560)
  return canvas.toDataURL("image/jpeg", 0.75)
}

export function observePageTabPreview(
  element: HTMLElement,
  publish: (image: string) => void,
  render = capturePagePreview,
) {
  const controller = new AbortController()
  let currentCapture: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let idle: number | undefined
  let capturing = false
  let dirty = true
  let lastCapture = 0
  const capture = async () => {
    idle = undefined
    if (controller.signal.aborted || document.hidden || capturing || !dirty) return
    capturing = true
    dirty = false
    lastCapture = Date.now()
    currentCapture = new AbortController()
    const signal = currentCapture.signal
    const timeout = setTimeout(() => currentCapture?.abort(), 8000)
    try {
      const image = await render(element, signal)
      if (image && !signal.aborted && !controller.signal.aborted) publish(image)
    } catch {
      // A failed thumbnail must never interrupt page navigation or discard a previous preview.
    } finally {
      clearTimeout(timeout)
      capturing = false
      if (dirty) schedule()
    }
  }
  const schedule = () => {
    dirty = true
    if (controller.signal.aborted || capturing) return
    clearTimeout(timer)
    if (idle !== undefined) window.cancelIdleCallback(idle)
    timer = setTimeout(
      () => {
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => void capture(), { timeout: 2000 })
        else void capture()
      },
      Math.max(1200, lastCapture + 8000 - Date.now()),
    )
  }
  const observer = new MutationObserver(schedule)
  observer.observe(element, { childList: true, subtree: true, characterData: true })
  element.addEventListener("load", schedule, true)
  document.addEventListener("visibilitychange", schedule)
  schedule()
  return () => {
    controller.abort()
    currentCapture?.abort()
    observer.disconnect()
    element.removeEventListener("load", schedule, true)
    document.removeEventListener("visibilitychange", schedule)
    clearTimeout(timer)
    if (idle !== undefined) window.cancelIdleCallback(idle)
  }
}

export function usePageTabCapture(panel: RefObject<HTMLDivElement | null>, active: boolean, path: string, to: string) {
  const store = useContext(PageTabPreviewContext)
  useEffect(() => {
    const element = panel.current
    if (!active || !element || !store || !element.clientWidth) return
    return observePageTabPreview(element, (image) => store.set(path, image))
  }, [active, path, to, panel, store])
}

export function PageTabPreviewImage({ path }: { path: string }) {
  const store = useContext(PageTabPreviewContext)!
  const image = useSyncExternalStore(
    store.subscribe,
    () => store.get(path),
    () => undefined,
  )
  return (
    <div className="aspect-[16/10] overflow-hidden border-t bg-muted/40">
      {image ? (
        <img src={image} alt="Ảnh thu nhỏ nội dung trang" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon aria-hidden="true" className="size-6 opacity-50" />
          <span className="text-xs">Chưa có ảnh xem trước</span>
        </div>
      )}
    </div>
  )
}
