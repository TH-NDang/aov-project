import type { Lane } from "@aov/community-contracts"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { score, shownText } from "./feed-words.ts"
import type { Counted, FeedHero } from "./game-feed.ts"
import {
  enoughPicks,
  heroShelves,
  needsBans,
  sortLines,
  type HeroLine,
  type HeroOrder,
  type Tally,
} from "./hero-model.ts"
import { LANE_WORDS } from "./question-words.ts"
import { ENOUGH_FOR_SHARE, shareText } from "./shares.ts"
import { statsHref } from "./statistics-routes.ts"
import { LANES } from "./tournament-model.ts"

type Say = (vi: string, en: string) => string
type Names = readonly [vi: string, en: string]

/** How the heroes of a competition are looked at: what orders them, as a table or as faces, and the lane they play. */
export type HeroesView = { by: HeroOrder; table: boolean; lane: Lane | null }

/** What the heroes can be ordered by, in Vietnamese and in English, and what each counts. */
export const ORDER_WORDS: Record<HeroOrder, { name: Names; counts: Names }> = {
  presence: { name: ["Có mặt", "Presence"], counts: ["Ván được chọn hoặc bị cấm", "Games picked or banned in"] },
  picks: { name: ["Chọn", "Picked"], counts: ["Ván được chọn", "Games picked in"] },
  wins: { name: ["Thắng", "Won"], counts: ["Ván thắng trong các ván được chọn", "Games won of those picked in"] },
  bans: { name: ["Cấm", "Banned"], counts: ["Ván bị cấm", "Games banned in"] },
}
const HERO_ORDERS = Object.keys(ORDER_WORDS) as HeroOrder[]

/** What the heroes of some games can be ordered by; while none of the games shows its bans, not by those. */
export const heroOrders = ({ shown }: Counted) => HERO_ORDERS.filter((order) => shown > 0 || !needsBans(order))

/** The view an address asks for, with the first of the orders there are while it asks for none of them. */
export function readHeroesView(params: URLSearchParams, orders = HERO_ORDERS): HeroesView {
  return {
    by: orders.find((order) => order === params.get("by")) ?? orders[0]!,
    table: params.get("as") === "table",
    lane: LANES.find((lane) => lane === params.get("lane")) ?? null,
  }
}

/** The address of the heroes looked at in one way; what every reader starts with is left out of it. */
export function heroesHref(
  competitionId: string,
  { by = "presence", table = false, lane = null }: Partial<HeroesView>,
  scope?: string | null,
) {
  const params = new URLSearchParams()
  if (by !== "presence") params.set("by", by)
  if (table) params.set("as", "table")
  if (lane) params.set("lane", lane)
  const href = statsHref(competitionId, { part: "heroes", scope })
  return params.size ? `${href}&${params}` : href
}

/** Whether a hero belongs to a lane: it played five games there, or a fifth of those it was picked in. */
export function playsLane({ lanes, picks }: Pick<HeroLine, "lanes" | "picks">, lane: Lane) {
  const games = lanes.find((item) => item.lane === lane)?.games ?? 0
  return games >= 5 || (games > 0 && games >= picks / 5)
}

/** Which of the heroes the list holds, once it is narrowed to a lane, and what their figures count. */
export function laneNote(heroes: number, lane: Lane, text: Say) {
  const where = text(...LANE_WORDS[lane])
  return text(
    `${heroes} tướng chơi ${where} từ 5 ván hoặc 20% lượt chọn. Số liệu tính cả các đường khác.`,
    `${heroes === 1 ? "1 hero with 5 games or 20% of its" : `${heroes} heroes with 5 games or 20% of their`} picks ${where}. The figures count every lane.`,
  )
}

/** A name the way a reader types it: without tone marks, apostrophes or spaces. */
const typed = (name: string) => foldSearchText(name).replace(/[^\p{L}\p{N}]/gu, "")

