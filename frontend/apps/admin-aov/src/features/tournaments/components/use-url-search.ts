import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { useDebounced } from "@/features/community/directory/directory-api"

/**
 * Search text kept in the address, so going back to a list finds it as it was left. The field reads its own state: the
 * router applies a new address a moment later, which would drop letters from a field bound to it. The address follows
 * once typing pauses, replacing its history entry, and an address changed elsewhere (a sidebar link, going back) fills
 * the field.
 */
export function useUrlSearch(name = "q") {
  const [params, setParams] = useSearchParams()
  const stored = params.get(name) ?? ""
  const [search, setSearch] = useState(stored)
  const settled = useDebounced(search)

  const [seen, setSeen] = useState({ stored, settled })
  if (stored !== seen.stored || settled !== seen.settled) {
    setSeen({ stored, settled })
    // Only an address that changed on its own fills the field; one that follows the typing already matches it.
    if (stored !== seen.stored && stored !== settled && settled === seen.settled) setSearch(stored)
  }

  useEffect(() => {
    if (stored === settled) return
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (settled) next.set(name, settled)
        else next.delete(name)
        return next
      },
      { replace: true },
    )
    // The address follows the text; a new address alone must not write the text back over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the settled text changes
  }, [settled])

  return { search, setSearch, settled }
}
