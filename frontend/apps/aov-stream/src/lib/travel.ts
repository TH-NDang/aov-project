/** How a reader moves between two pages: deeper into something, back out of it, or within the page they are on. */
export type Way = "in" | "out" | "stay"

/** A step of the browser's history: what made it, and how many entries it went (negative goes back). */
export type Step = { action: "PUSH" | "REPLACE" | "POP"; delta: number; from: string; to: string }

/** How deep each address stands under its section; an address not listed stands at the section itself. */
const DEPTHS: [RegExp, number][] = [
  [/^\/games\/[^/]+/, 3],
  [/^\/(matches\/[^/]+|competitions\/[^/]+\/matches\/[^/]+)/, 2],
  [/^\/(competitions|pages|teams|players|people|manage)\/[^/]+/, 1],
]

export const depthOf = (pathname: string) => DEPTHS.find(([pattern]) => pattern.test(pathname))?.[1] ?? 0

/** Which way a step goes. Going up by a link leaves a page as much as going back does. */
export function wayOf({ action, delta, from, to }: Step): Way {
  if (from === to || action === "REPLACE") return "stay"
  if (action === "POP") return delta < 0 ? "out" : delta > 0 ? "in" : "stay"
  return depthOf(to) < depthOf(from) ? "out" : "in"
}

/** Whether a step lands at the top of a page. Going back or forward lands where the reader was. */
export const landsAtTop = ({ action, from, to }: Step) => action !== "POP" && from !== to

/** What the address of a page says about the part of it that is open. */
const PARTS = ["tab", "hero", "kind"]

/** Whether a step opens another part of the same page. */
export function opensPart({ action, from, to }: Step, fromSearch: string, toSearch: string) {
  if (action === "POP" || from !== to) return false
  const [before, after] = [new URLSearchParams(fromSearch), new URLSearchParams(toSearch)]
  return PARTS.some((part) => before.get(part) !== after.get(part))
}

/** Whether a step searches anew on the page of the results. */
export const searchesAnew = ({ action, from, to }: Step, fromSearch: string, toSearch: string) =>
  action === "PUSH" &&
  from === to &&
  new URLSearchParams(fromSearch).get("q") !== new URLSearchParams(toSearch).get("q")

type Entry = { key: string; pathname: string; search: string }

/** The name of a history entry. The first one of a visit has no key of its own, so its address stands in. */
export const entryKey = ({ key, pathname, search }: Entry) => (key === "default" ? `first:${pathname}${search}` : key)

/** Entries whose places are kept; the oldest give way. */
const KEPT = 80

/** Where a reader stood on each entry of the history, the entry touched last at the end. */
export function placeMemory(saved?: string | null) {
  let places: [string, number][] = []
  try {
    const read: unknown = JSON.parse(saved || "[]")
    if (Array.isArray(read))
      places = read.filter(
        (place): place is [string, number] =>
          Array.isArray(place) && typeof place[0] === "string" && typeof place[1] === "number",
      )
  } catch {
    // What another version of the app saved is not worth keeping.
  }
  return {
    recall: (key: string) => places.find(([name]) => name === key)?.[1],
    remember: (key: string, top: number) => {
      places = [...places.filter(([name]) => name !== key), [key, top] as [string, number]].slice(-KEPT)
    },
    save: () => JSON.stringify(places),
  }
}
