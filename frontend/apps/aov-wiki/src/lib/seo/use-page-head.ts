import { useEffect, useEffectEvent } from "react"
import { applyPageHead, parseSiteUrl } from "./head-tags"
import type { PageMeta } from "./page-meta"

const SITE_URL = parseSiteUrl(import.meta.env.VITE_WIKI_URL)

/**
 * Describes the current page in the document head. Pass null while the data is loading: a static page already
 * carries the right tags, and during client navigation the previous ones are replaced once the data arrives.
 */
export function usePageHead(meta: PageMeta | null) {
  // The serialized value decides: callers build a new object on every render.
  const key = meta && JSON.stringify(meta)
  const apply = useEffectEvent(() => {
    if (meta) applyPageHead(document, meta, SITE_URL)
  })
  useEffect(() => {
    apply()
  }, [key])
}
