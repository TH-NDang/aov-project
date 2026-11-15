import { useSyncExternalStore } from "react"

/**
 * How many skin cards share a row at each width, widest first. A hero's row shows whole cards only, so the page needs
 * the number in script to know where the row ends; the grids read the same number from `--skin-columns`.
 */
const STEPS = [
  ["(min-width: 1180px)", 8],
  ["(min-width: 1024px)", 7],
  ["(min-width: 900px)", 6],
  ["(min-width: 640px)", 5],
  ["(min-width: 480px)", 4],
] as const
const NARROWEST = 3
const WIDEST = STEPS[0][1]

const queries = () => (typeof window.matchMedia === "function" ? STEPS.map(([query]) => window.matchMedia(query)) : [])

function subscribe(notify: () => void) {
  const lists = queries()
  for (const list of lists) list.addEventListener("change", notify)
  return () => {
    for (const list of lists) list.removeEventListener("change", notify)
  }
}

function read() {
  const lists = queries()
  if (!lists.length) return WIDEST
  const step = lists.findIndex((list) => list.matches)
  return step < 0 ? NARROWEST : STEPS[step][1]
}

/** Read synchronously, so the first frame already has the right number of cards in each row. */
export function useSkinColumns() {
  return useSyncExternalStore(subscribe, read, () => WIDEST)
}
