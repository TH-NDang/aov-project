import type { Lane, Side } from "@aov/community-contracts"
import { facing, heroByKey, wonBy, type FeedGame, type FeedHero, type FeedSide, type GameFeed } from "./game-feed.ts"
import { LANES } from "./tournament-model.ts"

/**
 * What a reader looks for, put like a draft: what one side (A) picked, what it met, what was banned, and how the game
 * went. Everything asked is joined by "and".
 */
export type Question = {
  /** The team on side A, and the one it met. */
  team: string | null
  opp: string | null
  /** Heroes side A picked, and heroes the other side picked. */
  pick: FeedHero[]
  vs: FeedHero[]
  /** Heroes banned by either side, by side A, and by the other side. */
  ban: FeedHero[]
  banA: FeedHero[]
  banB: FeedHero[]
  /** Someone of side A; next to one picked hero, the player of that hero. */
  player: string | null
  /** The player asked about was the MVP. */
  mvp: boolean
  /** The one hero picked and the one it met played the same lane. */
  duel: boolean
  /** The lane, and the turn of the draft, of the only hero asked about. */
  lane: Lane | null
  turn: number | null
  side: Side | null
  won: boolean | null
  /** Match days, yyyy-mm-dd, both included. */
  from: string | null
  to: string | null
  /** Whole minutes of the game's length, both included. */
  min: number | null
  max: number | null
}

/** The roles a hero can take in a question. */
export type HeroRole = "pick" | "vs" | "ban" | "banA" | "banB"
const HERO_ROLES: HeroRole[] = ["pick", "vs", "ban", "banA", "banB"]
/** How many heroes fit a role: the seats of a side, and the bans of a game or of a side. */
export const ROLE_SEATS: Record<HeroRole, number> = { pick: 5, vs: 5, ban: 8, banA: 4, banB: 4 }

/** Everything a question writes into the address. */
export const QUESTION_KEYS = [
  ...HERO_ROLES,
  "team",
  "opp",
  "player",
  "mvp",
  "duel",
  "lane",
  "turn",
  "side",
  "result",
  "from",
  "to",
  "min",
  "max",
] as const

export const NOTHING_ASKED: Question = {
  team: null,
  opp: null,
  pick: [],
  vs: [],
  ban: [],
  banA: [],
  banB: [],
  player: null,
  mvp: false,
  duel: false,
  lane: null,
  turn: null,
  side: null,
  won: null,
  from: null,
  to: null,
  min: null,
  max: null,
}

const wholeNumber = (value: string | null) => (value && /^\d{1,3}$/.test(value) ? Number(value) : null)
const dayKey = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null)
const oneOf = <T extends string>(value: string | null, known: readonly T[]) =>
  known.find((item) => item === value) ?? null

/** Reads a question from an address. Names the competition does not know are dropped. */
export function readQuestion(feed: GameFeed, params: URLSearchParams): Question {
  const { teams, players } = feed.view.content
  const heroes = (role: HeroRole) =>
    [...new Set((params.get(role) ?? "").split(".").flatMap((key) => heroByKey(feed, key) ?? []))].slice(
      0,
      ROLE_SEATS[role],
    )
  const known = (key: string, table: Record<string, unknown>) => {
    const value = params.get(key)
    return value && table[value] ? value : null
  }
  const result = params.get("result")
  const [pick, vs] = [heroes("pick"), heroes("vs")]
  return {
    team: known("team", teams),
    opp: known("opp", teams),
    pick,
    vs,
    ban: heroes("ban"),
    banA: heroes("banA"),
    banB: heroes("banB"),
    player: known("player", players),
    mvp: params.get("mvp") === "1" && !!known("player", players),
    duel: params.get("duel") === "1" && pick.length === 1 && vs.length === 1,
    lane: oneOf(params.get("lane"), LANES),
    turn: wholeNumber(params.get("turn")),
    side: oneOf(params.get("side"), ["BLUE", "RED"] as const),
    won: result === "win" ? true : result === "loss" ? false : null,
    from: dayKey(params.get("from")),
    to: dayKey(params.get("to")),
    min: wholeNumber(params.get("min")),
    max: wholeNumber(params.get("max")),
  }
}