/** The heroes whose names hold what is typed. */
export function namedLike<T extends { hero: Pick<FeedHero, "name"> }>(list: T[], search: string): T[] {
  const sought = typed(search)
  return list.filter(({ hero }) => typed(hero.name).includes(sought))
}

export type HeroShelf = {
  /** What its heroes share: a range of figures, too few picks to compare, or a figure nobody gave them. */
  kind: "RANGE" | "FEW" | "NONE"
  /** The limits of a range: shares of all games, or of the games won. */
  from: number
  below: number | null
  /** The width of its faces in pixels: the higher the shelf, the larger. */
  face: 96 | 80 | 64 | 52
  lines: HeroLine[]
}

function faceOf(by: HeroOrder, from: number): HeroShelf["face"] {
  if (by === "wins") return from >= 60 ? 96 : 80
  if (from >= 50) return 96
  if (from >= 25) return 80
  return from >= 5 ? 64 : 52
}

/**
 * Every hero on the shelf it belongs to. The shelves of an order leave out the heroes it says nothing about, those
 * nobody picked or banned; they close the wall, so that each hero is found whatever the order.
 */
export function heroWall(lines: HeroLine[], by: HeroOrder, counted: Counted): HeroShelf[] {
  const says = (line: HeroLine) =>
    (by === "presence" ? line.seen : by === "wins" ? line.wins + line.losses : line[by]) > 0
  const rest = lines.filter((line) => !says(line))
  const last = { from: 0, below: null, face: 52 } as const
  return [
    ...heroShelves(lines.filter(says), by, counted).map(({ from, below, lines: own }): HeroShelf =>
      from == null
        ? { ...last, kind: "FEW", lines: own }
        : { kind: "RANGE", from, below, face: faceOf(by, from), lines: own },
    ),
    ...(rest.length ? [{ ...last, kind: "NONE" as const, lines: sortLines(rest, "presence", counted.games) }] : []),
  ]
}

/** The first heroes of a wall, shelf by shelf, for a wall that grows as it is read. */
export function firstOfWall(shelves: HeroShelf[], count: number): { shelf: HeroShelf; lines: HeroLine[] }[] {
  let left = count
  return shelves.flatMap((shelf) => {
    const lines = shelf.lines.slice(0, Math.max(0, left))
    left -= shelf.lines.length
    return lines.length ? [{ shelf, lines }] : []
  })
}

/** The limits of a shelf in games, where there are only `all` of them and so too few for shares. */
function limitsInGames({ from, below }: Pick<HeroShelf, "from" | "below">, all: number, only: string, text: Say) {
  const least = Math.max(1, Math.ceil((from * all) / 100))
  const most = below == null ? all : Math.ceil((below * all) / 100) - 1
  if (least === all && all > 1) return text(`Cả ${all} ván${only}`, `All ${all} games${only}`)
  if (below == null && least < all) return text(`Từ ${least} ván${only}`, `${least} or more games${only}`)
  const range = least < most ? `${least}–${most}` : `${least}`
  return text(`${range} ván${only}`, only ? `${range} of the games${only}` : `${range} ${most > 1 ? "games" : "game"}`)
}

/** What a shelf holds, in numbers. */
export function shelfTitle({ kind, from, below }: HeroShelf, by: HeroOrder, counted: Counted, text: Say): string {
  if (kind === "FEW") {
    const enough = enoughPicks(counted.games)
    return text(`Dưới ${enough} lượt chọn, chưa đủ để so`, `Fewer than ${enough} picks, too few to compare`)
  }
  const only = needsBans(by) ? shownText(counted, text) : ""
  if (kind === "NONE") {
    if (by === "presence") return text(`Không có mặt ở ván nào${only}`, `Seen in none of the games${only}`)
    if (by === "bans")
      return only
        ? text(`Không bị cấm ở ván nào${only}`, `Banned in none of the games${only}`)
        : text("Chưa bị cấm ván nào", "Never banned")
    return by === "wins"
      ? text("Chưa có kết quả ván nào", "No result yet")
      : text("Chưa được chọn ván nào", "Never picked")
  }
  const range = below == null ? null : `${from}–${below - 1}%`
  if (by === "wins") {
    if (!range) return text(`Thắng từ ${from}%`, `Won ${from}% or more`)
    return from ? text(`Thắng ${range}`, `Won ${range}`) : text(`Thắng dưới ${below}%`, `Won under ${below}%`)
  }
  const all = needsBans(by) ? counted.shown : counted.games
  if (all < ENOUGH_FOR_SHARE) return limitsInGames({ from, below }, all, only, text)
  if (!range) return text(`Từ ${from}% số ván${only}`, `${from}% of games${only} or more`)
  return from
    ? text(`${range} số ván${only}`, `${range} of games${only}`)
    : text(`Dưới ${below}% số ván${only}`, `Under ${below}% of games${only}`)
}

