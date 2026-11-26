import { useEffect, useRef } from "react"

/**
 * Keeps what is chosen in a row in the middle of it, where the row is longer than the window and scrolls sideways.
 * `chosen` names it, so that the row moves when another one is chosen.
 */
export function useCentred<T extends HTMLElement>(chosen: string | null | undefined) {
  const row = useRef<T>(null)
  useEffect(() => {
    const item = row.current?.querySelector<HTMLElement>('[aria-current], [aria-pressed="true"]')
    if (row.current && item) row.current.scrollLeft = item.offsetLeft - (row.current.clientWidth - item.offsetWidth) / 2
  }, [chosen])
  return row
}
