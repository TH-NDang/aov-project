import { createElement, useEffect } from "react"
import { useLocation } from "react-router"
import { streamCanonical, streamHeadTags, streamOrigin } from "../lib/stream-head"
import { streamLanguageTag, useStreamLocale } from "./stream-locale"

const ORIGIN = streamOrigin(import.meta.env.VITE_WIKI_URL)

/**
 * The page's title, description, canonical address and preview tags. React places them in the document head. The
 * generic tags of index.html, kept for link previews that do not run scripts, leave once a page describes itself.
 */
export function StreamHead({
  title,
  description,
  noindex = false,
}: {
  title: string
  description?: string
  noindex?: boolean
}) {
  const { pathname } = useLocation()
  const { locale } = useStreamLocale()
  useEffect(() => {
    for (const element of document.head.querySelectorAll("[data-static-head]")) element.remove()
  }, [])
  const canonical = streamCanonical(ORIGIN, import.meta.env.BASE_URL, pathname)
  const tags = streamHeadTags(
    { title, description, path: pathname, noindex, locale: streamLanguageTag(locale) },
    canonical,
  )
  return (
    <>
      <title>{title}</title>
      {tags.map(({ tag, attrs }) =>
        createElement(tag, { key: `${attrs.rel ?? attrs.name ?? attrs.property}`, ...attrs }),
      )}
    </>
  )
}
