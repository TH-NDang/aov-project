import type {
  CompetitionPlan,
  CompetitionSnapshot,
  ResolvedMatch,
  TeamContent,
  TournamentContent,
  TournamentPlacement,
} from "@aov/community-contracts"
import { calendarDaysBetween } from "@aov/ui/lib/time-zone"
import { tournamentPodium, type PodiumTeam } from "@aov/ui/lib/tournament-podium"
import { normalize } from "@/lib/text"
import { stagesByDate } from "../model/schedule-model"
import { hasScore, isLeagueStage, resolvedIndex, type CheckState } from "./model"
import { placeText, suggestedPlacements, type PlacementSuggestions, type SuggestedPlacement } from "./placements"

type Teams = Record<string, TeamContent>

export type FinalInput = {
  tournament: TournamentContent
  plan: CompetitionPlan
  resolved: ResolvedMatch[]
  standings: CompetitionSnapshot["standings"]
  teams: Teams
  now?: Date
}

/** The champion as the final table or the result an import wrote name it, or as only the matches tell so far. */
export type FinalResult = {
  winner: PodiumTeam
  runnerUp: PodiumTeam | null
  score: string | null
  source: "TABLE" | "RESULT" | "MATCHES"
}

/**
 * What is recorded against what is found. CHAMPION, RUNNER_UP, SCORE: the matches say otherwise. OLD_RESULT: the result
 * an import wrote names another champion than the final table.
 */
export type ResultIssue = {
  kind: "CHAMPION" | "RUNNER_UP" | "SCORE" | "OLD_RESULT"
  source: "TABLE" | "RESULT"
  recorded: string
  found: string
}

/**
 * One team of the final table beside what the matches tell. SAME: both give it one place, or places within each other.
 * DIFFERS: they contradict each other. MISSING: only the matches place it. TAKEN: they do, where the table holds other
 * teams already. RECORDED: only the table places it. PENDING: a place whose match is open. OPEN: neither places it.
 */
export type FinalRow = {
  key: string
  state: "SAME" | "DIFFERS" | "MISSING" | "TAKEN" | "RECORDED" | "PENDING" | "OPEN"
  place?: string
  teamId?: string | null
  teamName: string
  recorded?: TournamentPlacement
  suggested?: SuggestedPlacement
  /** Why the matches do not place it, or who holds its place. */
  reason?: string
}

export type FinalState =
  | { kind: "FULL"; teams: number }
  | { kind: "SUGGESTED"; lines: number }
  | { kind: "CONFLICT"; placed: number; teams: number }
  | { kind: "PARTIAL"; placed: number; teams: number }
  | { kind: "RESULT_ONLY" }
  | { kind: "AWARDS_ONLY" }
  | { kind: "SHOWMATCH" }
  | { kind: "WAITING" }
  | { kind: "EMPTY" }

export type FinalOutcome = {
  over: boolean
  suggestions: PlacementSuggestions
  result: FinalResult | null
  issue: ResultIssue | null
  rows: FinalRow[]
  state: FinalState
}

/**
 * Whether a tournament is over: its record or its last day says so, or that day has come, its last stage is a bracket
 * and every planned match has its score. A match that was cancelled keeps none, and a league may go on in a stage not
 * planned yet.
 */
export function isOver({ tournament, plan, resolved, now = new Date() }: Omit<FinalInput, "standings" | "teams">) {
  const { status, endsOn } = tournament
  const daysLeft = endsOn ? calendarDaysBetween(now, endsOn, plan.timezone) : 0
  if (status === "FINISHED" || daysLeft < 0) return true
  if (daysLeft > 0) return false

  const rows = resolvedIndex(resolved)
  const planned = plan.stages.every((stage) => plan.matches.some((match) => match.stageCode === stage.code))
  const last = stagesByDate(plan).at(-1)
  return !!last && !isLeagueStage(last) && planned && plan.matches.every((match) => hasScore(rows.get(match.key)))
}

type Range = readonly [first: number, last: number]

/** The places a line stands for; null for one without a number, such as "dq". */
function placeRange(place: string | undefined): Range | null {
  const found = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(place?.trim() ?? "")
  return found ? [Number(found[1]), Number(found[2] ?? found[1])] : null
}

const within = (inner: Range | null, outer: Range | null) =>
  !!inner && !!outer && inner[0] >= outer[0] && inner[1] <= outer[1]

/** Whether two places can both be right: one lies within the other, or one of them is no number. */
export function placesAgree(one: string, other: string) {
  const [first, second] = [placeRange(one), placeRange(other)]
  return !first || !second || within(first, second) || within(second, first)
}

