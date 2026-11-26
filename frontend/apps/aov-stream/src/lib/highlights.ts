import { byLength, pickedOnce, type Sides, type TeamHeroRecord } from "./facts-model.ts"
import { sideOf, wonBy, type FeedGame } from "./game-feed.ts"
import { heroTeams, leastRate, type HeroRecord } from "./hero-model.ts"
import type { MvpRecord } from "./team-draft-model.ts"

type Say = (vi: string, en: string) => string

/**
 * Whether a record is worth telling: read as cautiously as its few games ask for, it still stands near half or above.
 * Nine to one does; three to two, which any two heroes reach, does not.
 */
export const isTelling = (record: { wins: number; losses: number }) => leastRate(record) >= 0.45

/** Who played the games of a record, most games first, and how many of the games do not say. */
export type Seats = { players: { playerId: string; games: number }[]; unknown: number }

export function seatsOf(record: HeroRecord, teamId: string): Seats {
  const team = heroTeams(record).find((item) => item.teamId === teamId)
  const players = team?.players ?? []
  const named = players.reduce((sum, { games }) => sum + games, 0)
  return { players, unknown: (team?.picks.length ?? 0) - named }
}

/** The player a record is told of: the one who played nearly all of its games, while no seat names anybody else. */
export const playerTold = ({ playerId }: Pick<TeamHeroRecord, "playerId">, { players }: Seats) =>
  players.length === 1 ? playerId : null

/** What the seats say besides the player a record is told of: who shared its games, and how many name nobody. */
export function seatWords(
  { players, unknown }: Seats,
  told: string | null,
  nameOf: (playerId: string) => string,
  text: Say,
): string | null {
  if (told)
    return unknown > 0
      ? text(
          `chưa rõ ai chơi ở ${unknown} ván`,
          `${unknown} ${unknown === 1 ? "game does" : "games do"} not say who played`,
        )
      : null
  if (!players.length) return null
  const shares = players.map(({ playerId, games }) => `${nameOf(playerId)} ${games}`)
  return [...shares, unknown > 0 && text(`chưa rõ ${unknown}`, `unknown ${unknown}`)].filter(Boolean).join(", ")
}

/** The decided games two sides need before anything is said of their difference. */
const ENOUGH_SIDES = 10

/** How the two sides of the map compare, in one sentence; null while too few games are decided. */
export function sidesWords({ blue, red, verdict }: Sides, text: Say, languageTag: string): string | null {
  const decided = blue + red
  if (decided < ENOUGH_SIDES) return null
  const apart = Math.abs(blue - red)
  const [more, all] = [apart, decided].map((value) => value.toLocaleString(languageTag))
  if (!apart) return text("Hai bên thắng số ván bằng nhau.", "Both sides won as many games.")
  if (verdict === "EVEN")
    return apart <= decided / 10
      ? text(`Gần như ngang nhau: hơn kém ${more} trong ${all} ván.`, `Nearly level: ${more} apart in ${all} games.`)
      : text(
          `Hơn kém ${more} trong ${all} ván, còn quá ít ván để nói hai bên khác nhau.`,
          `${more} apart in ${all} games, too few to tell the sides apart.`,
        )
  const side = blue > red ? text("Bên xanh", "The blue side") : text("Bên đỏ", "The red side")
  return verdict === "TEAMS"
    ? text(
        `${side} thắng nhiều hơn ${more} ván, nhưng các đội hay thắng cũng ngồi bên đó nhiều hơn.`,
        `${side} won ${more} more, but the teams that win more often also sat there more.`,
      )
    : text(
        `${side} thắng nhiều hơn ${more} trong ${all} ván, kể cả khi đã tính đội nào ngồi bên nào.`,
        `${side} won ${more} more of ${all} games, even counting which teams sat where.`,
      )
}

/** The minutes written under a chart of one column a minute: every fifth, or every tenth where they would crowd. */
export function minuteTicks(columns: { minute: number }[]): number[] {
  const every = columns.length > 30 ? 10 : 5
  return columns.map(({ minute }) => minute).filter((minute) => minute % every === 0)
}

/** The games told of each end. */
const EXTREMES = 3

/** The shortest and the longest games; a list too short for both holds every game once, the shortest first. */
export function lengthExtremes(games: FeedGame[]): { short: FeedGame[]; long: FeedGame[] } {
  const timed = byLength(games, "short")
  if (timed.length <= 2 * EXTREMES) return { short: timed, long: [] }
  return { short: timed.slice(0, EXTREMES), long: byLength(games, "long").slice(0, EXTREMES) }
}

/** The players told of at most. */
const MVPS = 5

/**
 * The players with the most MVPs of several, and how many more are level with the last of them. A cut through players
 * who are level is made above them while three remain.
 */
export function topMvps(records: MvpRecord[]): { rows: MvpRecord[]; level: number } {
  const told = records.filter(({ games }) => games.length > 1)
  const rows = told.slice(0, MVPS)
  const least = rows.at(-1)?.games.length ?? 0
  const level = told.slice(MVPS).filter(({ games }) => games.length === least).length
  if (!level) return { rows, level }
  const above = rows.filter(({ games }) => games.length > least)
  return above.length >= 3 ? { rows: above, level: 0 } : { rows, level }
}

/** How many games a team won, and how many of those name the MVP, who is always one of the side that won. */
export function winsOf(games: FeedGame[], teamId: string): { won: number; named: number } {
  const won = games.filter((game) => {
    const side = sideOf(game, teamId)
    return side && wonBy(game, side)
  })
  return { won: won.length, named: won.filter(({ mvpId }) => mvpId).length }
}

/** Heroes picked in a single game, while that is rare; among few games it is what happens to most heroes. */
export function rarePicks(records: Map<string, HeroRecord>) {
  const once = pickedOnce(records)
  const picked = [...records.values()].filter(({ picks }) => picks.length > 0).length
  return once.length <= picked / 5 ? once : []
}

/** The room there is for facts: one column, two narrow stacks, or two in which lists fit side by side. */
export type FactRoom = "column" | "narrow" | "wide"

/** The room on a page so many pixels wide; the limits are also written in the sheets of the facts. */
export const factRoom = (width: number): FactRoom => (width < 736 ? "column" : width < 1036 ? "narrow" : "wide")

/** How much more even two stacks have to come out before the second block leaves the top of the right one. */
const WORTH_MOVING = 120

/**
 * Blocks set out in two stacks as even as their heights allow, the first on the left and, unless that leaves them far
 * apart, the second on the right. Each stack keeps the order of the blocks.
 */
export function splitStacks(heights: number[]): [left: number[], right: number[]] {
  const isRight = (at: number, choice: number) => at > 0 && ((choice >> (at - 1)) & 1) === 1
  let best = { choice: 0, price: Infinity }
  for (let choice = 0; choice < 2 ** Math.max(0, heights.length - 1); choice += 1) {
    const apart = Math.abs(heights.reduce((sum, height, at) => sum + (isRight(at, choice) ? -height : height), 0))
    const price = apart + (isRight(1, choice) ? 0 : WORTH_MOVING)
    if (price < best.price) best = { choice, price }
  }
  const places = heights.map((_, at) => at)
  return [places.filter((at) => !isRight(at, best.choice)), places.filter((at) => isRight(at, best.choice))]
}
