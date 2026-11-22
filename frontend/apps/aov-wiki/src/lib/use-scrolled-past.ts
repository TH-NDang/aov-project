import { useEffect, useState } from "react"

/**
 * True once the element with this id has scrolled up under the line `offset` pixels from the top, such as the sticky
 * header's foot. One measure per scroll event: a single box, cheap enough without waiting for a frame.
 */
export function useScrolledPast(id: string, offset: number, enabled = true) {
  const [past, setPast] = useState(false)

  useEffect(() => {
    if (!enabled) return setPast(false)
    const measure = () => {
      const box = document.getElementById(id)?.getBoundingClientRect()
      setPast(!!box && box.bottom < offset)
    }
    measure()
    window.addEventListener("scroll", measure, { passive: true })
    window.addEventListener("resize", measure)
    return () => {
      window.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
    }
  }, [id, offset, enabled])

  return past
}