/** Best first; a line without a number goes last. */
function byPlace(one: string | undefined, other: string | undefined) {
  const [first, second] = [placeRange(one), placeRange(other)]
  if (!first || !second) return (first ? 0 : 1) - (second ? 0 : 1)
  return first[0] - second[0] || first[1] - second[1]
}

/** Whether a name written by hand is the team's: its name, its short name or another name it goes by. */
function isNamed(name: string, team: TeamContent | undefined) {
  const folded = normalize(name)
  return !!team && [team.name, team.shortName, ...(team.aliases ?? [])].some((own) => own && normalize(own) === folded)
}

/** Whether a podium team is the given team: by its link, or by its name. */
const isTeam = (named: PodiumTeam, teamId: string, teams: Teams) =>
  named.teamId === teamId || isNamed(named.name, teams[teamId])

/** Whether two lines of the final table name one team: by its link, or by a name it goes by. */
function sameTeam(one: TournamentPlacement, other: TournamentPlacement, teams: Teams) {
  if (one.teamId && one.teamId === other.teamId) return true
  const named = !!one.teamName.trim() && normalize(one.teamName) === normalize(other.teamName)
  return named || isNamed(one.teamName, teams[other.teamId ?? ""]) || isNamed(other.teamName, teams[one.teamId ?? ""])
}

/** How many teams the final table holds; a team it lists twice counts once. */
const teamCount = (placements: readonly TournamentPlacement[], teams: Teams) =>
  placements.filter((line, at) => !placements.slice(0, at).some((earlier) => sameTeam(earlier, line, teams))).length

/** A place as a sentence names it, with the long dash of a range. */
const placeWords = (place: string) =>
  placeRange(place) ? `hạng ${place.trim().replace(/\s*[-–]\s*/, "–")}` : `“${place.trim()}”`

const lineAt = ({ lines }: PlacementSuggestions, place: string) =>
  lines.find((line): line is SuggestedPlacement & { teamId: string } => line.place === place && !!line.teamId)

/** The lines that hold every place of a suggestion; none while they leave one of them. */
function holders(placements: readonly TournamentPlacement[], place: string) {
  const range = placeRange(place)
  const lines = placements.filter((line) => within(placeRange(line.place), range))
  return range && lines.length > range[1] - range[0] ? lines : []
}

/**
 * The teams the final table strikes out with a line that has no place, such as "dq" or "dnp", and what that does to the
 * places the matches give: a team struck out takes no place, so those below it move up. The table may name a team of
 * the open match under another record: a struck line that names no team of the matches stands for one of those, where
 * the table lists that team nowhere else.
 */
function struckOut(placements: readonly TournamentPlacement[], suggestions: PlacementSuggestions, teams: Teams) {
  const struck = placements.filter((line) => !placeRange(line.place) && line.teamName.trim())
  const names = (line: TournamentPlacement, teamId: string) =>
    line.teamId === teamId || isNamed(line.teamName, teams[teamId])
  const { lines, waiting, open } = suggestions
  const reading = [
    ...new Set([...lines.flatMap(({ teamId }) => teamId ?? []), ...waiting, ...open.map(({ teamId }) => teamId)]),
  ]
  const out = new Set(reading.filter((id) => struck.some((line) => names(line, id))))
  const strangers = struck.filter((line) => !reading.some((id) => names(line, id)))
  const standIns = new Set<TournamentPlacement>()
  for (const id of waiting) {
    const line = strangers.find((stranger) => !standIns.has(stranger))
    if (line && !out.has(id) && !placements.some((own) => names(own, id))) {
      out.add(id)
      standIns.add(line)
    }
  }
  // A place still waiting for its match goes to one of the teams that wait.
  const waitsStruck = waiting.length > 0 && waiting.every((id) => out.has(id))
  const isStruck = ({ teamId }: SuggestedPlacement) => (teamId ? out.has(teamId) : waitsStruck)
  /** The lines the matches place above a place, but those of one team. */
  const above = (place: string, except?: PodiumTeam | null) => {
    const range = placeRange(place)
    return lines.filter((line) => {
      const at = placeRange(line.place)
      return !!range && !!at && at[1] < range[0] && !(except && line.teamId && isTeam(except, line.teamId, teams))
    })
  }
  return {
    above,
    isStruck,
    /** Whether a struck line is read as one of the teams the open match waits for. */
    standsIn: (line: TournamentPlacement) => standIns.has(line),
    /** The place of a suggestion once the struck teams above it are left out. */
    shifted(place: string) {
      const range = placeRange(place)
      const gone = above(place).filter(isStruck).length
      return range && gone ? placeText(range[0] - gone, range[1] - gone) : place
    },
  }
}