/** How the picks of a hero ended, in words; without a result they are told from no pick at all. */
export function picksWords({ games, wins, losses }: Tally, text: Say, languageTag: string) {
  if (!games) return text("chưa được chọn", "never picked")
  if (!(wins + losses)) return text("chưa có kết quả ván nào", "no result yet")
  const [won, lost] = [wins, losses].map((value) => value.toLocaleString(languageTag))
  return text(`thắng ${won}, thua ${lost}`, `won ${won}, lost ${lost}`)
}

/** The share of its decided games a record won, once it is long enough for one. */
export function wonShare({ wins, losses }: Pick<HeroLine, "wins" | "losses">, below: number | null = null) {
  return wins + losses >= ENOUGH_FOR_SHARE ? shareText(wins, wins + losses, below) : null
}

/** The figure of a face: a share, a number of games with its unit, or a record with the share it won. */
export type HeroFigure = { figure: string; unit?: string; share?: string | null }

/**
 * What a face says of its hero. A record has its share beside it where it can be compared. The lowest shelf counts games,
 * where a share would read as nothing, and so do all shelves while there are too few games for a share.
 */
export function heroFigure(
  line: HeroLine,
  { kind, from, below }: HeroShelf,
  by: HeroOrder,
  { shown }: Counted,
  text: Say,
  languageTag: string,
): HeroFigure | null {
  if (kind === "NONE") return null
  if (by === "wins") return { figure: score(line), share: kind === "FEW" ? null : wonShare(line, below) }
  if (by === "presence" && from > 0 && shown >= ENOUGH_FOR_SHARE) return { figure: shareText(line.seen, shown, below) }
  const count = by === "presence" ? line.seen : line[by]
  return { figure: count.toLocaleString(languageTag), unit: text("ván", count === 1 ? "game" : "games") }
}

/** Everything a hero's face and bar show, in words. Of games that do not show their bans only the picks are told. */
export function heroSummary(line: HeroLine, counted: Counted, text: Say, languageTag: string) {
  const { hero, picks, wins, losses, bans } = line
  const number = (value: number) => value.toLocaleString(languageTag)
  const [games, shown, present, chosen] = [counted.games, counted.shown, line.seen, picks].map(number)
  const only = shownText(counted, text)
  const seen =
    counted.shown > 0 &&
    text(`có mặt ${present} trong ${shown} ván${only}`, `seen in ${present} of ${shown} games${only}`)
  const record =
    wins + losses > 0 &&
    text(`thắng ${number(wins)}, thua ${number(losses)}`, `won ${number(wins)}, lost ${number(losses)}`)
  const taken = seen
    ? text(`chọn ${chosen}`, `picked ${chosen}`)
    : text(`chọn ${chosen} trong ${games} ván`, `picked in ${chosen} of ${games} games`)
  const picked = picks ? [taken, record].filter(Boolean).join(", ") : text("chưa được chọn", "never picked")
  const banned = bans
    ? text(`bị cấm ${number(bans)}`, `banned ${number(bans)}`)
    : !only && text("chưa bị cấm", "never banned")
  return `${hero.name}: ${[seen, picked, banned].filter(Boolean).join("; ")}`
}
