import type { BuildPart, CompetitionStage, HeroBuild, HeroBuilds } from "@aov/community-contracts"
import { capital } from "./capital.ts"
import { isElimination, playedOrder } from "./competition-model.ts"
import { heroTurns, type DraftShape, type ShapeTurn } from "./draft-shape.ts"
import { shownText } from "./feed-words.ts"
import type { Question } from "./finder-model.ts"
import { countGames, type Counted, type FeedGame, type FeedHero, type GameFeed } from "./game-feed.ts"
import {
  enoughPicks,
  gamesIn,
  presenceOf,
  tally,
  unknownGames,
  type Fate,
  type HeroMate,
  type HeroRecord,
  type HeroTeam,
} from "./hero-model.ts"
import { playWeeks } from "./play-weeks.ts"
import { ENOUGH_FOR_SHARE, shareText } from "./shares.ts"
import type { StatsList } from "./statistics-routes.ts"

type Say = (vi: string, en: string) => string
type Taken = { game: FeedGame }

/** What became of a hero in the games counted. Every game counts once, also one both sides banned it in. */
export type HeroFate = Fate &
  Counted & {
    /** Games it was picked or banned in, and those of them that show their bans. */
    present: number
    seen: number
  }

export function heroFate({ picks, bans }: Pick<HeroRecord, "picks" | "bans">, counted: Counted): HeroFate {
  const { wins, losses } = tally(picks.map(({ won }) => won))
  const { presence, seen } = presenceOf({ picks, bans })
  return {
    ...counted,
    picks: gamesIn(picks),
    wins,
    losses,
    bans: gamesIn(bans),
    unknown: unknownGames(counted, { presence, seen }),
    present: presence,
    seen,
  }
}

export type HeroList = "picks" | "bans"

/** The list of games an address opens; one that would be empty gives way to the analysis. */
export const heroList = (
  list: StatsList | null | undefined,
  { picks, bans }: Pick<HeroFate, "picks" | "bans">,
): HeroList | null => ((list === "picks" && picks > 0) || (list === "bans" && bans > 0) ? list : null)

/* ---------- The sentence about a hero ---------- */

/** A part of a sentence: words, or a number of games and which of the hero's games it counts. */
export type Said = string | { count: number; of: "picks" | "bans" | "won" | "lost" }

/** Shares a sentence names in words, in Vietnamese and in English. */
const FRACTIONS: [share: number, words: readonly [string, string]][] = [
  [4 / 5, ["bốn phần năm", "four fifths"]],
  [3 / 4, ["ba phần tư", "three quarters"]],
  [2 / 3, ["hai phần ba", "two thirds"]],
  [3 / 5, ["ba phần năm", "three fifths"]],
  [1 / 2, ["nửa", "half"]],
  [2 / 5, ["hai phần năm", "two fifths"]],
  [1 / 3, ["một phần ba", "one third"]],
  [1 / 4, ["một phần tư", "a quarter"]],
  [1 / 5, ["một phần năm", "a fifth"]],
  [1 / 10, ["một phần mười", "a tenth"]],
]
/** How far a share may be from the one that names it, as a part of that one. */
const NEAR = 0.04
/** With fewer games a share in words says more than the games do. */
const ENOUGH_FOR_WORDS = 30

/** How many of the games a hero was seen in, in words that hold for any count. */
function presenceWords({ games, present }: HeroFate, name: string, text: Say) {
  if (present >= 0.9 * games) return text(`Gần như ván nào cũng có ${name}`, `${name} was part of almost every game`)
  const share = present / games
  const near = games >= ENOUGH_FOR_WORDS && FRACTIONS.find(([value]) => Math.abs(share - value) <= NEAR * value)
  if (!near) return text(`${present} trong ${games} ván có ${name}`, `${name} was part of ${present} of ${games} games`)
  const [value, words] = near
  const [vi, en] = share === value ? ["Đúng", "exactly"] : share < value ? ["Gần", "nearly"] : ["Hơn", "more than"]
  return text(`${vi} ${words[0]} số ván có ${name}`, `${name} was part of ${en} ${words[1]} of the games`)
}

