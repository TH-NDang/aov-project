/** A mark with the gap after it, the least a score takes, what parts two matches, and air, in pixels. */
const MARK_STEP = 6
const SCORE = 28
const LEG_GAP = 9
const CLEAR = 6

/** The width a cell needs to set some matches side by side, each as wide as its score or the marks of `games` games. */
const roomForMatches = (legs: number, games = 0) =>
  legs * Math.max(SCORE, games * MARK_STEP - 2) + Math.max(0, legs - 1) * LEG_GAP + CLEAR

/** The width a cell needs for one sum over the marks of `games` games. */
const roomForSum = (games: number) => Math.max(SCORE + LEG_GAP, games * MARK_STEP) + CLEAR

/** About how wide a bold name is, so that a column of names fits the longest of them. */
export const nameWidth = (name: string, size: number) =>
  size *
  [...name].reduce((sum, letter) => {
    if (/\d/.test(letter)) return sum + 0.66
    if (!/\p{L}/u.test(letter)) return sum + 0.35
    return sum + (letter === letter.toLocaleLowerCase("vi-VN") ? 0.56 : 0.8)
  }, 0)

/** The widest a column gets: a small group keeps its teams near each other instead of spreading over the page. */
const WIDEST = 184
/** The narrowest table that draws marks and crests; a phone keeps to names and scores. */
const PHONE = 560
/** The narrowest column a day fits into on one line. */
const DAY = 44

/** The letters of a name, what stands beside it, and the least and the most its column takes. */
const NAMES = {
  phone: { size: 12, beside: 4, least: 34, most: 64 },
  compact: { size: 13, beside: 38, least: 76, most: 124 },
  wide: { size: 15, beside: 58, least: 116, most: 172 },
}

export type TableRoom = {
  /** How the names of the rows are drawn. */
  names: keyof typeof NAMES
  /** The width of the column of names, and of every other column, in pixels. */
  first: number
  column: number
  /** What a cell has room for: marks over the scores, scores side by side, or scores one under the other. */
  kind: "marks" | "scores" | "stack"
  /** A column without room for a day on one line. */
  narrow: boolean
  /** The names are too long to head the columns of a phone, so the crests of the teams do. */
  crests: boolean
}

/** What a table of every pair of some teams has room for, when a pair usually plays `legs` matches of up to `games`. */
export function tableRoom(
  width: number,
  teams: string[],
  {
    compact,
    marked,
    sum,
    legs,
    games,
  }: { compact: boolean; marked: boolean; sum: boolean; legs: number; games: number },
): TableRoom {
  const names = width < PHONE ? "phone" : compact ? "compact" : "wide"
  const { size, beside, least, most } = NAMES[names]
  const longest = Math.max(0, ...teams.map((team) => nameWidth(team, size)))
  const first = Math.ceil(Math.min(most, Math.max(least, longest + beside)))
  const column = Math.max(0, Math.min(WIDEST, (width - first) / (teams.length || 1)))
  const needed = sum ? roomForSum(games * legs) : roomForMatches(legs, games)
  // One match a pair has nothing to stand under, however narrow the columns are.
  const sideBySide = legs < 2 || column >= roomForMatches(legs)
  return {
    names,
    first,
    column,
    kind: marked && names !== "phone" && column >= needed ? "marks" : sideBySide ? "scores" : "stack",
    narrow: column < DAY,
    crests: names === "phone" && longest > column + 12,
  }
}

/** What a match of a path takes beside the name of the opponent, and the column of the team's own name, in pixels. */
const PATHS = {
  /** Mark, crest, name and score on one line. */
  crest: { size: 14, round: 108, first: 60 },
  /** The same without the crest. */
  line: { size: 14, round: 74, first: 60 },
  /** The score under the name. */
  stack: { size: 12, round: 18, first: 34 },
}

export type PathRoom = {
  look: keyof typeof PATHS
  /** The width of the column of names, of the name of an opponent, and the least a round takes, in pixels. */
  first: number
  rival: number
  round: number
}

/** What the paths of some teams through a number of rounds have room for; rounds that do not fit scroll sideways. */
export function pathRoom(width: number, teams: string[], rounds: number): PathRoom {
  const longest = (size: number) => Math.max(0, ...teams.map((team) => nameWidth(team, size)))
  const roomOf = (look: keyof typeof PATHS): PathRoom => {
    const path = PATHS[look]
    const rival = Math.min(look === "stack" ? 64 : 150, Math.max(32, longest(path.size)))
    const first = Math.min(172, Math.max(look === "stack" ? 64 : 124, longest(look === "stack" ? 12 : 15) + path.first))
    return { look, first: Math.ceil(first), rival: Math.ceil(rival), round: Math.ceil(path.round + rival) }
  }
  const looks = (["crest", "line"] as const).map(roomOf)
  return looks.find(({ first, round }) => first + rounds * round <= width) ?? roomOf("stack")
}

export type CellAt = readonly [row: number, column: number]

/** The first cell of a table that opens something, from a row on. */
export function firstCell(opens: boolean[][], from = 0): CellAt | null {
  for (let step = 0; step < opens.length; step += 1) {
    const row = (from + step) % opens.length
    const column = opens[row]!.indexOf(true)
    if (column >= 0) return [row, column]
  }
  return null
}

/** The cell a key leads to from another: the next one in its direction that opens something, or an end of the row. */
export function nextCell(opens: boolean[][], [row, column]: CellAt, key: string): CellAt | null {
  const columns = opens[row]?.length ?? 0
  const walk = (from: number, step: 1 | -1, end: number, cell: (at: number) => CellAt) => {
    for (let at = from; at !== end; at += step) {
      const [r, c] = cell(at)
      if (opens[r]?.[c]) return cell(at)
    }
    return null
  }
  const inRow = (at: number): CellAt => [row, at]
  const inColumn = (at: number): CellAt => [at, column]
  if (key === "ArrowRight") return walk(column + 1, 1, columns, inRow)
  if (key === "ArrowLeft") return walk(column - 1, -1, -1, inRow)
  if (key === "ArrowDown") return walk(row + 1, 1, opens.length, inColumn)
  if (key === "ArrowUp") return walk(row - 1, -1, -1, inColumn)
  if (key === "Home") return walk(0, 1, columns, inRow)
  if (key === "End") return walk(columns - 1, -1, -1, inRow)
  return null
}
