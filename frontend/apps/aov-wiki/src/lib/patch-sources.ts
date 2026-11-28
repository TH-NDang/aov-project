/** A page of a patch's official notes, named by its language or market, as the patch keeps it. */
export interface PatchSourceLink {
  url: string
  label: string
  locale: string | null
  /** The market that published the page; older answers leave it out. */
  region?: string | null
}

/** The order markets are listed in, the reader's own first when it is one of them. */
const MARKET_ORDER = ["VN", "TH", "TW", "ID"]

export interface SourceGroup {
  region: string | null
  links: PatchSourceLink[]
}

/** The links grouped by the market that published them, links without a market last, each group in the patch's order. */
export function sourcesByMarket(links: PatchSourceLink[], readerRegion?: string) {
  const order = readerRegion ? [readerRegion, ...MARKET_ORDER.filter((code) => code !== readerRegion)] : MARKET_ORDER
  const groups = new Map<string | null, PatchSourceLink[]>()
  for (const link of links) {
    const region = link.region || null
    groups.set(region, [...(groups.get(region) ?? []), link])
  }
  const rank = (region: string | null) => {
    if (region === null) return Number.MAX_SAFE_INTEGER
    const index = order.indexOf(region)
    return index === -1 ? order.length : index
  }
  return [...groups.entries()]
    .map(([region, grouped]): SourceGroup => ({ region, links: grouped }))
    .sort((a, b) => rank(a.region) - rank(b.region))
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

/** The one link a short mention cites: the page in the reader's language, else the patch's first. */
export function preferredPatchSource(links: PatchSourceLink[], locale: string) {
  const language = locale.split("-")[0]
  return (
    links.find((link) => link.locale === locale) ??
    links.find((link) => link.locale?.split("-")[0] === language) ??
    links[0]
  )
}