/** What became of a hero where some games do not show their bans: each number with the games it is out of. */
function partlyShownWords(fate: HeroFate, text: Say) {
  const { games, shown, picks, bans, present, seen } = fate
  const only = shownText(fate, text)
  if (!picks)
    return text(
      `Bị cấm {bans} trong ${shown} ván${only}, chưa lần nào được chọn.`,
      `Banned in {bans} of ${shown} games${only} and never picked.`,
    )
  if (!shown) return text(`Được chọn {picks} trong ${games} ván.`, `Picked in {picks} of ${games} games.`)
  if (!bans)
    return text(
      `Được chọn {picks} trong ${games} ván, chưa lần nào bị cấm trong ${shown} ván${only}.`,
      `Picked in {picks} of ${games} games, never banned in the ${shown}${only}.`,
    )
  // Only a game that shows its bans says that the hero was left open.
  const open = shown - bans
  const taken = picks - (present - seen)
  const lead = !open
    ? ""
    : taken === open
      ? text("Không bị cấm là có đội chọn: ", "Picked whenever it was not banned: ")
      : taken >= 0.9 * open
        ? text("Không bị cấm thì gần như luôn có đội chọn: ", "Picked almost whenever it was not banned: ")
        : ""
  const counts = text(
    `bị cấm {bans} trong ${shown} ván${only}, được chọn {picks} trong cả ${games} ván.`,
    `banned in {bans} of ${shown} games${only}, picked in {picks} of all ${games}.`,
  )
  return capital(lead + counts)
}

/** What became of a hero that was seen at all; the numbers stand as `{bans}` and `{picks}`. */
function fateWords(fate: HeroFate, name: string, text: Say) {
  const { games, shown, picks, bans } = fate
  if (shown < games) return partlyShownWords(fate, text)
  const open = games - bans
  if (!picks)
    return text(
      `Bị cấm {bans} trong ${games} ván, chưa lần nào được chọn.`,
      `Banned in {bans} of ${games} games and never picked.`,
    )
  if (!bans)
    return text(
      `Được chọn {picks} trong ${games} ván, chưa lần nào bị cấm.`,
      `Picked in {picks} of ${games} games and never banned.`,
    )
  if (picks === open)
    return text(
      `Không bị cấm là có đội chọn: {bans} trong ${games} ván bị cấm, {picks} ván còn lại được chọn.`,
      `Picked whenever it was not banned: banned in {bans} of ${games} games, picked in the other {picks}.`,
    )
  if (picks >= 0.9 * open)
    return text(
      `Không bị cấm thì gần như luôn có đội chọn: {bans} trong ${games} ván bị cấm, ${open} ván còn lại thì {picks} ván được chọn.`,
      `Picked almost whenever it was not banned: banned in {bans} of ${games} games, picked in {picks} of the other ${open}.`,
    )
  const seen = presenceWords(fate, name, text)
  return text(`${seen}: {bans} ván bị cấm, {picks} ván được chọn.`, `${seen}: banned in {bans}, picked in {picks}.`)
}

/** How a hero fared where it was picked; a word for it needs enough picks, fewer only list what happened. */
function recordWords({ games, picks, wins, losses }: HeroFate, text: Say) {
  if (!picks) return ""
  const decided = wins + losses
  const open = picks - decided
  if (!decided) return text("Chưa rõ thắng hay thua.", "How it ended is not recorded.")
  if (picks === 1)
    return wins ? text("Ván đó thắng.", "That game was won.") : text("Ván đó thua.", "That game was lost.")
  const unknown = open > 0 ? text(`, ${open} ván chưa rõ kết quả`, `, ${open} without a recorded result`) : ""
  if (!open && !losses) return text("Thắng cả {won} ván.", "Won all {won} of them.")
  if (!open && !wins) return text("Thua cả {lost} ván.", "Lost all {lost} of them.")
  const counts = text(`thắng {won}, thua {lost}${unknown}.`, `won {won}, lost {lost}${unknown}.`)
  if (picks < Math.max(ENOUGH_FOR_SHARE, enoughPicks(games))) return capital(counts)
  const rate = wins / decided
  const fared =
    rate >= 0.6
      ? text("Chơi thì hay thắng", "It often won when played")
      : rate > 0.55
        ? text("Chơi thì thắng nhiều hơn thua", "It won more than it lost")
        : rate === 0.5
          ? text("Chơi thì thắng thua ngang nhau", "It won as often as it lost")
          : rate >= 0.45
            ? text("Chơi thì thắng thua gần ngang nhau", "It won about as often as it lost")
            : rate > 0.4
              ? text("Chơi thì thua nhiều hơn thắng", "It lost more than it won")
              : text("Chơi thì hay thua", "It often lost when played")
  return `${fared}: ${counts}`
}

