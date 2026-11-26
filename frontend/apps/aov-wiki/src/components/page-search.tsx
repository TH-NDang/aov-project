import { useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react"
import { useWikiText } from "../context/wiki-context"
import { WikiIcon } from "./wiki-icon"
import "./page-search.css"

/**
 * The search field of a section page (heroes, skins, the armory, the glossary), one look for all of them: a magnifier,
 * the text, what the search leaves as a small chip, and a cross that empties it; a hint such as a key may stand at its
 * end while it is empty. The owner sets its width with `className`.
 */
export function PageSearch({
  value,
  onChange,
  label,
  placeholder,
  result,
  hint,
  size = "regular",
  inputRef,
  onKeyDown,
  className = "",
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  /** While a search is typed, how many entries it leaves, with their unit, such as "12 items". */
  result?: string
  /** Shown at the end while the field is empty, such as the key that brings the reader into it. */
  hint?: ReactNode
  /** `large` is taller with 16px text, for a field pinned on phones (iOS zooms in on smaller text). */
  size?: "regular" | "large"
  inputRef?: RefObject<HTMLInputElement | null>
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  className?: string
}) {
  const t = useWikiText()
  const ownRef = useRef<HTMLInputElement>(null)
  const input = inputRef ?? ownRef

  return (
    <div className={`wiki-page-search ${className}`} data-size={size} role="search">
      <WikiIcon name="search" size={18} />
      <input
        ref={input}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        value={value}
        maxLength={120}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {value && result && (
        <span className="wiki-page-search-result" role="status">
          {result}
        </span>
      )}
      {value ? (
        <button
          type="button"
          className="wiki-page-search-clear"
          aria-label={t("Xóa từ khóa", "Clear search")}
          onClick={() => {
            onChange("")
            input.current?.focus()
          }}
        >
          <WikiIcon name="close" size={14} />
        </button>
      ) : (
        hint
      )}
    </div>
  )
}
