import * as React from "react"
import type { EntityReference } from "../../lib/entity-rich-text"
import {
  createReferenceSearchIndex,
  referenceSuggestionAt,
  type EntityReferenceSearch,
  type TextSelection,
} from "../../lib/entity-rich-text-editor"
import { useReferenceOptions, useReferenceSearch } from "./use-reference-search"

const batchSize = 32

/**
 * What the reference list shows: the references matching the @ before the caret, or the picker's own search, the
 * row chosen with the arrow keys and how many rows are drawn so far.
 */
export function useReferenceSuggestions({
  value,
  caret,
  composing,
  disabled,
  entities,
  locale,
  fallbackLocale,
  searchReferences,
  ranked,
}: {
  value: string
  caret: TextSelection
  composing: boolean
  disabled?: boolean
  entities: EntityReference[]
  locale: string
  fallbackLocale: string
  searchReferences?: EntityReferenceSearch
  ranked?: boolean
}) {
  const [dismissed, setDismissed] = React.useState(false)
  const [picker, setPicker] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const [visibleRows, setVisibleRows] = React.useState(batchSize)
  const searchIndex = React.useMemo(
    () => createReferenceSearchIndex(entities, locale, fallbackLocale),
    [entities, locale, fallbackLocale],
  )
  const mention = !composing && !dismissed && !picker ? referenceSuggestionAt(value, caret, searchIndex) : null
  const searchQuery = picker ? query : (mention?.query ?? "")
  const open = (!!mention || picker) && !composing && !disabled
  React.useEffect(() => setVisibleRows(batchSize), [open, searchQuery])
  const remote = useReferenceSearch(searchReferences, searchQuery, locale, open)
  const options = useReferenceOptions({
    open,
    searchIndex,
    query: searchQuery,
    remote,
    locale,
    fallbackLocale,
    ranked,
  })
  const rendered = Math.min(options.length, Math.max(visibleRows, active + 1))
  const visible = open && (picker || !!mention?.explicit || options.length > 0)
  const close = () => {
    setPicker(false)
    setDismissed(true)
  }

  /** Escape, the arrow keys and Enter while the list shows; says whether the key belonged to the list. */
  const handleKey = (
    event: React.KeyboardEvent,
    { composing, choose, refocus }: { composing: boolean; choose: (index: number) => void; refocus: () => void },
  ) => {
    if (!visible || composing || event.nativeEvent.isComposing) return false
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      refocus()
      return true
    }
    if (!options.length) return false
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (event.key === "ArrowDown" && active >= options.length - 1 && remote.hasMore) {
        remote.loadMore()
        return true
      }
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive((n) => (n + step + options.length) % options.length)
      return true
    }
    if (event.key === "Enter") {
      event.preventDefault()
      choose(Math.min(active, options.length - 1))
      return true
    }
    return false
  }

  return {
    mention,
    /** Opened from the toolbar, with a search field of its own. */
    picker,
    query,
    active,
    /** Suggestions are wanted, though the list waits for a match after a bare @. */
    open,
    visible,
    options,
    rendered,
    remote,
    handleKey,
    loadMore: () => {
      if (rendered < options.length) setVisibleRows(rendered + batchSize)
      else remote.loadMore()
    },
    search: (next: string) => {
      setQuery(next)
      setActive(0)
    },
    openPicker: (show: boolean) => {
      setPicker(show)
      setQuery("")
      setActive(0)
      setDismissed(true)
    },
    close,
    /** Hides the list until the text changes again. */
    dismiss: () => setDismissed(true),
    /** After typing the list may open again, from its first row. */
    reopen: () => {
      setDismissed(false)
      setActive(0)
    },
  }
}