type Struck = ReturnType<typeof struckOut>

/** Whether a recorded place is the suggested one: as it stands, or once the struck teams above it are left out. */
const agrees = (place: string, suggested: SuggestedPlacement, struck: Struck) =>
  placesAgree(place, suggested.place) || placesAgree(place, struck.shifted(suggested.place))

/** Both are places, and one lies within the other. */
const sharesPlace = (one: string, other: string) =>
  within(placeRange(one), placeRange(other)) || within(placeRange(other), placeRange(one))

function finalRows(
  placements: readonly TournamentPlacement[],
  suggestions: PlacementSuggestions,
  teams: Teams,
  struck: Struck,
) {
  const shown = new Set<TournamentPlacement>()
  const recordedLine = (teamId: string, suggested?: SuggestedPlacement) => {
    const free = placements.filter((line) => !shown.has(line))
    const own = [
      ...free.filter((line) => line.teamId === teamId),
      ...free.filter((line) => line.teamId !== teamId && isNamed(line.teamName, teams[teamId])),
    ]
    // Of a team the table lists twice, the line at the place the matches give is the one they confirm.
    const places = suggested ? [suggested.place, struck.shifted(suggested.place)] : []
    const line = own.find((line) => places.some((place) => sharesPlace(line.place, place))) ?? own[0]
    if (line) shown.add(line)
    return line
  }
  const rows = suggestions.lines.flatMap((suggested, index): FinalRow[] => {
    const { teamId, teamName, place } = suggested
    if (!teamId) {
      // A place the table already gives, alone or among others, does not wait for its match any more.
      const given = placements.some((line) => within(placeRange(place), placeRange(line.place)))
      return given || holders(placements, place).length
        ? []
        : [{ key: `pending-${index}`, state: "PENDING", place, teamName, suggested }]
    }
    const recorded = recordedLine(teamId, suggested)
    if (recorded) {
      const state = agrees(recorded.place, suggested, struck) ? "SAME" : "DIFFERS"
      return [{ key: teamId, state, place: recorded.place, teamId, teamName: recorded.teamName, recorded, suggested }]
    }
    const taken = holders(placements, place)
    const reason = taken.map((line) => line.teamName).join(", ")
    return [{ key: teamId, state: taken.length ? "TAKEN" : "MISSING", place, teamId, teamName, suggested, reason }]
  })
  for (const { teamId, teamName, reason } of suggestions.open) {
    const recorded = recordedLine(teamId)
    rows.push(
      recorded
        ? {
            key: teamId,
            state: "RECORDED",
            place: recorded.place,
            teamId,
            teamName: recorded.teamName,
            recorded,
            reason,
          }
        : { key: teamId, state: "OPEN", teamId, teamName, reason },
    )
  }
  placements.forEach((recorded, index) => {
    if (shown.has(recorded)) return
    const { place, teamId, teamName } = recorded
    // A further line of a team the table lists already is a repeat, whatever the matches say of the team.
    const repeated =
      placements.find((line) => shown.has(line) && sameTeam(line, recorded, teams)) ??
      placements.slice(0, index).find((line) => sameTeam(line, recorded, teams))
    const waits =
      struck.standsIn(recorded) || suggestions.waiting.some((id) => id === teamId || isNamed(teamName, teams[id]))
    const reason = repeated
      ? `Đội đã có dòng ${placeWords(repeated.place)}`
      : waits
        ? "Trận cuối chưa có tỷ số"
        : "Không có trận nào trong lịch"
    rows.push({ key: `line-${index}`, state: "RECORDED", place, teamId, teamName, recorded, reason })
  })
  const last = (row: FinalRow) => (row.state === "OPEN" ? 1 : 0)
  return rows.sort((x, y) => last(x) - last(y) || byPlace(x.place, y.place))
}

/** The line of the single champion the final table names, whom readers then see instead of the recorded result. */
function firstLine({ placements = [] }: TournamentContent) {
  const [first, ...others] = placements.filter((line) => line.place.trim() === "1" && line.teamName.trim())
  return others.length ? undefined : first
}

