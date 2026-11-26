import { useLayoutEffect, useRef, type RefObject } from "react"

const SLIDE = 240

/** How far an element stands from its place while it is still sliding there. */
const shiftOf = (element: Element) => {
  const { transform } = getComputedStyle(element)
  return transform === "none" ? 0 : new DOMMatrix(transform).m42
}

/**
 * Rows that change places slide from where they stood to where they stand; `order` names the order they are in. A row
 * is known by its `data-team`, so it may be drawn anew in another part of its table. Readers who ask for less motion
 * see the rows change places at once.
 */
export function useSlidingRows(table: RefObject<HTMLTableElement | null>, order: string) {
  const tops = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const before = tops.current
    tops.current = new Map()
    for (const row of table.current?.querySelectorAll<HTMLElement>("tr[data-team]") ?? []) {
      const team = row.dataset.team!
      const stood = before.get(team)
      tops.current.set(team, row.offsetTop)
      if (stood == null || calm) continue
      const shift = stood - row.offsetTop + shiftOf(row)
      for (const slide of row.getAnimations()) if (slide.id === "slide") slide.cancel()
      if (shift)
        row.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], {
          id: "slide",
          duration: SLIDE,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        })
    }
  }, [table, order])
}
