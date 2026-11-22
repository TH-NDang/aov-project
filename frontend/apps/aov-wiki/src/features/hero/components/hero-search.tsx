import { useEffect, useRef } from "react"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import "./hero-search.css"

/** Whether a key press happened while the reader was already typing somewhere. */
function typingElsewhere(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

/**
 * The hero library's search field. Pressing / anywhere on the page brings the reader into it, a cross or Escape empties
 * it, and Enter opens the hero's page when exactly one hero is left. While empty it shows the / key as a hint on
 * screens with a keyboard.
 */
export function HeroSearch({
  value,
  onChange,
  onOpenOnly,
  size = "regular",
  atEnd = false,
}: {
  value: string
  onChange: (value: string) => void
  /** Opens the only hero the search leaves; absent while several or none are left. */
  onOpenOnly?: () => void
  size?: "regular" | "large"
  /** Stands at the end of the line that holds it, at a comfortable width. */
  atEnd?: boolean
}) {
  const { locale } = useWikiContext()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || typingElsewhere(event.target)) return
      event.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="wiki-hero-searchbox" data-size={size} data-at-end={atEnd || undefined} role="search">
      <WikiIcon name="search" size={18} />
      <input
        ref={input}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault()
            onChange("")
          } else if (event.key === "Enter" && onOpenOnly) {
            event.preventDefault()
            onOpenOnly()
          }
        }}
        maxLength={120}
        aria-label={wikiText(locale, "Tìm tướng", "Search heroes")}
        placeholder={wikiText(locale, "Tìm tên tướng…", "Search hero names…")}
      />
      {value ? (
        <button
          type="button"
          className="wiki-hero-searchbox-clear"
          aria-label={wikiText(locale, "Xóa ô tìm", "Clear the search")}
          onClick={() => {
            onChange("")
            input.current?.focus()
          }}
        >
          <WikiIcon name="close" size={14} />
        </button>
      ) : (
        // The / key is a hint for a keyboard; the large field of phones has none, and the mark only confuses there.
        size !== "large" && (
          <kbd className="wiki-hero-searchbox-key" aria-hidden="true">
            /
          </kbd>
        )
      )}
    </div>
  )
}