/** A hero none of the games names; those that do not show their bans only say that nobody picked it. */
function absentWords(fate: HeroFate, name: string, text: Say) {
  const { games, shown } = fate
  if (shown && shown < games) {
    const only = shownText(fate, text)
    return text(
      `Trong ${games} ván này không đội nào chọn ${name}, ${shown} ván${only} cũng không đội nào cấm.`,
      `No team picked ${name} in these ${games} games, nor banned it in the ${shown}${only}.`,
    )
  }
  const took = shown ? text("chọn hay cấm", "picked or banned") : text("chọn", "picked")
  return games === 1
    ? text(`Ván này không đội nào ${took} ${name}.`, `No team ${took} ${name} in this game.`)
    : text(`Trong ${games} ván này không đội nào ${took} ${name}.`, `No team ${took} ${name} in these ${games} games.`)
}

/**
 * A hero in one sentence or two: how much of the competition it was part of, whether teams took it away or played it,
 * and how that went. Every word is a rule over the counts, so it holds for one game as for three hundred.
 */
export function verdict(fate: HeroFate, name: string, text: Say): Said[] {
  if (!fate.present) return [absentWords(fate, name, text)]
  const counts = {
    "{picks}": { count: fate.picks, of: "picks" },
    "{bans}": { count: fate.bans, of: "bans" },
    "{won}": { count: fate.wins, of: "won" },
    "{lost}": { count: fate.losses, of: "lost" },
  } as const
  return [fateWords(fate, name, text), recordWords(fate, text)]
    .filter(Boolean)
    .join(" ")
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => counts[part as keyof typeof counts] ?? part)
}

/* ---------- Who played it ---------- */

/** Who played a hero for a team as far as the competition names them, and the games of which it does not. */
export function namedPlayers(
  { picks, players }: Pick<HeroTeam, "picks" | "players">,
  known: Record<string, { nickname: string } | undefined>,
) {
  const named = players.filter(({ playerId }) => known[playerId]?.nickname)
  return { named, unknown: picks.length - named.reduce((sum, { games }) => sum + games, 0) }
}

/* ---------- Heroes beside and against it ---------- */

export type MateOrder = "games" | "won"

/** Heroes met, by how often, or by the share of games won; those met too rarely to compare follow on their own. */
export function mateRows(mates: HeroMate[], by: MateOrder, enough: number) {
  if (by === "games") return { ranked: mates, few: [] as HeroMate[] }
  const rate = ({ wins, losses }: HeroMate) => (wins + losses ? wins / (wins + losses) : 0)
  return {
    ranked: mates
      .filter(({ games }) => games.length >= enough)
      .sort((x, y) => rate(y) - rate(x) || y.games.length - x.games.length),
    few: mates.filter(({ games }) => games.length < enough),
  }
}

/* ---------- The season, week by week ---------- */

/** A part of the season one column stands for: a week of a stage, or a whole stage. */
export type SeasonColumn = {
  key: string
  /** The stages played in it; several where groups play side by side. */
  stages: CompetitionStage[]
  /** The week of its stages, null where it stands for all of them. */
  week: number | null
  games: FeedGame[]
  /** Its first and its last match day, yyyy-mm-dd. */
  from: string | null
  to: string | null
}

const daysOf = (games: FeedGame[]) => games.flatMap(({ day }) => day ?? []).sort()

function sideBySide(x: FeedGame[], y: FeedGame[]) {
  const [first, second] = [daysOf(x), daysOf(y)]
  return first.length > 0 && second.length > 0 && first[0]! <= second.at(-1)! && second[0]! <= first.at(-1)!
}

type Phase = { stages: CompetitionStage[]; games: FeedGame[] }

