import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import {
  edgeSpeed,
  nearestPort,
  portRadius,
  verticalScroller,
  type ConnectionPointer,
  type Port,
  type PortTarget,
} from "./shop-geometry"

/**
 * Linking two cards, by clicking a port then the opposite one, or by dragging a link from a port onto another. While a
 * link is dragged, the wire follows the pointer, snaps to a port within reach and scrolls the board near its edges.
 */
export function useShopConnections({
  canvas,
  scrollArea,
  onConnect,
}: {
  canvas: RefObject<HTMLDivElement | null>
  scrollArea: RefObject<HTMLDivElement | null>
  onConnect?: (from: string, to: string) => void
}) {
  const [armed, setArmed] = useState<Port | null>(null)
  const pointer = useRef<ConnectionPointer | null>(null)
  const preview = useRef<SVGGElement>(null)
  const previewHalo = useRef<SVGPathElement>(null)
  const previewWire = useRef<SVGPathElement>(null)
  const previewTip = useRef<SVGCircleElement>(null)
  const previewFrame = useRef(0)
  const previewTime = useRef(0)
  /** Until when a click is a leftover of a drag and does nothing. */
  const suppressClick = useRef(0)
  // Both only touch refs, so the effects that end a drag can list them without running again.
  const clearConnection = useCallback(() => {
    const session = pointer.current
    pointer.current = null
    cancelAnimationFrame(previewFrame.current)
    previewFrame.current = 0
    previewTime.current = 0
    preview.current?.setAttribute("visibility", "hidden")
    preview.current?.removeAttribute("data-connection-preview")
    session?.element.removeAttribute("data-connection-source")
    session?.targets.forEach((target) => {
      target.element.removeAttribute("data-connection-compatible")
      target.element.removeAttribute("data-connection-target")
    })
    if (session?.element.hasPointerCapture?.(session.pointerId))
      session.element.releasePointerCapture(session.pointerId)
    return session
  }, [])
  const cancelConnection = useCallback(() => {
    const session = clearConnection()
    if (session) suppressClick.current = Date.now() + 300
  }, [clearConnection])
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !pointer.current) return
      event.preventDefault()
      event.stopPropagation()
      cancelConnection()
      setArmed(null)
    }
    const blur = () => cancelConnection()
    window.addEventListener("keydown", escape, true)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", escape, true)
      window.removeEventListener("blur", blur)
      cancelConnection()
    }
  }, [cancelConnection])

  function drawConnection(time: number) {
    previewFrame.current = 0
    const session = pointer.current
    const element = canvas.current
    if (!session?.dragged || !element) return
    const elapsed = previewTime.current ? Math.min(32, time - previewTime.current) : 16
    previewTime.current = time
    const scroller = scrollArea.current
    let scrolling = false
    if (scroller) {
      const viewport = scroller.getBoundingClientRect()
      const margin = Math.min(56, viewport.width / 5)
      const left = Math.max(0, Math.min(1, (viewport.left + margin - session.x) / margin))
      const right = Math.max(0, Math.min(1, (session.x - viewport.right + margin) / margin))
      if (
        session.y >= viewport.top &&
        session.y <= viewport.bottom &&
        session.x >= viewport.left - 24 &&
        session.x <= viewport.right + 24
      ) {
        const before = scroller.scrollLeft
        scroller.scrollLeft += (right - left) * elapsed * 0.55
        scrolling = scroller.scrollLeft !== before
      }
    }
    const page = verticalScroller(scroller ?? element)
    const pageRect =
      page === document.scrollingElement || page === document.documentElement
        ? { top: 0, bottom: window.innerHeight }
        : page.getBoundingClientRect()
    const vertical = edgeSpeed(session.y, pageRect.top, pageRect.bottom, 72)
    if (vertical) {
      const before = page.scrollTop
      page.scrollTop += vertical * elapsed * 0.9
      scrolling ||= page.scrollTop !== before
    }
    const bounds = element.getBoundingClientRect()
    const x = session.x - bounds.left
    const y = session.y - bounds.top
    const target = nearestPort(session, x, y)
    if (target !== session.target) {
      session.target?.element.removeAttribute("data-connection-target")
      target?.element.setAttribute("data-connection-target", "true")
      session.target = target
    }
    const moving = target ? { x: target.x, y: target.y } : { x, y }
    const start = session.port.side === "out" ? session.origin : moving
    const end = session.port.side === "in" ? session.origin : moving
    const startX = start.x + (session.port.side === "out" || target ? portRadius : 0)
    const endX = end.x - (session.port.side === "in" || target ? portRadius : 0)
    const bend = Math.max(48, Math.min(160, Math.abs(endX - startX) * 0.45))
    const d = `M${startX},${start.y} C${startX + bend},${start.y} ${endX - bend},${end.y} ${endX},${end.y}`
    previewHalo.current?.setAttribute("d", d)
    previewWire.current?.setAttribute("d", d)
    previewWire.current?.setAttribute("stroke-dasharray", target ? "" : "6 5")
    previewTip.current?.setAttribute("cx", String(moving.x))
    previewTip.current?.setAttribute("cy", String(moving.y))
    previewTip.current?.setAttribute("r", target ? "8" : "4")
    preview.current?.setAttribute("visibility", "visible")
    preview.current?.setAttribute("data-connection-preview", target ? "snapped" : "dragging")
    if (scrolling) queueConnection()
  }
  function queueConnection() {
    if (!previewFrame.current) previewFrame.current = requestAnimationFrame(drawConnection)
  }
  function connect(a: Port, b: Port) {
    setArmed(null)
    if (a.side === b.side || a.id === b.id) return
    onConnect?.(a.side === "out" ? a.id : b.id, a.side === "in" ? a.id : b.id)
  }
  function portClick(port: Port) {
    if (Date.now() < suppressClick.current) return
    if (armed?.id === port.id && armed.side === port.side) setArmed(null)
    else if (armed?.side === port.side) setArmed(port)
    else if (armed) connect(armed, port)
    else setArmed(port)
  }

  /** Handlers for the board's canvas, which holds every port. */
  const canvasHandlers = {
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.button !== 0 || pointer.current) return
      const port = (event.target as Element).closest<HTMLElement>("[data-link-id]")
      if (port) {
        const element = event.currentTarget
        const bounds = element.getBoundingClientRect()
        const source = port.getBoundingClientRect()
        const origin = {
          x: (source.left + source.right) / 2 - bounds.left,
          y: (source.top + source.bottom) / 2 - bounds.top,
        }
        const side = port.dataset.linkSide as Port["side"]
        const targets = [...element.querySelectorAll<HTMLElement>("[data-link-id]")]
          .filter((target) => target.dataset.linkId !== port.dataset.linkId && target.dataset.linkSide !== side)
          .map((target): PortTarget => {
            const rect = target.getBoundingClientRect()
            return {
              id: target.dataset.linkId!,
              side: target.dataset.linkSide as Port["side"],
              element: target,
              x: (rect.left + rect.right) / 2 - bounds.left,
              y: (rect.top + rect.bottom) / 2 - bounds.top,
              left: rect.left - bounds.left,
              right: rect.right - bounds.left,
              top: rect.top - bounds.top,
              bottom: rect.bottom - bounds.top,
            }
          })
        port.setPointerCapture?.(event.pointerId)
        port.setAttribute("data-connection-source", "true")
        pointer.current = {
          port: { id: port.dataset.linkId!, side },
          element: port,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          origin,
          targets,
          magnetRadius: event.pointerType === "touch" ? 32 : 20,
          dragged: false,
          target: null,
        }
      }
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      const session = pointer.current
      if (!session || session.pointerId !== event.pointerId) return
      session.x = event.clientX
      session.y = event.clientY
      if (!session.dragged && Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 6) {
        session.dragged = true
        setArmed(null)
        session.targets.forEach((target) => target.element.setAttribute("data-connection-compatible", "true"))
      }
      if (session.dragged) {
        event.preventDefault()
        queueConnection()
      }
    },
    onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
      if (pointer.current?.pointerId === event.pointerId) cancelConnection()
    },
    onLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
      if (pointer.current?.pointerId === event.pointerId) cancelConnection()
    },
    onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      const session = pointer.current
      if (!session || session.pointerId !== event.pointerId) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const target = nearestPort(session, event.clientX - bounds.left, event.clientY - bounds.top)
      clearConnection()
      if (!session.dragged) return
      suppressClick.current = Date.now() + 300
      if (target) connect(session.port, target)
      else setArmed(null)
    },
  }

  return {
    /** The port clicked first, waiting for the port it links to. */
    armed,
    setArmed,
    /** The link being dragged, if any. */
    pointer,
    suppressClick,
    preview: { group: preview, halo: previewHalo, wire: previewWire, tip: previewTip },
    cancelConnection,
    portClick,
    canvasHandlers,
  }
}

export type ShopConnections = ReturnType<typeof useShopConnections>
