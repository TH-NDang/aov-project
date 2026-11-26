import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router"
import { EntityReferenceArtwork } from "@aov/ui/components/entity-rich-text"
import { referenceTranslation, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { useWikiContext, wikiText, useWikiText } from "../context/wiki-context"
import { wikiReferencesQuery } from "../lib/wiki-references"
import { WikiIcon } from "./wiki-icon"
import { SITE_NAME } from "../lib/seo/page-meta"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { SECTION_NAMES } from "../lib/wiki-sections"
import { WikiSearchStart, type StartEntry } from "./wiki-search-start"
import "./wiki-search.css"

const LIMIT = 8
const KIND_LABELS: Record<string, [string, string]> = {
  hero: ["Tướng", "Hero"],
  item: ["Trang bị", "Equipment"],
  enchantment: ["Phù hiệu", "Enchantment"],
  arcana: ["Bảng ngọc", "Arcana"],
  spell: ["Phụ trợ", "Talent"],
  term: ["Thuật ngữ", "Term"],
}
const KIND_ORDER = ["hero", "item", "term", "enchantment", "spell", "arcana"]
/** The lists a keyword can filter, for what the suggestions do not hold: skins, and the names past the first few. */
const LISTS = [
  ["/hero", "heroes"],
  ["/skins", "skins"],
  ["/warehouse/items", "items"],
  ["/terms", "terms"],
] as const

type Match = { entity: EntityReference; name: string; to: string }

/**
 * Published names matching what is typed, best first: the name itself, then a name that starts with it, then one that
 * contains it.
 */
function useMatches(search: string) {
  const scope = useWikiContext()
  const needle = foldSearchText(search.trim())
  const references = useQuery({ ...wikiReferencesQuery(scope), enabled: needle.length > 0 })
  const matches = useMemo<Match[]>(() => {
    if (!needle || !references.data) return []
    const fallback = references.data.fallbackLocale ?? "vi-VN"
    return references.data.entities
      .filter((entity) => entity.destinations?.wiki && KIND_LABELS[entity.kind])
      .flatMap((entity) => {
        const translation = referenceTranslation(entity, scope.locale, fallback)
        if (!translation) return []
        const names = [translation.name, ...translation.aliases].map(foldSearchText)
        const rank = names.includes(needle)
          ? 0
          : names.some((name) => name.startsWith(needle))
            ? 1
            : names.some((name) => name.includes(needle))
              ? 2
              : 3
        return rank < 3 ? [{ entity, name: translation.name, rank }] : []
      })
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          KIND_ORDER.indexOf(a.entity.kind) - KIND_ORDER.indexOf(b.entity.kind) ||
          a.name.localeCompare(b.name, scope.locale),
      )
      .slice(0, LIMIT)
      .map(({ entity, name }) => ({ entity, name, to: entity.destinations!.wiki! }))
  }, [needle, references.data, scope.locale])
  return {
    matches,
    needle,
    pending: needle.length > 0 && references.isPending,
    // Names kept from an earlier load still answer the search when a later refresh fails.
    failed: needle.length > 0 && references.isLoadingError,
    retry: () => void references.refetch(),
  }
}

/**
 * The one search of the Wiki: it finds heroes, equipment, enchantments, arcana, talents and terms by name on every page.
 * Before any word it offers suggestions with pictures (`WikiSearchStart`). Arrow keys move through the suggestions, or
 * through the matching names and then the lists the keyword can filter; Enter opens the marked one.
 */
