import { useCallback, useEffect, useRef, type HTMLAttributes, type RefObject } from "react"

type ScrollAxis = "horizontal" | "vertical"

interface DragSession {
  element: HTMLElement
  pointerId: number
  startCoordinate: number
  startScroll: number
  previousUserSelect: string
  dragging: boolean
}

type DragScrollHandlers<T extends HTMLElement> = Pick<
  HTMLAttributes<T>,
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onLostPointerCapture"
  | "onClickCapture"
  | "onDragStart"
>

interface DragScrollBindings<T extends HTMLElement> {
  ref: RefObject<T | null>
  handlers: DragScrollHandlers<T>
}

export function useDragScroll<T extends HTMLElement = HTMLDivElement>(axis: ScrollAxis): DragScrollBindings<T> {
  const ref = useRef<T>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const suppressClickRef = useRef(false)

  const finishDrag = useCallback(() => {
    const session = sessionRef.current
    if (!session) return

    sessionRef.current = null
    if (session.dragging) {
      delete session.element.dataset.dragging
      session.element.style.userSelect = session.previousUserSelect
    }
    if (session.element.hasPointerCapture(session.pointerId)) {
      session.element.releasePointerCapture(session.pointerId)
    }
  }, [])

  useEffect(() => finishDrag, [finishDrag])

  const handlers: DragScrollHandlers<T> = {
    onPointerDown(event) {
      if (!event.isPrimary || event.button !== 0) return

      finishDrag()
      suppressClickRef.current = false
      if (event.pointerType === "touch") return

      const element = event.currentTarget
      const canScroll =
        axis === "horizontal" ? element.scrollWidth > element.clientWidth : element.scrollHeight > element.clientHeight
      if (!canScroll) return

      sessionRef.current = {
        element,
        pointerId: event.pointerId,
        startCoordinate: axis === "horizontal" ? event.clientX : event.clientY,
        startScroll: axis === "horizontal" ? element.scrollLeft : element.scrollTop,
        previousUserSelect: element.style.userSelect,
        dragging: false,
      }
    },

    onPointerMove(event) {
      const session = sessionRef.current
      if (!session || session.pointerId !== event.pointerId) return
      if ((event.buttons & 1) === 0) {
        suppressClickRef.current = false
        finishDrag()
        return
      }

      const coordinate = axis === "horizontal" ? event.clientX : event.clientY
      const distance = coordinate - session.startCoordinate
      if (!session.dragging) {
        if (Math.abs(distance) < 5) return

        try {
          session.element.setPointerCapture(session.pointerId)
        } catch {
          finishDrag()
          return
        }
        session.dragging = true
        session.element.dataset.dragging = "true"
        session.element.style.userSelect = "none"
        suppressClickRef.current = true
        session.element.ownerDocument.getSelection()?.removeAllRanges()
      }

      event.preventDefault()
      if (axis === "horizontal") session.element.scrollLeft = session.startScroll - distance
      else session.element.scrollTop = session.startScroll - distance
    },

    onPointerUp(event) {
      if (sessionRef.current?.pointerId === event.pointerId) finishDrag()
    },

    onPointerCancel(event) {
      if (sessionRef.current?.pointerId !== event.pointerId) return

      suppressClickRef.current = false
      finishDrag()
    },

    onLostPointerCapture(event) {
      if (sessionRef.current?.pointerId !== event.pointerId) return

      suppressClickRef.current = false
      finishDrag()
    },

    onClickCapture(event) {
      if (!suppressClickRef.current) return

      suppressClickRef.current = false
      if (event.detail === 0) return

      event.preventDefault()
      event.stopPropagation()
    },

    onDragStart(event) {
      if (sessionRef.current) event.preventDefault()
    },
  }

  return { ref, handlers }
}