/** What an address says for a question; a key without a value is left out. */
export function writeQuestion(question: Partial<Question>): [string, string][] {
  const asked = { ...NOTHING_ASKED, ...question }
  const heroes = HERO_ROLES.map((role): [string, string] => [role, asked[role].map((hero) => hero.key).join(".")])
  const rest: [string, string | number | null][] = [
    ["team", asked.team],
    ["opp", asked.opp],
    ["player", asked.player],
    ["mvp", asked.mvp ? "1" : null],
    ["duel", asked.duel && asked.pick.length === 1 && asked.vs.length === 1 ? "1" : null],
    ["lane", asked.lane],
    ["turn", asked.turn],
    ["side", asked.side],
    ["result", asked.won == null ? null : asked.won ? "win" : "loss"],
    ["from", asked.from],
    ["to", asked.to],
    ["min", asked.min],
    ["max", asked.max],
  ]
  return [...heroes, ...rest].flatMap(([key, value]): [string, string][] =>
    value == null || value === "" ? [] : [[key, String(value)]],
  )
}

/** Whether a question tells the two sides apart; one that does not counts a game as blue against red. */
export const asksSides = (question: Question) =>
  !!(
    question.team ||
    question.opp ||
    question.player ||
    question.side ||
    question.won != null ||
    question.pick.length ||
    question.vs.length ||
    question.banA.length ||
    question.banB.length
  )

/** Whether a question names someone of one side: a team, a player, or heroes one side picked or banned. */
export const namesSide = ({ team, opp, player, pick, vs, banA, banB }: Question) =>
  !!(team || opp || player || pick.length || vs.length || banA.length || banB.length)

/** Whether anything is asked at all. */
export const asksAnything = (question: Question) => writeQuestion(question).length > 0

/** Whether two questions ask the same. */
export const asksSame = (...questions: [Question, Question]) => {
  const [one, other] = questions.map((question) => String(new URLSearchParams(writeQuestion(question))))
  return one === other
}

const holds = (list: { hero: FeedHero }[], heroes: FeedHero[]) =>
  heroes.every((hero) => list.some((item) => item.hero.key === hero.key))

/** The one hero a lane and a turn speak of: the only one picked, or else the only one banned. */
export function soleHero({ pick, ban, banA, banB }: Question): { hero: FeedHero; role: HeroRole } | null {
  if (pick.length) return pick.length === 1 ? { hero: pick[0]!, role: "pick" } : null
  const banned = (["ban", "banA", "banB"] as const).flatMap((role) =>
    ({ ban, banA, banB })[role].map((hero) => ({ hero, role })),
  )
  return banned.length === 1 ? banned[0]! : null
}

/**
 * A question without the conditions that have nothing left to stand on: the lane or the turn of no one hero, a duel of
 * more than two, the best player of nobody. A side and a result need someone they are the side and the result of;
 * together they still ask which side of the map won.
 */
export function settled(question: Question): Question {
  const { player, pick, vs, lane, turn, side, won } = question
  const sole = soleHero(question)
  const sided = namesSide(question) || (side != null && won != null)
  return {
    ...question,
    mvp: question.mvp && !!player,
    duel: question.duel && pick.length === 1 && vs.length === 1,
    lane: sole?.role === "pick" || player ? lane : null,
    turn: sole ? turn : null,
    side: sided ? side : null,
    won: sided ? won : null,
  }
}

/** Another question out of one: the turn asked of its only hero does not pass on to another, nor to a ban from a pick. */
function reseated(question: Question, seats: Partial<Question>): Question {
  const next = { ...question, ...seats }
  const [before, after] = [soleHero(question), soleHero(next)]
  const same = before?.hero.key === after?.hero.key && (before?.role === "pick") === (after?.role === "pick")
  return settled(same ? next : { ...next, turn: null })
}

const others = (heroes: FeedHero[], hero: FeedHero) => heroes.filter(({ key }) => key !== hero.key)

export const withHero = (question: Question, role: HeroRole, hero: FeedHero): Question =>
  reseated(question, { [role]: [...others(question[role], hero), hero] })

export const withoutHero = (question: Question, role: HeroRole, hero: FeedHero): Question =>
  reseated(question, { [role]: others(question[role], hero) })

/** A question with one of its heroes in another role, which it takes last. */
export const movedHero = (question: Question, hero: FeedHero, from: HeroRole, to: HeroRole): Question =>
  reseated(question, { [from]: others(question[from], hero), [to]: [...others(question[to], hero), hero] })

function inTime({ day, seconds }: FeedGame, { from, to, min, max }: Question) {
  if ((from || to) && !day) return false
  if (from && day! < from) return false
  if (to && day! > to) return false
  if (min == null && max == null) return true
  if (seconds == null) return false
  const minute = Math.floor(seconds / 60)
  return (min == null || minute >= min) && (max == null || minute <= max)
}

