import { NAV_ITEMS, type NavArea, type NavBadgeKey, type NavItem } from "@/app/nav"

export type NavCounts = Partial<Record<NavBadgeKey, number>>

/** How many recently opened pages the overview keeps. */
export const RECENT_LIMIT = 5

/** The areas as one reader sees them: pages they may not open are left out, and so is an area left with none. */
export function areasFor(areas: NavArea[], capabilities: readonly string[]): NavArea[] {
  const allowed = (item: NavItem) => !item.capability || capabilities.includes(item.capability)
  return areas.flatMap((area) => {
    const groups = area.groups
      .map((group) => ({ ...group, items: group.items.filter(allowed) }))
      .filter((group) => group.items.length)
    return groups.length ? [{ ...area, groups }] : []
  })
}

/** What an area's mark says on the rail and the tab bar: the sum of its pages' counts, if any. */
export function areaCount(area: NavArea, counts: NavCounts): number {
  return area.groups
    .flatMap((group) => group.items)
    .reduce((sum, item) => sum + ((item.badge && counts[item.badge]) || 0), 0)
}

/** Puts a page first among the recent ones; the dashboard is the overview itself, so it is never listed. */
export function rememberRecent(recent: readonly string[], to: string): string[] {
  if (to === "/") return [...recent]
  return [to, ...recent.filter((entry) => entry !== to)].slice(0, RECENT_LIMIT)
}

/** The recent pages that still exist and that the reader may open, newest first. */
export function recentItems(recent: readonly string[], capabilities: readonly string[]): NavItem[] {
  return recent.flatMap((to) => {
    const item = NAV_ITEMS.find((entry) => entry.to === to && !entry.soon)
    return item && (!item.capability || capabilities.includes(item.capability)) ? [item] : []
  })
}

/** Near the top of a page the phone bar always shows. */
export const BAR_TOP_ZONE = 48
/** How far one scroll down goes before the phone bar slides away. */
export const BAR_HIDE_AFTER = 8
/** How far one scroll back up goes before the phone bar returns: a short pull, not the whole way to the top. */
export const BAR_SHOW_AFTER = 32

/** Where the page was at the last scroll, and how far it has moved in the same direction since it last turned. */
export interface BarScroll {
  hidden: boolean
  last: number
  travel: number
}

export const barAtTop: BarScroll = { hidden: false, last: 0, travel: 0 }

/** The phone bar after the page scrolled to `top`: away while reading down, back after a short scroll up. */
export function followScroll(state: BarScroll, top: number): BarScroll {
  if (top <= BAR_TOP_ZONE) return { hidden: false, last: top, travel: 0 }
  const delta = top - state.last
  if (!delta) return state
  const travel = Math.sign(delta) === Math.sign(state.travel) ? state.travel + delta : delta
  const hidden = travel >= BAR_HIDE_AFTER ? true : travel <= -BAR_SHOW_AFTER ? false : state.hidden
  return { hidden, last: top, travel }
}