function finalResult(
  tournament: TournamentContent,
  suggestions: PlacementSuggestions,
  teams: Teams,
): FinalResult | null {
  const champion = lineAt(suggestions, "1")
  const second = lineAt(suggestions, "2")
  // The score of the final, where the champion's last match was the one against the other finalist.
  const played = champion && second && champion.lastOpponent === second.teamName ? champion.lastScore : undefined
  const podium = tournamentPodium(tournament)
  if (!podium)
    return champion
      ? {
          winner: { teamId: champion.teamId, name: champion.teamName },
          runnerUp: second ? { teamId: second.teamId, name: second.teamName } : null,
          score: played ?? null,
          source: "MATCHES",
        }
      : null

  const linked = (team: PodiumTeam): PodiumTeam => {
    const teamId = team.teamId ?? Object.keys(teams).find((id) => isNamed(team.name, teams[id]))
    return teamId ? { teamId, name: team.name } : team
  }
  const won = !!champion && isTeam(podium.winner, champion.teamId, teams)
  return {
    winner: linked(podium.winner),
    runnerUp: podium.runnerUp && linked(podium.runnerUp),
    score: podium.score ?? (won ? (played ?? null) : null),
    source: firstLine(tournament) ? "TABLE" : "RESULT",
  }
}

function resultIssue(
  { result: imported }: TournamentContent,
  suggestions: PlacementSuggestions,
  result: FinalResult | null,
  teams: Teams,
  struck: Struck,
): ResultIssue | null {
  if (!result || result.source === "MATCHES") return null

  const { source, winner, runnerUp } = result
  const champion = lineAt(suggestions, "1")
  const second = lineAt(suggestions, "2")
  const lineOf = (team: PodiumTeam) => suggestions.lines.find(({ teamId }) => teamId && isTeam(team, teamId, teams))
  /**
   * Whether every team the matches place above a recorded finalist is one the table strikes out, as when both teams of
   * the final were disqualified. Above a finalist the matches do not place stands the one they put in its place.
   */
  const struckAbove = (team: PodiumTeam, instead: SuggestedPlacement, except?: PodiumTeam | null) => {
    const own = lineOf(team)
    const above = own ? struck.above(own.place, except) : [instead]
    return above.length > 0 && above.every(struck.isStruck)
  }
  const own = lineOf(winner)
  if (champion && !isTeam(winner, champion.teamId, teams) && !struckAbove(winner, champion))
    return { kind: "CHAMPION", source, recorded: winner.name, found: champion.teamName }
  if (!champion && own && !placesAgree(own.place, "1") && !struckAbove(winner, own))
    return { kind: "CHAMPION", source, recorded: winner.name, found: `${own.teamName} hạng ${own.place}` }
  if (second && runnerUp && !isTeam(runnerUp, second.teamId, teams) && !struckAbove(runnerUp, second, winner))
    return { kind: "RUNNER_UP", source, recorded: runnerUp.name, found: second.teamName }

  if (!imported?.winnerName?.trim()) return null
  const same =
    normalize(imported.winnerName) === normalize(winner.name) ||
    isNamed(imported.winnerName, teams[winner.teamId ?? ""])
  if (!same) return { kind: "OLD_RESULT", source, recorded: imported.winnerName, found: winner.name }

  const { winnerScore, runnerUpScore } = imported
  const recorded = winnerScore != null && runnerUpScore != null ? `${winnerScore}–${runnerUpScore}` : null
  const found = second && champion?.lastOpponent === second.teamName ? champion.lastScore : undefined
  return recorded && found && recorded !== found ? { kind: "SCORE", source, recorded, found } : null
}

/** Whether the matches name other finalists than what is recorded, so their places are not to be filled in. */
export const blocksFilling = (issue: ResultIssue | null) => issue?.kind === "CHAMPION" || issue?.kind === "RUNNER_UP"

function finalState(tournament: TournamentContent, outcome: Omit<FinalOutcome, "state">, teams: Teams): FinalState {
  const { rows, issue, over, suggestions } = outcome
  const count = (state: FinalRow["state"]) => rows.filter((row) => row.state === state).length
  const placed = teamCount(tournament.placements ?? [], teams)
  // A team in no match of the plan may never have taken part, so it does not hold the table open. Where no team played
  // at all, nothing tells who took part, and every entrant is still to be placed.
  const played = suggestions.lines.length > 0 || suggestions.waiting.length > 0 || suggestions.open.some((t) => !t.idle)
  const idle = new Set(played ? suggestions.open.filter((team) => team.idle).map((team) => team.teamId) : [])
  const unknown = rows.filter((row) => row.state === "OPEN" && !idle.has(row.teamId ?? "")).length
  const left = count("MISSING") + count("PENDING") + unknown
  if (!over && !placed) return { kind: "WAITING" }
  if (over && blocksFilling(issue)) return { kind: "CONFLICT", placed, teams: placed + left }
  if (placed && !left) return { kind: "FULL", teams: placed }
  if (over && count("MISSING")) return { kind: "SUGGESTED", lines: count("MISSING") }
  if (placed) return { kind: "PARTIAL", placed, teams: placed + left }
  if (tournament.competitionType === "SHOWMATCH") return { kind: "SHOWMATCH" }
  if (tournament.result?.winnerName?.trim()) return { kind: "RESULT_ONLY" }
  return tournament.awards?.length ? { kind: "AWARDS_ONLY" } : { kind: "EMPTY" }
}