/** What the two sides of a game took that a role speaks of. */
function takenAs(role: HeroRole, a: FeedSide, b: FeedSide | null): { hero: FeedHero; turn: number | null }[] {
  if (role === "pick") return a.picks
  if (role === "vs") return b?.picks ?? []
  if (role === "banA") return a.bans
  if (role === "banB") return b?.bans ?? []
  return [...a.bans, ...(b?.bans ?? [])]
}

function answers(game: FeedGame, a: FeedSide, question: Question) {
  const b = facing(game, a)
  const { team, opp, pick, vs, ban, banA, banB, player, mvp, duel, lane, turn, side, won } = question
  if (team && a.teamId !== team) return false
  if (opp && b?.teamId !== opp) return false
  if (side && a.side !== side) return false
  if (won != null && wonBy(game, a) !== won) return false
  if (!holds(a.picks, pick) || !holds(b?.picks ?? [], vs)) return false
  if (!holds(a.bans, banA) || !holds(b?.bans ?? [], banB)) return false
  if (!holds([...a.bans, ...(b?.bans ?? [])], ban)) return false
  const sole = soleHero(question)
  const seat = sole?.role === "pick" ? a.picks.find((item) => item.hero.key === sole.hero.key) : undefined
  if (player && mvp) {
    // The game names its MVP even where no seat names the player; the MVPs of this game come from the winning side.
    // Only a seat says which hero the player had.
    if (game.mvpId !== player || wonBy(game, a) === false) return false
    if (seat && seat.playerId !== player) return false
  } else if (player && (seat ? seat.playerId !== player : !a.picks.some((item) => item.playerId === player)))
    return false
  if (duel && pick.length === 1 && vs.length === 1) {
    const rival = b?.picks.find((item) => item.hero.key === vs[0]!.key)
    if (!seat?.lane || seat.lane !== rival?.lane) return false
  }
  if (lane && (seat || player)) {
    const seats = seat ? [seat] : a.picks.filter((item) => item.playerId === player)
    if (!seats.some((item) => item.lane === lane)) return false
  }
  if (turn != null && sole) {
    const taken = takenAs(sole.role, a, b).find((item) => item.hero.key === sole.hero.key)
    if (taken?.turn !== turn) return false
  }
  return true
}

/** A game that answers a question, seen from its side A. */
export type FoundGame = { game: FeedGame; a: FeedSide; b: FeedSide | null; won: boolean | null }

/** The ways a game answers a question, one for each side that can stand as side A. */
function readings(game: FeedGame, question: Question): FoundGame[] {
  if (!inTime(game, question)) return []
  return game.sides.flatMap((a): FoundGame[] =>
    answers(game, a, question) ? [{ game, a, b: facing(game, a), won: wonBy(game, a) }] : [],
  )
}

/** Every game that answers a question, in the order of the feed, each counted once. */
export const findGames = (games: FeedGame[], question: Question): FoundGame[] =>
  games.flatMap((game) => readings(game, question)[0] ?? [])

/**
 * A question that lets go of one of its heroes. Next to the one hero that is left the player asked about is who played
 * it; where no game says so the player is let go of too, with the lane asked of the player.
 */
export function releasedHero(games: FeedGame[], question: Question, role: HeroRole, hero: FeedHero): Question {
  const left = withoutHero(question, role, hero)
  if (!left.player || findGames(games, left).length) return left
  const alone = withoutHero(settled({ ...question, player: null }), role, hero)
  return findGames(games, alone).length ? alone : left
}

export type GameOrder = "new" | "short" | "long"
export const GAME_ORDERS: GameOrder[] = ["new", "short", "long"]

/** The order of games an address asks for; the newest first while it asks for none it knows. */
export const gameOrder = (value: string | null) => GAME_ORDERS.find((order) => order === value) ?? "new"

/** Whether an order by length orders anything: the length of two games at least is known. */
export const ordersByLength = (found: Pick<FoundGame, "game">[]) => found.filter(({ game }) => game.seconds).length > 1

/** Found games by when they were played, or by length; a game whose length nobody knows comes last. */
export function sortFound(found: FoundGame[], order: GameOrder): FoundGame[] {
  if (order === "new") return found
  const sign = order === "short" ? 1 : -1
  const length = ({ game }: FoundGame) => (game.seconds == null ? Infinity : sign * game.seconds)
  return [...found].sort((x, y) => length(x) - length(y))
}

/** A hero nobody is, to see what one more would leave of a question. */
const SOMEONE: FeedHero = { key: "", id: null, code: null, name: "", iconUrl: null }

