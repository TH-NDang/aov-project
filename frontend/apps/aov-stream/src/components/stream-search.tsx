import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react"
import { useLocation, useNavigate } from "react-router"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { StreamSearchMatches } from "./stream-search-matches"
import { StreamSearchStart, type StartEntry } from "./stream-search-start"
import { rememberSearch } from "../lib/recent-searches"
import { suggestionList, useSearchSuggestions } from "../lib/use-search-suggestions"
import "./stream-search.css"

/** The search of a page's own list, typed into the bar's field. */
export type PageSearch = { value: string; onChange: (value: string) => void; placeholder: string; label: string }

const resultsOf = (search: string) => `/explore?${new URLSearchParams({ q: search.trim() })}`

/**
 * The search of the bar. It suggests as the reader types: teams, players, staff, competitions and pages, each group
 * drawn its own way, under a first row that opens every result (`/explore?q=`) with posts too. Before any word it offers
 * the last searches, the competitions under way and the teams seen last. Arrow keys move through what is offered,
 * Enter opens the marked one, Escape clears the field and then closes. On wide screens the offer drops under the field
 * while it has the focus; on compact ones it is a screen of its own under the bar while `sheetOpen`.
 */
export function StreamSearch({
  inputRef,
  sheet,
  sheetOpen,
  onSheetOpen,
  onDismiss,
  onDone,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  sheet: boolean
  sheetOpen: boolean
  onSheetOpen: (open: boolean) => void
  /** Escape on an empty field: the bar gives the search up. */
  onDismiss: () => void
  /** After a pick: `results` stays on the search (its page of results), `page` left it for what was picked. */
  onDone: (opened: "results" | "page") => void
}) {
  const { text } = useStreamLocale()
  const navigate = useNavigate()
  const { pathname, search: address } = useLocation()
  // On the page of results the field starts from the words searched for.
  const [value, setValue] = useState(() => (pathname === "/explore" ? new URLSearchParams(address).get("q") || "" : ""))
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const startEntries = useRef<StartEntry[]>([])
  const listId = useId()
  const typed = value.trim()
  const shown = sheet ? sheetOpen : focused
  const suggestions = useSearchSuggestions(value, sheet ? 4 : 3, shown)
  const options = typed ? [{ to: resultsOf(typed), results: true }, ...suggestionList(suggestions.groups)] : []
  const marked = typed ? Math.min(Math.max(active, 0), options.length - 1) : active

  /** After a pick: the words go to the recent searches, and the panel closes. */
  function finish(results: boolean, words = typed) {
    if (words) rememberSearch(words)
    setActive(-1)
    if (!sheet) inputRef.current?.blur()
    onDone(results ? "results" : "page")
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (typed) {
      const option = options[marked]!
      void navigate(option.to)
      finish("results" in option)
      return
    }
    const entry = startEntries.current[active]
    void navigate(entry ? entry.to : "/explore")
    finish(entry ? !!entry.search : true, entry?.search)
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const sideways = !typed && (event.key === "ArrowRight" || event.key === "ArrowLeft")
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || sideways) {
      const count = typed ? options.length : startEntries.current.length
      if (!shown || !count) return
      event.preventDefault()
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1
      // From the latest value, so keys pressed faster than the list redraws all count.
      setActive((current) =>
        current < 0 ? (step > 0 ? 0 : count - 1) : (Math.min(current, count - 1) + step + count) % count,
      )
    } else if (event.key === "Escape") {
      if (value) {
        setValue("")
        setActive(-1)
      } else onDismiss()
    }
  }

  return (
    <form
      id="stream-global-search"
      className="hub-search"
      role="search"
      aria-label={text("Tìm kiếm chung", "Global search")}
      data-open={shown || undefined}
      onSubmit={submit}
    >
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && marked >= 0 ? `${listId}-${marked}` : undefined}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={100}
        aria-label={text("Tìm kiếm trên AOV Stream", "Search AOV Stream")}
        placeholder={text("Tìm đội, tuyển thủ, giải đấu…", "Search teams, players, tournaments…")}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setActive(-1)
          if (suggestions.failed) suggestions.retry()
        }}
        onFocus={() => {
          setFocused(true)
          if (sheet) onSheetOpen(true)
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {value ? (
        <button
          type="button"
          aria-label={text("Xóa từ khóa", "Clear the search")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setValue("")
            setActive(-1)
            inputRef.current?.focus()
          }}
        >
          <StreamIcon name="close" size={16} />
        </button>
      ) : (
        <>
          <kbd className="hub-search-key" aria-hidden="true">
            /
          </kbd>
          <button type="submit" aria-label={text("Tìm kiếm", "Search")}>
            <StreamIcon name="search" size={16} />
          </button>
        </>
      )}
      {shown && (
        // Keeps the focus in the field while an entry is pressed, so the panel does not close before the click lands.
        <div
          className="hub-search-panel"
          data-sheet={sheet || undefined}
          onMouseDown={(event) => event.preventDefault()}
        >
          {typed ? (
            <StreamSearchMatches
              listId={listId}
              search={typed}
              resultsTo={resultsOf(typed)}
              suggestions={suggestions}
              marked={marked}
              onHover={setActive}
              onPick={finish}
            />
          ) : (
            <StreamSearchStart
              listId={listId}
              marked={active}
              entries={startEntries}
              onHover={setActive}
              onPick={finish}
            />
          )}
        </div>
      )}
    </form>
  )
}

/** The bar's field while a page searches its own list with it: every key narrows the list, Escape clears it. */
export function ListSearch({
  search,
  inputRef,
  onDismiss,
}: {
  search: PageSearch
  inputRef: RefObject<HTMLInputElement | null>
  onDismiss: () => void
}) {
  const { text } = useStreamLocale()
  return (
    <form
      id="stream-global-search"
      className="hub-search"
      role="search"
      aria-label={search.label}
      onSubmit={(event) => {
        event.preventDefault()
        inputRef.current?.blur()
      }}
    >
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        maxLength={100}
        aria-label={search.label}
        placeholder={search.placeholder}
        value={search.value}
        onChange={(event) => search.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          if (search.value) search.onChange("")
          else onDismiss()
        }}
      />
      <button
        type="button"
        aria-label={search.value ? text("Xóa từ khóa", "Clear the search") : text("Tìm kiếm", "Search")}
        onClick={() => {
          if (search.value) search.onChange("")
          inputRef.current?.focus()
        }}
      >
        <StreamIcon name={search.value ? "close" : "search"} size={16} />
      </button>
    </form>
  )
}