function phaseColumns({ stages, games }: Phase): SeasonColumn[] {
  const code = stages.map((stage) => stage.code).join("+")
  const column = (week: number | null, own: FeedGame[]): SeasonColumn => {
    const days = daysOf(own)
    const key = week == null ? code : `${code}.${week}`
    return { key, stages, week, games: own, from: days[0] ?? null, to: days.at(-1) ?? null }
  }
  // Groups that play side by side count their weeks together; a stage of its own has counted them already.
  const together = stages.length > 1 ? playWeeks(daysOf(games)) : null
  const weekOf = (game: FeedGame) => (together ? (game.day ? together.get(game.day) : null) : game.week) ?? null
  const weeks = [...new Set(games.flatMap((game) => weekOf(game) ?? []))].sort((x, y) => x - y)
  if (stages.some(isElimination) || weeks.length < 2) return [column(null, games)]
  return weeks.map((week) =>
    column(
      week,
      games.filter((game) => weekOf(game) === week),
    ),
  )
}

/**
 * The games of a feed along the season: a column for every week of a stage, and one for a knockout stage or a stage of
 * a single week. Groups that play side by side share their weeks. Games of no stage, and those of a stage of several
 * weeks that name no day, stand in no column.
 */
export function seasonColumns(feed: Pick<GameFeed, "view" | "games">): SeasonColumn[] {
  const { plan } = feed.view.content
  const phases: Phase[] = []
  for (const stage of playedOrder(plan.stages, plan.matches)) {
    const games = feed.games.filter((game) => game.stage === stage.code)
    const last = phases.at(-1)
    if (!games.length) continue
    if (last && ![...last.stages, stage].some(isElimination) && sideBySide(last.games, games)) {
      last.stages.push(stage)
      last.games.push(...games)
    } else phases.push({ stages: [stage], games })
  }
  return phases.flatMap(phaseColumns)
}

/**
 * What a question asks to find the games of a column and no others: its days. Where other games share those days, or
 * some of its own name none, the stage it belongs to tells them apart; `scope` is then the period to count.
 */
export function columnQuestion(feed: Pick<GameFeed, "games">, { stages, games, from, to }: SeasonColumn) {
  const own = new Set(games.map(({ id }) => id))
  const inDays = ({ day }: FeedGame) => !!day && !!from && !!to && day >= from && day <= to
  if (games.every(inDays) && !feed.games.some((game) => inDays(game) && !own.has(game.id)))
    return { from, to, scope: null }
  const stage = stages.length === 1 ? stages[0]!.code : null
  const whole = feed.games.every((game) => game.stage !== stage || own.has(game.id))
  return stage && whole ? { from: null, to: null, scope: stage } : { from, to, scope: stage }
}

/** A hero in one column of the season. */
export type HeroColumn = { column: SeasonColumn; fate: HeroFate }

export function heroColumns(columns: SeasonColumn[], record: Pick<HeroRecord, "picks" | "bans">): HeroColumn[] {
  return columns.map((column) => {
    const ids = new Set(column.games.map(({ id }) => id))
    const within = <T extends Taken>(list: T[]) => list.filter(({ game }) => ids.has(game.id))
    return {
      column,
      fate: heroFate({ picks: within(record.picks), bans: within(record.bans) }, countGames(column.games)),
    }
  })
}

/** What a column says of the hero; where none of its games shows its bans only the picks are told. */
export function columnWords(fate: HeroFate, text: Say): string {
  const { games, shown, picks, seen, wins, losses, bans } = fate
  const only = shownText(fate, text)
  const record = text(`thắng ${wins}, thua ${losses}`, `won ${wins}, lost ${losses}`)
  return shown
    ? text(
        `có mặt ${seen} trong ${shown} ván${only}; ${record}, bị cấm ${bans}`,
        `part of ${seen} of ${shown} games${only}; ${record}, banned ${bans}`,
      )
    : text(`được chọn ${picks} trong ${games} ván; ${record}`, `picked in ${picks} of ${games} games; ${record}`)
}

/** The figure over a column: the share of games the hero was seen in, or how many they were where a share says little. */
export const columnFigure = ({ shown, seen, present }: HeroFate, languageTag: string) =>
  shown >= ENOUGH_FOR_SHARE ? shareText(seen, shown) : present.toLocaleString(languageTag)