/** How many games would remain, by hero, if the hero joined the question in a role. */
export function heroChoices(games: FeedGame[], question: Question, role: HeroRole): Map<string, number> {
  const asked = new Set(question[role].map((hero) => hero.key))
  const joined = { ...withHero(question, role, SOMEONE), [role]: question[role] }
  // A player sits where the only hero does, so each pick asks something else of them.
  const seated = role === "pick" && question.player ? new Map<string, Question>() : null
  const fits = (game: FeedGame, a: FeedSide, hero: FeedHero) => {
    if (!seated) return true
    const next = seated.get(hero.key) ?? withHero(question, role, hero)
    seated.set(hero.key, next)
    return answers(game, a, next)
  }
  const counts = new Map<string, number>()
  for (const game of games) {
    const found = readings(game, seated ? { ...joined, player: null, mvp: false, lane: null } : joined).flatMap(
      ({ a, b }) =>
        takenAs(role, a, b)
          .filter(({ hero }) => !asked.has(hero.key) && fits(game, a, hero))
          .map(({ hero }) => hero.key),
    )
    for (const key of new Set(found)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** How many games would remain if a hero of the question took another role; its own role counts those it leaves now. */
export function roleChoices(games: FeedGame[], question: Question, hero: FeedHero, from: HeroRole) {
  return new Map(
    HERO_ROLES.flatMap((to): [HeroRole, number][] => {
      if (to !== from && question[to].length >= ROLE_SEATS[to]) return []
      const left = findGames(games, to === from ? question : movedHero(question, hero, from, to)).length
      return left ? [[to, left]] : []
    }),
  )
}

type Choice = "team" | "opp" | "player" | "side" | "won" | "lane" | "turn"

/** How many games each value of a condition would leave, the condition itself set aside. */
export function choices(games: FeedGame[], question: Question, key: Choice): Map<string, number> {
  const open = { ...question, [key]: null }
  const sole = soleHero(question)
  const counts = new Map<string, number>()
  for (const game of games) {
    const found = readings(game, open).flatMap(({ a, b, won }): (string | null)[] => {
      if (key === "team") return [a.teamId]
      if (key === "opp") return [b?.teamId ?? null]
      if (key === "side") return [a.side]
      if (key === "won") return won == null ? [] : [won ? "win" : "loss"]
      if (key === "turn")
        return (sole ? takenAs(sole.role, a, b) : [])
          .filter((item) => item.hero.key === sole!.hero.key)
          .map((item) => (item.turn == null ? null : String(item.turn)))
      const seats = sole?.role === "pick" ? a.picks.filter((item) => item.hero.key === sole.hero.key) : a.picks
      // The lane asked about is that of the player, whoever it is.
      if (key === "player")
        return seats.filter((item) => !question.lane || item.lane === question.lane).map((item) => item.playerId)
      return seats.filter((item) => !question.player || item.playerId === question.player).map((item) => item.lane)
    })
    for (const value of new Set(found)) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

/**
 * How many games would be left if the hero asked about had to have met its opponent in its own lane; null unless one
 * hero is asked about on each side.
 */
export const duelGames = (games: FeedGame[], question: Question): number | null =>
  question.pick.length === 1 && question.vs.length === 1 ? findGames(games, { ...question, duel: true }).length : null

/** One condition of a question, with the question that is left when it is let go. */
export type Condition = { key: ConditionKey; hero?: FeedHero; without: Question }
export type ConditionKey =
  HeroRole | "team" | "opp" | "player" | "lane" | "turn" | "side" | "won" | "duel" | "mvp" | "days" | "length"

/** Every condition of a question on its own. */
export function conditions(question: Question): Condition[] {
  const heroes = HERO_ROLES.flatMap((role) =>
    question[role].map((hero): Condition => ({ key: role, hero, without: withoutHero(question, role, hero) })),
  )
  const without = (key: ConditionKey, asked: boolean, open: Partial<Question>): Condition[] =>
    asked ? [{ key, without: settled({ ...question, ...open }) }] : []
  return [
    ...heroes,
    ...(["team", "opp", "player", "lane", "turn", "side", "won"] as const).flatMap((key) =>
      without(key, question[key] != null, { [key]: null }),
    ),
    ...without("duel", question.duel, { duel: false }),
    ...without("mvp", question.mvp, { mvp: false }),
    ...without("days", !!(question.from || question.to), { from: null, to: null }),
    ...without("length", question.min != null || question.max != null, { min: null, max: null }),
  ]
}
