import { useEffect, useRef, useState, type PointerEvent } from "react"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { heroRunAnchor } from "./hero-library-grid"
import "./hero-letter-rail.css"

/**
 * The letters of the library down the right edge of a phone, as in a contact list: a touch on a letter, or a slide
 * along the column, jumps to its heroes and shows the letter large under the finger. It stays out of sight until the
 * grid `gridId` is on screen.
 */
export function HeroLetterRail({ letters, gridId }: { letters: { key: string; label: string }[]; gridId: string }) {
  const { locale } = useWikiContext()
  const rail = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const sliding = useRef(false)
  const release = useRef<number | undefined>(undefined)

  useEffect(() => {
    const grid = document.getElementById(gridId)
    if (!grid) return
    const observer = new IntersectionObserver(([entry]) => setShown(!!entry?.isIntersecting))
    observer.observe(grid)
    return () => observer.disconnect()
  }, [gridId])
  useEffect(() => () => window.clearTimeout(release.current), [])

  function jumpTo(key: string) {
    window.clearTimeout(release.current)
    setActive(key)
    document.getElementById(heroRunAnchor(key))?.scrollIntoView({ block: "start" })
  }

  /** The letter under a point of the column, so a slide passes from letter to letter without lifting the finger. */
  function letterAt(clientY: number) {
    const box = rail.current?.getBoundingClientRect()
    if (!box || !letters.length) return undefined
    const index = Math.floor(((clientY - box.top) / box.height) * letters.length)
    return letters[Math.min(letters.length - 1, Math.max(0, index))]
  }

  function slide(event: PointerEvent<HTMLElement>) {
    if (!sliding.current) return
    const letter = letterAt(event.clientY)
    if (letter && letter.key !== active) jumpTo(letter.key)
  }

  function lift() {
    sliding.current = false
    release.current = window.setTimeout(() => setActive(null), 500)
  }

  const activeLabel = letters.find((letter) => letter.key === active)?.label

  return (
    <nav
      ref={rail}
      className="wiki-hero-letter-rail"
      data-shown={shown || undefined}
      aria-label={wikiText(locale, "Nhảy tới chữ cái", "Jump to a letter")}
      onPointerDown={(event) => {
        sliding.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        slide(event)
      }}
      onPointerMove={slide}
      onPointerUp={lift}
      onPointerCancel={lift}
    >
      {letters.map((letter) => (
        <button
          key={letter.key}
          type="button"
          aria-current={letter.key === active || undefined}
          onClick={() => {
            jumpTo(letter.key)
            lift()
          }}
        >
          {letter.label}
        </button>
      ))}
      {activeLabel && (
        <span className="wiki-hero-letter-bubble" aria-hidden="true">
          {activeLabel}
        </span>
      )}
    </nav>
  )
}
