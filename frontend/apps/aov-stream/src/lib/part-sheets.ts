type Sheet = { link: HTMLLinkElement; here: Promise<boolean> }

const sheetOf = (link: HTMLLinkElement): Sheet => ({
  link,
  here: new Promise((resolve) => {
    link.addEventListener("load", () => resolve(true))
    link.addEventListener("error", () => resolve(false))
  }),
})

/**
 * Loads the file of a part and waits until every sheet that came with one is here. Vite asks for a sheet once only: a
 * file that comes second with the same sheet does not wait for it, and one that did not come is never asked for again,
 * so the part would stand there without its styles. `links` are the sheets of the page, and `lost` is told of a sheet
 * that did not come the second time either.
 */
export function partSheets(links: () => HTMLLinkElement[], lost: () => void) {
  const sheets = new Map<string, Sheet>()
  const note = (link: HTMLLinkElement) => sheets.set(link.href, sheetOf(link))

  /** Asks for a sheet once more, in its place among the others. */
  const askAgain = ({ link }: Sheet) => {
    const again = link.cloneNode() as HTMLLinkElement
    note(again)
    link.replaceWith(again)
  }

  return async <T>(load: () => Promise<T>): Promise<T> => {
    const before = new Set(links())
    const loading = load()
    for (const link of links()) if (!before.has(link)) note(link)
    const loaded = await loading
    for (const address of [...sheets.keys()]) {
      const sheet = sheets.get(address)!
      if (await sheet.here) continue
      // Unless another file that needs it has asked meanwhile.
      if (sheets.get(address) === sheet) askAgain(sheet)
      if (await sheets.get(address)!.here) continue
      lost()
      throw new Error(`No sheet at ${address}`)
    }
    return loaded
  }
}