/** Fewer columns tell no course of a season, and a chart of a few games is mostly empty. */
const ENOUGH_COLUMNS = 3
export const tellsSeason = (columns: HeroColumn[]) =>
  columns.length >= ENOUGH_COLUMNS && columns.reduce((sum, { fate }) => sum + fate.present, 0) >= ENOUGH_FOR_SHARE

/* ---------- The turns of the draft ---------- */

/** A turn of the draft: the games a hero was taken in at it, and what a question asks to find them. */
export type StaffTurn = { turn: ShapeTurn; games: number; question: Partial<Question> }

/**
 * How often a hero was taken at each turn of a draft. A draft with a missed ban keeps the numbers of its other turns,
 * so it counts wherever the hero's own turn is one of the shape's.
 */
export function heroStaff(games: FeedGame[], shape: DraftShape, hero: FeedHero): StaffTurn[] {
  const turns = new Map(shape.acts.flatMap((act) => act.turns.map((turn) => [turn.turn, turn] as const)))
  const own = (list: { hero: FeedHero; turn: number | null }[]) =>
    list.flatMap((item) => (item.hero.key === hero.key ? (item.turn ?? []) : []))
  const follows = (game: FeedGame) =>
    game.sides.every(({ side, picks, bans }) => {
      const like = (kind: ShapeTurn["kind"]) => (turn: number) =>
        turns.get(turn)?.kind === kind && turns.get(turn)?.side === side
      return own(picks).every(like("PICK")) && own(bans).every(like("BAN"))
    })
  return heroTurns({ ...shape, games: games.filter(follows) }, hero).map(({ turn, games: taken }) => ({
    turn,
    games: taken,
    question: { [turn.kind === "PICK" ? "pick" : "banA"]: [hero], side: turn.side, turn: turn.turn },
  }))
}

/** Whether a hero was taken often enough for a chart of its turns. */
export const tellsDraft = (staff: StaffTurn[]) => staff.reduce((sum, { games }) => sum + games, 0) >= ENOUGH_FOR_SHARE

/** How many games record the order of their draft. */
export const orderedGames = (games: FeedGame[]) =>
  games.filter(({ sides }) => sides.some(({ picks, bans }) => [...picks, ...bans].some(({ turn }) => turn != null)))
    .length

/* ---------- What it was played with ---------- */

/** A part of builds and in how many of them it was seen. */
export type PartCount = { part: BuildPart; games: number }
/** Parts counted, most often first, and how many builds show any part of their kind. */
export type PartCounts = { of: number; parts: PartCount[] }
export type BuildCounts = {
  /** Games whose builds show anything. */
  games: number
  items: PartCounts
  /** Items bought for a moment of the game and given up again. */
  situational: PartCounts
  enchantments: PartCounts
  spells: PartCounts
}

/** The components of other items say nothing about what a player was building towards. */
const FINISHED_TIER = 2
const isFinished = ({ tier }: BuildPart) => tier == null || tier >= FINISHED_TIER

function partCounts(builds: HeroBuild[], list: BuildPart[], held: (build: HeroBuild) => number[], all = true) {
  const counts = new Map<number, number>()
  const showing = builds.filter((build) => held(build).length > 0)
  for (const build of showing)
    for (const place of new Set(held(build)))
      if (list[place] && (all || isFinished(list[place]))) counts.set(place, (counts.get(place) ?? 0) + 1)
  const parts = [...counts]
    .map(([place, games]): PartCount => ({ part: list[place]!, games }))
    .sort((x, y) => y.games - x.games || x.part.name.localeCompare(y.part.name))
  return { of: showing.length, parts }
}

/** What a hero was played with in some of its games. */
export function buildCounts({ builds, items, spells, enchantments }: HeroBuilds, games: Iterable<string>): BuildCounts {
  const counted = new Set(games)
  const own = builds.filter((build) => counted.has(build.gameId))
  const one = (place: number | null | undefined) => (place == null ? [] : [place])
  return {
    games: new Set(own.map((build) => build.gameId)).size,
    items: partCounts(own, items, (build) => build.items, false),
    situational: partCounts(own, items, (build) => build.situational ?? []),
    enchantments: partCounts(own, enchantments, (build) => one(build.enchantment)),
    spells: partCounts(own, spells, (build) => one(build.spell)),
  }
}
