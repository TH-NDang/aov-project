/** A page of a patch's official notes, named by its language or market, as the patch keeps it. */
export interface PatchSourceLink {
  url: string
  label: string
  locale: string | null
}

const WEB_ADDRESS = /^https?:\/\/\S+$/i

/**
 * The links a patch page cites: the labelled links written for the patch, in their order, or else the one link its
 * changes were recorded from.
 */
export function patchSourceLinks(shared: PatchSourceLink[] | undefined, recorded: string | null | undefined) {
  const links = (shared ?? []).filter((link) => WEB_ADDRESS.test(link.url))
  if (links.length) return links
  return recorded ? [{ url: recorded, label: "", locale: null }] : []
}

/** What a link is called on the page: its label, or the site it leads to when it has none. */
export function sourceName(link: PatchSourceLink) {
  if (link.label.trim()) return link.label.trim()
  try {
    return new URL(link.url).hostname
  } catch {
    return link.url
  }
}
