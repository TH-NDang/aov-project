import { partSheets } from "../../src/lib/part-sheets.ts"

/**
 * A page whose sheets come, or do not, when a test says so. Its files are loaded as Vite loads them: each sheet is asked
 * for once, and a file waits for those that it has asked for itself.
 */
export function sheetPage() {
  const head: SheetLink[] = []
  const asked: string[] = []
  const known = new Set<string>()
  let lost = 0

  class SheetLink extends EventTarget {
    href: string
    constructor(href: string) {
      super()
      this.href = href
      asked.push(href)
    }
    cloneNode() {
      return new SheetLink(this.href)
    }
    replaceWith(link: SheetLink) {
      head[head.indexOf(this)] = link
    }
  }

  const come = (link: SheetLink) =>
    new Promise((resolve, reject) => {
      link.addEventListener("load", resolve)
      link.addEventListener("error", () => reject(new Error(`Unable to preload ${link.href}`)))
    })
  const vite = (sheets: string[]) => {
    const own = sheets.filter((href) => !known.has(href)).map((href) => new SheetLink(href))
    for (const link of own) known.add(link.href)
    head.push(...own)
    return Promise.all(own.map(come))
  }
  const withSheets = partSheets(
    () => [...head] as unknown as HTMLLinkElement[],
    () => {
      lost += 1
    },
  )
  const tell = (href: string, what: "load" | "error") =>
    head.find((link) => link.href === href)!.dispatchEvent(new Event(what))

  return {
    /** Every sheet that was asked for, in order. */
    asked,
    /** The sheets as they stand in the page. */
    order: () => head.map(({ href }) => href),
    /** How many times it was told that a sheet is lost. */
    lost: () => lost,
    sheetComes: (href: string) => tell(href, "load"),
    sheetFails: (href: string) => tell(href, "error"),
    /** Loads a file that came with these sheets; says how far it is. */
    file(...sheets: string[]) {
      const file = { state: "WAITING" as "WAITING" | "HERE" | "LOST" }
      withSheets(() => vite(sheets)).then(
        () => (file.state = "HERE"),
        () => (file.state = "LOST"),
      )
      return file
    },
  }
}

/** Lets everything that is ready to go on do so. */
export const settle = () => new Promise<void>((resolve) => setImmediate(resolve))
