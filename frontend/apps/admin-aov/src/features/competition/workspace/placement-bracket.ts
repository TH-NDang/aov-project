import {
  bracketRoundName,
  byHour,
  byPlan,
  byRound,
  readBracket,
  type Bracket,
  type BracketMatch,
  type MatchOrder,
  type MatchResult,
} from "@aov/community-contracts/bracket-results"
import { localeText } from "@aov/ui/lib/locale-text"
import { isLinked, isSound, sendsOnEvenly, withWalkovers } from "./placement-evidence"
import {
  hasOpenSide,
  stagesText,
  unreadable,
  type Phase,
  type PlacementInput,
  type Reading,
  type Slot,
} from "./placement-phases"

/** Admin reads Vietnamese. */
const adminText = localeText("vi-VN")

/** The round of a match as a sentence goes on with it. */
function roundText({ lane, round }: BracketMatch) {
  const name = bracketRoundName(round, adminText)
  const words = name.charAt(0).toLocaleLowerCase("vi-VN") + name.slice(1)
  return lane === "place" && !words.startsWith("trận") ? `trận ${words}` : words
}

/** The bracket of some results, read as if no match followed: what a plan lacks shows in its ends and rounds. */
const bracketOf = (results: MatchResult[], order: MatchOrder) => readBracket(results, { order, whole: true })

/** Whether a phase is a bracket whose matches are linked up to one final, so that no other team can come in. */
export const isClosed = ({ kind, results }: Phase) =>
  kind === "BRACKET" &&
  results.some(isLinked) &&
  !results.some(hasOpenSide) &&
  bracketOf(results, byRound).ends.length === 1

type Line = { teamId?: string | null; reason: string; last?: MatchResult; open?: string }

type End = {
  /** Nobody goes on from here, so the last match gives the first places. */
  last: boolean
  /** Reasons name the stage, as everywhere but in the one that decides the title. */
  named: boolean
}

/** Whether both teams of a match are known and play no other after it, in the order the bracket is read in. */
function lastOfBoth({ matches }: Bracket, item: BracketMatch, order: MatchOrder) {
  const teams = [item.teamA, item.teamB]
  if (!teams.every(Boolean)) return false
  const listed = matches
    .map((result, index) => ({ result, index }))
    .sort((x, y) => order(x.result, y.result) || x.index - y.index)
  const at = listed.findIndex(({ result }) => result.match.key === item.match.key)
  return listed.slice(at + 1).every(({ result }) => !teams.includes(result.teamA) && !teams.includes(result.teamB))
}

/** Where the teams that leave in a bracket stand: by how far the round they lost in is from its end. */
function readPlaces(
  input: PlacementInput,
  phase: Phase,
  { bracket, order }: { bracket: Bracket; order: MatchOrder },
  walkovers: ReadonlyMap<string, MatchResult>,
  exits: ReadonlySet<string>,
  { last, named }: End,
): Reading {
  const stage = stagesText(phase.stages)
  const single = bracket.ends.length === 1
  const linked = phase.results.some(isLinked)
  // An open match can be read around where the plan says what follows from it, or where nothing does: the final of a
  // single end, or a last match of a qualifier whose teams play nothing after it, so that only those two wait.
  const readAround = (item: BracketMatch) =>
    last &&
    (single
      ? linked || item.toEnd === 0 || item.lane === "place"
      : input.competitionType === "QUALIFIER" && item.toEnd === 0 && lastOfBoth(bracket, item, order))
  const blocking = bracket.matches.filter((item) => !item.winner && !readAround(item))
  if (blocking.length) return unreadable(exits, `${stage} còn ${blocking.length} trận chưa rõ đội thắng`)

  const open = new Map<string, string>()
  const slots: Slot[] = []
  let next = 1
  const take = (lines: Line[]) => {
    const leaving = lines.filter(({ teamId }) => !teamId || exits.has(teamId))
    for (const { teamId, reason, last: match, open: why } of leaving)
      if (why && teamId) open.set(teamId, why)
      else slots.push({ teamId: teamId ?? undefined, from: next, to: next + leaving.length - 1, reason, last: match })
    next += leaving.length
  }
  // The only match of a stage is called by the stage.
  const only = named && bracket.matches.length === 1
  const where = (item: BracketMatch) => (only ? "trận" : roundText(item)) + (named ? ` ở ${stage}` : "")
  const won = (item: BracketMatch): Line =>
    item.winner ? { teamId: item.winner, reason: `Thắng ${where(item)}`, last: item } : { reason: `Chờ ${where(item)}` }
  const lost = (item: BracketMatch): Line =>
    item.loser
      ? {
          teamId: item.loser,
          reason: `Thua ${where(item)}`,
          last: item,
          open: walkovers.has(item.match.key) ? `Trận ${roundText(item)} chưa có tỷ số` : undefined,
        }
      : { reason: `Chờ ${where(item)}` }

  if (last && single) {
    take([won(bracket.ends[0]!)])
    take([lost(bracket.ends[0]!)])
  } else if (last) {
    if (input.competitionType !== "QUALIFIER" || !sendsOnEvenly(bracket))
      return unreadable(exits, `${stage} có ${bracket.ends.length} trận cuối, chưa có trận quyết định nhà vô địch`)
    take(
      bracket.ends.map((item) =>
        item.winner ? { teamId: item.winner, reason: `Đi tiếp, thắng ${roundText(item)}`, last: item } : won(item),
      ),
    )
  } else {
    for (const { winner } of bracket.ends)
      if (winner && exits.has(winner)) open.set(winner, `Thắng trận cuối ở ${stage} mà không đá tiếp`)
  }

  const farthest = Math.max(0, ...bracket.matches.map((item) => item.toEnd ?? 0))
  for (let distance = last && single ? 1 : 0; distance <= farthest; distance++) {
    const tier = bracket.matches.filter((item) => item.toEnd === distance)
    const out = tier.filter((item) => !item.loserTo)
    const deciders = bracket.places.filter(({ a }) => tier.some((item) => item.match.key === a!.key))
    if (out.length) take([...out.map(lost), ...deciders.flatMap((item) => [won(item), lost(item)])])
    else if (deciders.length) {
      take(deciders.map(won))
      take(deciders.map(lost))
    }
  }
  return { slots, open }
}

