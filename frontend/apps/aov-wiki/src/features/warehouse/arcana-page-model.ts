import { ITEM_STATS } from "@aov/ui/lib/item-description"

/** An arcana page holds ten pieces of each color. */
export const ARCANA_PAGE_SLOTS = 10

/** One arcana on the page and how many of its pieces are placed. */
export type PagePiece = { code: string; count: number }

/** What the page needs to know of an arcana. */
export type PageArcana = {
  code: string
  color: string
  stats: { key: string; value: number; unit: string | null }[]
}

export type PageTotal = { key: string; unit: string | null; value: number }

const colorOf = (arcana: PageArcana[], code: string) => arcana.find((entry) => entry.code === code)?.color

/** How many slots of a color the page fills. */
export function colorCount(page: PagePiece[], arcana: PageArcana[], color: string) {
  return page.reduce((total, piece) => total + (colorOf(arcana, piece.code) === color ? piece.count : 0), 0)
}

/** Places pieces of one arcana, as many as its color has room for. */
export function addPieces(page: PagePiece[], arcana: PageArcana[], code: string, amount = 1): PagePiece[] {
  const color = colorOf(arcana, code)
  if (!color || amount < 1) return page
  const placed = Math.min(amount, ARCANA_PAGE_SLOTS - colorCount(page, arcana, color))
  if (placed < 1) return page
  return page.some((piece) => piece.code === code)
    ? page.map((piece) => (piece.code === code ? { ...piece, count: piece.count + placed } : piece))
    : [...page, { code, count: placed }]
}

/** Takes pieces of one arcana off the page; an arcana left with none leaves the page. */
export function removePieces(page: PagePiece[], code: string, amount = 1): PagePiece[] {
  return page
    .map((piece) => (piece.code === code ? { ...piece, count: piece.count - amount } : piece))
    .filter((piece) => piece.count > 0)
}

/** The pieces in the game's color order, red, purple then green, each color in the order its pieces were placed. */
export function byColor(
  page: PagePiece[],
  arcana: PageArcana[],
  colors: readonly string[] = ["RED", "PURPLE", "GREEN"],
) {
  const rank = (piece: PagePiece) => {
    const index = colors.indexOf(colorOf(arcana, piece.code) ?? "")
    return index < 0 ? colors.length : index
  }
  return page
    .map((piece, order) => ({ piece, order }))
    .sort((a, b) => rank(a.piece) - rank(b.piece) || a.order - b.order)
    .map(({ piece }) => piece)
}

/** Fills every free slot of the arcana's color with it. */
export function fillColor(page: PagePiece[], arcana: PageArcana[], code: string) {
  return addPieces(page, arcana, code, ARCANA_PAGE_SLOTS)
}

/** Empties the slots of one color. */
export function clearColor(page: PagePiece[], arcana: PageArcana[], color: string) {
  return page.filter((piece) => colorOf(arcana, piece.code) !== color)
}

/**
 * The page as the address keeps it: `code*count` joined by commas, a single piece without its count. Read back, an
 * unknown code is dropped and a color never holds more than its slots, so an edited link cannot overfill the page.
 */
export function writeArcanaPage(page: PagePiece[]) {
  return page.map((piece) => (piece.count === 1 ? piece.code : `${piece.code}*${piece.count}`)).join(",")
}

export function readArcanaPage(value: string | null, arcana: PageArcana[]): PagePiece[] {
  let page: PagePiece[] = []
  for (const part of (value ?? "").split(",")) {
    const [code = "", count = "1"] = part.trim().split("*")
    const amount = Number.parseInt(count, 10)
    if (code && Number.isFinite(amount)) page = addPieces(page, arcana, code, amount)
  }
  return page
}

/**
 * The page a reader pastes: a link to a page (its `slots=` value) or that value itself. Null when it names no arcana of
 * the page, so a stray paste never empties the page on screen.
 */
export function pastedArcanaPage(pasted: string, arcana: PageArcana[]) {
  let value = pasted.trim()
  try {
    value = new URL(value).searchParams.get("slots") ?? ""
  } catch {
    // Not a link: the text is the page itself.
  }
  const page = readArcanaPage(value, arcana)
  return page.length ? page : null
}

const STAT_ORDER = ITEM_STATS.map((stat) => stat.code)

/** The page's stats added up, one line per stat and unit, in the order the shared stat list gives them. */
export function pageTotals(page: PagePiece[], arcana: PageArcana[]): PageTotal[] {
  const totals = new Map<string, PageTotal>()
  for (const piece of page) {
    for (const stat of arcana.find((entry) => entry.code === piece.code)?.stats ?? []) {
      const unit = stat.unit === "%" || stat.unit === "PERCENT" ? "%" : stat.unit
      const id = `${stat.key}|${unit ?? ""}`
      const total = totals.get(id) ?? { key: stat.key, unit, value: 0 }
      totals.set(id, { ...total, value: total.value + stat.value * piece.count })
    }
  }
  const rank = (key: string) => (STAT_ORDER.includes(key) ? STAT_ORDER.indexOf(key) : STAT_ORDER.length)
  return [...totals.values()]
    .map((total) => ({ ...total, value: Math.round(total.value * 1000) / 1000 }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key) || (a.unit ? 1 : 0) - (b.unit ? 1 : 0))
}