function readPlacements({ tournament, teams, ...input }: FinalInput, over: boolean): PlacementSuggestions {
  const { competitionType, endsOn, placements = [] } = tournament
  // A show match ranks nobody, so what its friendly matches add up to is not offered as places.
  if (competitionType === "SHOWMATCH" && !placements.length) return { lines: [], open: [], waiting: [], level: [] }

  const read = (lastDay?: string) =>
    suggestedPlacements({ ...input, teams, competitionType, finished: over, endsOn: lastDay })
  // A plan that stops days before the tournament did is whole all the same where it ends in the recorded champion.
  const whole = read()
  const champion = lineAt(whole, "1")
  const recorded = tournamentPodium(tournament)?.winner
  return champion && recorded && isTeam(recorded, champion.teamId, teams) ? whole : read(endsOn)
}

/** All the final step shows: what is recorded, what the matches tell, and what is still missing. */
export function finalOutcome(input: FinalInput): FinalOutcome {
  const { tournament, teams } = input
  const placements = tournament.placements ?? []
  const over = isOver(input)
  const suggestions = readPlacements(input, over)
  const result = finalResult(tournament, suggestions, teams)
  const struck = struckOut(placements, suggestions, teams)
  const outcome = {
    over,
    suggestions,
    result,
    issue: resultIssue(tournament, suggestions, result, teams, struck),
    rows: finalRows(placements, suggestions, teams, struck),
  }
  return { ...outcome, state: finalState(tournament, outcome, teams) }
}

/** The state of the step in few words, which its tab and the checks of the tournament show. */
export function finalStateText(state: FinalState): string {
  switch (state.kind) {
    case "FULL":
      return `Đã đủ ${state.teams} đội`
    case "SUGGESTED":
      return `${state.lines} gợi ý chưa điền`
    case "CONFLICT":
      return "Kết quả chưa khớp"
    case "PARTIAL":
      return `${state.placed}/${state.teams} đội có hạng`
    case "RESULT_ONLY":
      return "Có kết quả, chưa có thứ hạng"
    case "AWARDS_ONLY":
      return "Có giải thưởng, chưa có thứ hạng"
    case "SHOWMATCH":
      return "Giao hữu, không xếp hạng"
    case "WAITING":
      return "Chờ giải kết thúc"
    case "EMPTY":
      return "Chưa có"
  }
}

export function finalCheckState({ over, state }: Pick<FinalOutcome, "over" | "state">): CheckState {
  if (state.kind === "FULL") return "ok"
  return over && state.kind !== "SHOWMATCH" ? "todo" : "waiting"
}

/**
 * The places the first teams share, as in a qualifier that sends several on, and whether the table holds them already.
 * Null where one team comes first.
 */
export function sharedFirst(rows: readonly FinalRow[]) {
  const first = rows.filter((row) => {
    const range = placeRange(row.place)
    return range?.[0] === 1 && range[1] > 1
  })
  if (first.length < 2) return null
  return {
    place: placeText(1, first.length),
    teams: first.map((row) => row.teamName),
    recorded: first.every((row) => row.recorded),
  }
}

/**
 * The final table after one of its two fillings: MISSING adds the teams only the matches place, DIFFERS moves the teams
 * the table places elsewhere to where the matches do. A line keeps its prize, and a new one has none.
 */
export function filledPlacements(
  placements: readonly TournamentPlacement[],
  rows: readonly FinalRow[],
  which: "MISSING" | "DIFFERS",
): TournamentPlacement[] {
  const changed = rows.filter((row) => row.state === which)
  const last = ({ suggested, recorded }: FinalRow) => ({
    lastOpponent: suggested?.lastOpponent ?? recorded?.lastOpponent ?? null,
    lastScore: suggested?.lastScore ?? recorded?.lastScore ?? null,
  })
  const kept = placements.map((line) => {
    const row = which === "DIFFERS" ? changed.find(({ recorded }) => recorded === line) : undefined
    return row ? { ...line, place: row.suggested!.place, ...last(row) } : line
  })
  const added = which === "DIFFERS" ? [] : changed
  return [
    ...kept,
    ...added.map((row) => ({
      place: row.suggested!.place,
      teamId: row.teamId,
      teamName: row.teamName,
      prizeUsd: null,
      prizeLocal: null,
      ...last(row),
    })),
  ].sort((x, y) => byPlace(x.place, y.place))
}
