import type { DraftKind, Side } from "@aov/community-contracts"
import type { FeedGame, FeedHero, FeedSide } from "./game-feed.ts"

/** One turn of a draft: which side took it, and whether it bans or picks. */
export type ShapeTurn = { turn: number; kind: DraftKind; side: Side }
/** Neighbouring turns of one kind, such as the first bans; `nth` counts the acts of that kind from 1. */
export type DraftAct = { kind: DraftKind; nth: number; turns: ShapeTurn[] }
/** The order of turns most drafts follow, and the games whose whole draft follows it. */
export type DraftShape = { acts: DraftAct[]; games: FeedGame[] }

function turnsOf(game: FeedGame): ShapeTurn[] {
  return game.sides
    .flatMap(({ side, picks, bans }) => [
      ...picks.map(({ turn }) => ({ turn, kind: "PICK" as const, side })),
      ...bans.map(({ turn }) => ({ turn, kind: "BAN" as const, side })),
    ])
    .filter((item): item is ShapeTurn => item.turn != null)
    .sort((x, y) => x.turn - y.turn)
}

/** Whether every turn of a draft is known: none of them missing and none twice. */
const whole = (game: FeedGame, turns: ShapeTurn[]) =>
  turns.length > 0 &&
  turns.length === game.sides.reduce((sum, { picks, bans }) => sum + picks.length + bans.length, 0) &&
  turns.every(({ turn }, index) => turn === index + 1)

/** The shape most of the drafts with a known order share, or null while no order is known. */
export function draftShape(games: FeedGame[]): DraftShape | null {
  const shapes = new Map<string, { turns: ShapeTurn[]; games: FeedGame[] }>()
  for (const game of games) {
    const turns = turnsOf(game)
    if (!whole(game, turns)) continue
    const key = turns.map(({ kind, side }) => kind[0]! + side[0]!).join("")
    const known = shapes.get(key) ?? { turns, games: [] }
    known.games.push(game)
    shapes.set(key, known)
  }
  const [common] = [...shapes.values()].sort((x, y) => y.games.length - x.games.length)
  if (!common) return null
  const acts: DraftAct[] = []
  for (const turn of common.turns) {
    const last = acts.at(-1)
    if (last?.kind === turn.kind) last.turns.push(turn)
    else acts.push({ kind: turn.kind, nth: acts.filter((act) => act.kind === turn.kind).length + 1, turns: [turn] })
  }
  return { acts, games: common.games }
}

/**
 * The games whose known turns ban and pick where a shape does. A draft with a missed ban is one of them, and so is one in
 * which the sides took each other's turns: both say in which part of the draft a team took a hero.
 */
export function shapedGames(shape: DraftShape, games: FeedGame[]): FeedGame[] {
  const kinds = new Map(shape.acts.flatMap((act) => act.turns.map(({ turn, kind }) => [turn, kind] as const)))
  return games.filter((game) => {
    const turns = turnsOf(game)
    return turns.length > 0 && turns.every(({ turn, kind }) => kinds.get(turn) === kind)
  })
}

/** A hero taken in an act of the draft, and in how many games. */
export type TakenHero = { hero: FeedHero; games: number }
/** What the two parties facing each other took in every act, the hero taken most often first. */
export type DraftScript = { games: number; acts: { act: DraftAct; taken: [TakenHero[], TakenHero[]] }[] }

/**
 * What each party takes in every act of its drafts. `partyOf` says which of the two parties a side of a game is, or
 * null for neither.
 */
export function draftScript(shape: DraftShape, partyOf: (game: FeedGame, side: FeedSide) => 0 | 1 | null): DraftScript {
  const actOf = new Map(shape.acts.flatMap((act, index) => act.turns.map(({ turn }) => [turn, index] as const)))
  const counts = shape.acts.map(() => [new Map<string, TakenHero>(), new Map<string, TakenHero>()] as const)
  const games = new Set<string>()
  for (const game of shape.games)
    for (const side of game.sides) {
      const party = partyOf(game, side)
      if (party == null) continue
      games.add(game.id)
      for (const { hero, turn } of [...side.picks, ...side.bans]) {
        const act = turn == null ? undefined : actOf.get(turn)
        if (act == null) continue
        const taken = counts[act]![party].get(hero.key) ?? { hero, games: 0 }
        taken.games += 1
        counts[act]![party].set(hero.key, taken)
      }
    }
  const sorted = (heroes: Map<string, TakenHero>) =>
    [...heroes.values()].sort((x, y) => y.games - x.games || x.hero.name.localeCompare(y.hero.name))
  return {
    games: games.size,
    acts: shape.acts.map((act, index) => ({ act, taken: [sorted(counts[index]![0]), sorted(counts[index]![1])] })),
  }
}

/** The share of games whose draft follows the shape that a chart by turns needs to speak for all of them. */
const ENOUGH_ORDER = 0.6

/** Whether the order of turns is known for enough of the games to draw anything by it. */
export const orderKnown = (shape: DraftShape | null, games: number): shape is DraftShape =>
  !!shape && shape.games.length >= ENOUGH_ORDER * games

/** How often one hero was taken at each turn of a shape. */
export function heroTurns(shape: DraftShape, hero: FeedHero): { turn: ShapeTurn; games: number }[] {
  const counts = new Map<number, number>()
  for (const game of shape.games)
    for (const { picks, bans } of game.sides)
      for (const item of [...picks, ...bans])
        if (item.hero.key === hero.key && item.turn != null) counts.set(item.turn, (counts.get(item.turn) ?? 0) + 1)
  return shape.acts.flatMap((act) => act.turns.map((turn) => ({ turn, games: counts.get(turn.turn) ?? 0 })))
}