export function WikiSearch({
  size = "bar",
  autoFocus = false,
  replace = false,
  onDone,
  onCancel,
}: {
  /** `bar` sits in the header, `hero` is the large box on the not-found page, `sheet` fills the compact header. */
  size?: "bar" | "hero" | "sheet"
  autoFocus?: boolean
  /** Opens a picked result in place of the current history entry, for a search that is an entry of its own. */
  replace?: boolean
  /** Called after the reader picks a result or submits, so the caller can close what holds the search. */
  onDone?: () => void
  /** Called when Escape is pressed on an empty field; without it the field just loses the focus. */
  onCancel?: () => void
}) {
  const navigate = useNavigate()
  const { locale, href } = useWikiContext()
  const t = useWikiText()
  const [search, setSearch] = useState("")
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const startEntries = useRef<StartEntry[]>([])
  const listId = useId()
  const { matches, needle, pending, failed, retry } = useMatches(search)
  const open = focused && needle.length > 0
  // On phones the search is a screen of its own while it is open.
  const sheet = size === "sheet"
  // Before any word, the panel offers suggestions with pictures.
  const starting = (focused || sheet) && needle.length === 0
  const panelShown = open || starting
  const lists = LISTS.map(([path, key]) => ({
    label: t(...SECTION_NAMES[key]),
    to: href(`${path}?${new URLSearchParams({ q: search.trim() })}`),
  }))
  // One run of options for the keyboard: the matching names, then the lists.
  const destinations = [...matches.map((match) => match.to), ...lists.map((list) => list.to)]
  const marked = Math.min(active, destinations.length - 1)

  function finish() {
    setSearch("")
    setActive(0)
    input.current?.blur()
    onDone?.()
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const target = search.trim() ? destinations[marked] : startEntries.current[active]?.to
    if (!target) return
    void navigate(target, { replace })
    finish()
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const sideways = starting && (event.key === "ArrowRight" || event.key === "ArrowLeft")
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || sideways) {
      if (!open && !starting) return
      event.preventDefault()
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1
      const count = starting ? startEntries.current.length : destinations.length
      if (!count) return
      // From the latest value, so keys pressed faster than the list redraws are all counted.
      setActive((current) =>
        current < 0 ? (step > 0 ? 0 : count - 1) : (Math.min(current, count - 1) + step + count) % count,
      )
    } else if (event.key === "Escape") {
      if (search) {
        setSearch("")
        setActive(-1)
      } else if (onCancel) onCancel()
      else {
        input.current?.blur()
        onDone?.()
      }
    }
  }

  return (
    <form role="search" className="wiki-search" data-size={size} data-open={open || undefined} onSubmit={submit}>
      <WikiIcon name="search" size={size === "hero" ? 22 : 18} className="wiki-search-icon" />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={panelShown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open ? `${listId}-${marked}` : starting && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-label={wikiText(locale, `Tìm trong ${SITE_NAME}`, `Search ${SITE_NAME}`)}
        placeholder={wikiText(locale, "Tìm tướng, trang bị…", "Search heroes, items…")}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={120}
        autoFocus={autoFocus}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setActive(0)
          if (failed) retry()
        }}
        onFocus={() => {
          setFocused(true)
          if (!search) setActive(-1)
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {search && (
        <button
          type="button"
          className="wiki-search-clear"
          aria-label={wikiText(locale, "Xóa từ khóa", "Clear search")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setSearch("")
            setActive(-1)
            input.current?.focus()
          }}
        >
          <WikiIcon name="close" size={16} />
        </button>
      )}
      {starting && (
        // Keeps focus in the field while a suggestion is pressed, so the panel does not close before the click lands.
        <div className="wiki-search-panel" data-start onMouseDown={(event) => event.preventDefault()}>
          <WikiSearchStart
            listId={listId}
            marked={active}
            entries={startEntries}
            replace={replace}
            onHover={setActive}
            onPick={finish}
          />
        </div>
      )}
      {(open || (sheet && needle)) && (
        // Keeps focus in the field while a result is pressed, so the list does not close before the click lands.
        <div className="wiki-search-panel" onMouseDown={(event) => event.preventDefault()}>
          {matches.length === 0 && (
            <p className="wiki-search-empty" role="status">
              {pending
                ? t("Đang tải…", "Loading…")
                : failed
                  ? wikiText(
                      locale,
                      "Chưa tải được danh sách tên. Gõ tiếp để thử lại.",
                      "The list of names could not be loaded. Keep typing to try again.",
                    )
                  : wikiText(
                      locale,
                      "Không có tên nào khớp với từ khóa này.",
                      "No published name matches this search.",
                    )}
            </p>
          )}
          <div id={listId} role="listbox" aria-label={wikiText(locale, "Gợi ý tìm kiếm", "Search suggestions")}>
            {matches.length > 0 && (
              <ul role="group" aria-label={wikiText(locale, "Tên khớp", "Matching names")}>
                {matches.map((match, index) => (
                  <li key={`${match.entity.kind}:${match.entity.id}`} role="presentation">
                    <Link
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === marked}
                      to={match.to}
                      tabIndex={-1}
                      onClick={finish}
                      onMouseEnter={() => setActive(index)}
                    >
                      <EntityReferenceArtwork entity={match.entity} className="wiki-search-art" />
                      <strong>{match.name}</strong>
                      <span>{wikiText(locale, ...KIND_LABELS[match.entity.kind])}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div
              className="wiki-search-more"
              role="group"
              aria-label={wikiText(locale, "Lọc danh sách", "Filter a list")}
            >
              <span aria-hidden="true">{wikiText(locale, "Lọc danh sách:", "Filter a list:")}</span>
              {lists.map((list, offset) => {
                const index = matches.length + offset
                return (
                  <Link
                    key={list.to}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === marked}
                    to={list.to}
                    replace={replace}
                    tabIndex={-1}
                    onClick={finish}
                    onMouseEnter={() => setActive(index)}
                  >
                    {list.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