/**
 * A stage the plan gives no format, such as a Swiss one: when everybody who went on won as often and everybody who is
 * out lost as often, those out stand by the matches they won.
 */
function readRecords(phase: Phase, exits: ReadonlySet<string>): Reading | null {
  const won = (id: string) => phase.results.filter(({ winner }) => winner === id).length
  const lost = (id: string) => phase.results.filter(({ loser }) => loser === id).length
  const on = [...phase.teams].filter((id) => !exits.has(id))
  const out = [...exits].sort((x, y) => won(y) - won(x))
  const decided = phase.results.every(({ winner }) => winner)
  if (!decided || new Set(on.map(won)).size !== 1 || new Set(out.map(lost)).size !== 1) return null

  const stage = stagesText(phase.stages)
  return {
    slots: out.map((teamId) => ({
      teamId,
      from: out.filter((id) => won(id) > won(teamId)).length + 1,
      to: out.filter((id) => won(id) >= won(teamId)).length,
      reason: `Thắng ${won(teamId)}, thua ${lost(teamId)} ở ${stage}`,
    })),
    open: new Map(),
  }
}

/**
 * Where the teams that leave in an elimination stage stand. Hours may be wrong and rounds may be missing, so the
 * matches are put in order by either, and a place the two disagree on is not known. Where neither makes a bracket, such
 * as with one hour for all and a match for third place in round one, the order of the plan may.
 */
export function readElimination(input: PlacementInput, phase: Phase, exits: ReadonlySet<string>, end: End): Reading {
  const records = phase.kind === "CUSTOM" && !end.last ? readRecords(phase, exits) : null
  if (records) return records

  const read = (order: MatchOrder) => {
    const { results, walkovers } = input.finished
      ? withWalkovers(phase.results, order, input.competitionType === "QUALIFIER")
      : { results: phase.results, walkovers: new Map<string, MatchResult>() }
    const bracket = bracketOf(results, order)
    return isSound(bracket) ? [readPlaces(input, phase, { bracket, order }, walkovers, exits, end)] : []
  }
  const readings = [byHour, byRound].flatMap(read)
  const [reading, other] = readings.length ? readings : read(byPlan)
  if (!reading) {
    const missing = phase.results.filter(({ winner }) => !winner).length
    const stage = stagesText(phase.stages)
    return unreadable(
      exits,
      missing ? `${stage} còn ${missing} trận chưa rõ đội thắng` : `Kết quả ở ${stage} không tạo thành một nhánh đấu`,
    )
  }
  if (!other) return reading

  const slotsOf = new Map(other.slots.map((slot) => [slot.teamId, slot]))
  const open = new Map(reading.open)
  const slots = reading.slots.filter(({ teamId, from, to }) => {
    const second = teamId ? slotsOf.get(teamId) : undefined
    if (!second || (second.from <= to && from <= second.to)) return true
    open.set(teamId!, `Giờ đấu và vòng đấu ở ${stagesText(phase.stages)} không khớp nhau`)
    return false
  })
  return { slots, open }
}
