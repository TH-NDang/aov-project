import type {
  CompetitionPlan,
  CompetitionSlot,
  CompetitionSnapshot,
  CompetitionStage,
  CompetitionStanding,
  DocumentView,
  GameContent,
  PlannedMatch,
  ResolvedMatch,
  RosterMembershipContent,
  TeamContent,
} from "@aov/community-contracts"
import { matchName, matchTitleText, slotLabel } from "@aov/community-contracts"
import { localeText } from "@aov/ui/lib/locale-text"
import { dayKeyInZone, toInstant } from "@aov/ui/lib/time-zone"

export const WORKSPACE_STEPS = ["overview", "teams", "format", "schedule", "final", "publish"] as const
export type WorkspaceStep = (typeof WORKSPACE_STEPS)[number]

export const STEP_LABELS: Record<WorkspaceStep, string> = {
  overview: "Tổng quan",
  teams: "Đội & đội hình",
  format: "Thể thức",
  schedule: "Lịch & kết quả",
  final: "Chung cuộc",
  publish: "Công bố",
}

/** Numbers of the six steps before entrants and rosters were merged; old links keep opening the same content. */
const LEGACY_STEPS: WorkspaceStep[] = ["overview", "teams", "teams", "format", "schedule", "publish"]

export function stepFromParam(value: string | null): WorkspaceStep {
  if (!value) return "overview"
  if ((WORKSPACE_STEPS as readonly string[]).includes(value)) return value as WorkspaceStep
  const index = Number(value)
  return (Number.isInteger(index) && LEGACY_STEPS[index]) || "overview"
}

export const FORMAT_NAMES: Record<string, string> = {
  ROUND_ROBIN: "Vòng tròn",
  DOUBLE_ELIMINATION: "Nhánh thắng / thua",
  SINGLE_ELIMINATION: "Loại trực tiếp",
  CUSTOM: "Tự thiết lập",
}

export const isLeagueStage = (stage: Pick<CompetitionStage, "format">) => stage.format === "ROUND_ROBIN"

export const hasScore = (match?: ResolvedMatch | null) => match?.scoreA != null && match?.scoreB != null

export const resolvedIndex = (resolved: ResolvedMatch[]) => new Map(resolved.map((match) => [match.key, match]))

export function stageProgress(stageCode: string, plan: CompetitionPlan, resolved: Map<string, ResolvedMatch>) {
  const matches = plan.matches.filter((match) => match.stageCode === stageCode)
  return { total: matches.length, scored: matches.filter((match) => hasScore(resolved.get(match.key))).length }
}

const wallClock = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })

/** The wall clock of a moment in a zone, as yyyy-mm-ddThh:mm:ss. */
function wallTime(at: number, timeZone: string) {
  const parts = Object.fromEntries(
    wallClock(timeZone)
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

/** A moment as a datetime-local value on the wall clock of the tournament's zone; empty without a moment. */
export function zonedInputTime(value: string | null | undefined, timeZone: string) {
  const date = toInstant(value)
  return date ? wallTime(date.getTime(), timeZone).slice(0, 16) : ""
}

/**
 * The moment a datetime-local value names on the wall clock of a zone, as an ISO string; null when empty or invalid.
 * The zone's offset is read at the guessed moment and once more, so a time next to a clock change lands right.
 */
export function zonedInputInstant(input: string, timeZone: string) {
  const asUtc = Date.parse(`${input}:00Z`)
  if (!input || Number.isNaN(asUtc)) return null
  let guess = asUtc
  for (let round = 0; round < 2; round++) guess = asUtc - (Date.parse(`${wallTime(guess, timeZone)}Z`) - guess)
  return new Date(guess).toISOString()
}

export type GroupMode = "round" | "day"
export type MatchGroup = {
  key: string
  /** Round number in round mode. */
  round?: number
  /** `yyyy-mm-dd` in day mode; absent for matches without a time. */
  day?: string
  matches: PlannedMatch[]
  scored: number
  firstAt: number
  lastAt: number
}

const matchTime = (match: PlannedMatch) =>
  match.scheduledAt ? new Date(match.scheduledAt).getTime() : Number.POSITIVE_INFINITY

/**
 * Matches of one stage grouped by round or by day. While a stage still has matches without a score, the first group
 * that needs one comes first and the played groups follow, most recent first; a finished stage reads latest first.
 */
export function groupMatches(
  matches: PlannedMatch[],
  mode: GroupMode,
  timeZone: string,
  resolved: Map<string, ResolvedMatch>,
): MatchGroup[] {
  const groups = new Map<string, MatchGroup>()
  for (const match of [...matches].sort((a, b) => matchTime(a) - matchTime(b) || a.key.localeCompare(b.key))) {
    const day = match.scheduledAt ? dayKeyInZone(match.scheduledAt, timeZone) : undefined
    const key = mode === "round" ? `round-${match.round}` : (day ?? "unscheduled")
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        round: mode === "round" ? match.round : undefined,
        day: mode === "day" ? day : undefined,
        matches: [],
        scored: 0,
        firstAt: matchTime(match),
        lastAt: Number.NEGATIVE_INFINITY,
      }
      groups.set(key, group)
    }
    group.matches.push(match)
    if (hasScore(resolved.get(match.key))) group.scored++
    if (match.scheduledAt) group.lastAt = Math.max(group.lastAt, matchTime(match))
  }
  const ordered = [...groups.values()].sort((a, b) =>
    mode === "round" ? (a.round ?? 0) - (b.round ?? 0) : a.firstAt - b.firstAt,
  )
  const open = ordered.findIndex((group) => group.scored < group.matches.length)
  return open < 0 ? ordered.reverse() : [...ordered.slice(open), ...ordered.slice(0, open).reverse()]
}

/** Rounds are worth showing only when the schedule really numbers them; imports often leave every match in round 1. */
export const defaultGroupMode = (matches: PlannedMatch[]): GroupMode =>
  new Set(matches.map((match) => match.round)).size > 1 ? "round" : "day"

/** Teams that do not play in a round of a round-robin stage. */
export function restingTeams(group: MatchGroup, teamIds: string[], resolved: Map<string, ResolvedMatch>) {
  const playing = new Set<string>()
  for (const match of group.matches) {
    const row = resolved.get(match.key)
    for (const id of [row?.teamAId ?? match.a.teamId, row?.teamBId ?? match.b.teamId]) if (id) playing.add(id)
  }
  return teamIds.filter((id) => !playing.has(id))
}

/** Admin reads Vietnamese. */
const adminText = localeText("vi-VN")

/** What a planned match is called in Admin: the name an editor typed, its title, or at least its key. */
export const matchLabel = (match: PlannedMatch) => matchName(match, adminText) || match.key

/** The title of a planned match in Admin's words, which its name field shows until an editor types one. */
export const matchTitleLabel = (match: PlannedMatch) => matchTitleText(match.title, adminText)

/**
 * A match an editor adds by hand to a stage: titled as an additional match, with both sides open and unnamed, so every
 * reader words them in its own language.
 */
export function extraMatch(stage: Pick<CompetitionStage, "code" | "bestOf">, key: string): PlannedMatch {
  return {
    key,
    stageCode: stage.code,
    round: 1,
    label: null,
    title: { kind: "EXTRA" },
    bestOf: stage.bestOf,
    a: { type: "TBD" },
    b: { type: "TBD" },
  }
}

/** How one side of a planned match reads before its team is known. */
export function slotText(slot: CompetitionSlot, plan: CompetitionPlan, teams: Record<string, TeamContent>): string {
  return slotLabel(slot, plan, teams, adminText)
}

export type BracketLane = "upper" | "lower" | "final"
export type BracketNode = {
  match: PlannedMatch
  lane: BracketLane
  column: number
  x: number
  y: number
  /** Keys of the matches whose winner plays here; only these are joined by a line. */
  feeds: string[]
}
export type BracketLayout = {
  nodes: BracketNode[]
  width: number
  height: number
  lanes: { lane: BracketLane; y: number }[]
  /** False when no slot points at an earlier match: the columns are then just the plan's rounds. */
  linked: boolean
}

export const BRACKET = { nodeWidth: 240, nodeHeight: 96, columnGap: 40, rowGap: 20, laneLabel: 28, laneGap: 24 }

/**
 * Places the matches of an elimination stage. A match that takes a loser belongs to the lower bracket, a match fed by
 * winners of both brackets is the final, and a match sits level with the middle of the matches it is fed by.
 */
export function layoutBracket(matches: PlannedMatch[]): BracketLayout {
  const keys = new Set(matches.map((match) => match.key))
  const sources = (match: PlannedMatch) =>
    [match.a, match.b].filter(
      (slot): slot is CompetitionSlot & { matchKey: string } =>
        (slot.type === "WINNER" || slot.type === "LOSER") && !!slot.matchKey && keys.has(slot.matchKey),
    )
  const linked = matches.some((match) => sources(match).length > 0)

  const depth = new Map<string, number>()
  const lane = new Map<string, BracketLane>()
  for (const match of matches) {
    const from = sources(match)
    // Only winners push a match to the right: a team dropping from the upper bracket joins the lower one in place,
    // so both brackets start in the first column and the whole stage stays one screen wide.
    const fedBy = from.filter((slot) => slot.type === "WINNER").map((slot) => depth.get(slot.matchKey) ?? 0)
    depth.set(match.key, linked ? 1 + Math.max(0, ...fedBy) : match.round)
    const winners = from.filter((slot) => slot.type === "WINNER").map((slot) => lane.get(slot.matchKey) ?? "upper")
    lane.set(
      match.key,
      from.some((slot) => slot.type === "LOSER")
        ? "lower"
        : winners.includes("upper") && winners.includes("lower")
          ? "final"
          : winners.length && winners.every((value) => value === "lower")
            ? "lower"
            : winners.includes("final")
              ? "final"
              : "upper",
    )
  }
  const columns = [...new Set(depth.values())].sort((a, b) => a - b)
  const { nodeWidth, nodeHeight, columnGap, rowGap, laneLabel, laneGap } = BRACKET
  const step = nodeHeight + rowGap

  const rows = new Map<string, number>()
  const laneRows: Record<BracketLane, number> = { upper: 0, lower: 0, final: 0 }
  for (const current of ["upper", "lower"] as const) {
    let leaves = 0
    for (const column of columns) {
      // Without links every column is its own list; with links a late entrant takes the next free row of the lane.
      if (!linked) leaves = 0
      for (const match of matches) {
        if (lane.get(match.key) !== current || depth.get(match.key) !== column) continue
        const feeders = sources(match)
          .filter((slot) => slot.type === "WINNER" && lane.get(slot.matchKey) === current)
          .map((slot) => rows.get(slot.matchKey) ?? 0)
        const row = feeders.length ? feeders.reduce((sum, value) => sum + value, 0) / feeders.length : leaves++
        rows.set(match.key, row)
        laneRows[current] = Math.max(laneRows[current], row + 1)
      }
    }
  }

  const upperTop = laneRows.upper ? laneLabel : 0
  const lowerTop = upperTop + laneRows.upper * step + (laneRows.lower ? laneGap + laneLabel : 0)
  const top = (key: string) => (lane.get(key) === "lower" ? lowerTop : upperTop) + (rows.get(key) ?? 0) * step
  const nodes: BracketNode[] = []
  let finals = 0
  for (const match of matches) {
    const kind = lane.get(match.key)!
    const feeds = sources(match)
      .filter((slot) => slot.type === "WINNER")
      .map((slot) => slot.matchKey)
    const column = columns.indexOf(depth.get(match.key)!)
    const y =
      kind === "final"
        ? feeds.length
          ? feeds.reduce((sum, key) => sum + (nodes.find((node) => node.match.key === key)?.y ?? 0), 0) / feeds.length
          : upperTop + finals++ * step
        : top(match.key)
    nodes.push({ match, lane: kind, column, x: column * (nodeWidth + columnGap), y, feeds })
  }
  const lanes: BracketLayout["lanes"] = []
  if (linked && laneRows.upper && laneRows.lower) {
    lanes.push({ lane: "upper", y: 0 }, { lane: "lower", y: lowerTop - laneLabel })
  }
  return {
    nodes,
    width: Math.max(1, columns.length) * (nodeWidth + columnGap) - columnGap,
    height: Math.max(0, ...nodes.map((node) => node.y + nodeHeight)),
    lanes,
    linked,
  }
}

/** Seeds taken from a finished table: its first `count` teams in table order. */
export function seedsFromStandings(rows: CompetitionStanding[], count: number): Record<number, string> {
  return Object.fromEntries(rows.slice(0, count).map((row, index) => [index + 1, row.teamId]))
}

/** True for an address that starts with http or https, the only links a source or a video may be. */
export const isWebLink = (value: string) => /^https?:\/\//i.test(value)

/** The same score rules the match editor applies, so a result entered in the schedule cannot break them. */
export function resultProblem(bestOf: number, scoreA: number | null, scoreB: number | null, sourceUrl: string) {
  if (scoreA == null || scoreB == null) return "Nhập đủ hai vế tỷ số."
  if (![scoreA, scoreB].every((score) => Number.isInteger(score) && score >= 0))
    return "Tỷ số phải là số nguyên không âm."
  if (!isWebLink(sourceUrl.trim())) return "Kết quả cần link nguồn bắt đầu bằng https:// hoặc http://."
  if (bestOf % 2 === 0)
    return scoreA + scoreB === bestOf ? null : `Thể thức BO${bestOf} cần đủ ${bestOf} ván trong tỷ số.`
  const winning = Math.ceil(bestOf / 2)
  if (Math.max(scoreA, scoreB) !== winning || scoreA === scoreB)
    return `Thể thức BO${bestOf}: một đội phải thắng ${winning} ván và đội còn lại ít hơn.`
  return null
}

export type CheckState = "ok" | "todo" | "waiting"
export type WorkspaceCheck = {
  id: string
  label: string
  detail: string
  state: CheckState
  step: WorkspaceStep
  /** Publication is refused while a required check is not met. */
  required: boolean
}

export function workspaceChecks(input: {
  plan: CompetitionPlan
  resolved: ResolvedMatch[]
  rosters: RosterMembershipContent[]
  organizerName?: string
  organizerPublished?: boolean
  placements: number
  now: number
}): WorkspaceCheck[] {
  const { plan, resolved, rosters, now } = input
  const index = resolvedIndex(resolved)
  const state = (ok: boolean): CheckState => (ok ? "ok" : "todo")
  const withRoster = plan.entrants.filter((entry) => rosters.some((row) => row.teamId === entry.teamId)).length
  const timed = plan.matches.filter((match) => !!match.scheduledAt).length
  // A match counts as due once its start has passed; a match without a time is due as soon as both teams are known.
  const due = plan.matches.filter((match) =>
    match.scheduledAt ? new Date(match.scheduledAt).getTime() <= now : !!match.seriesId,
  )
  const dueScored = due.filter((match) => hasScore(index.get(match.key))).length
  const finished = plan.matches.length > 0 && plan.matches.every((match) => hasScore(index.get(match.key)))
  const checks: WorkspaceCheck[] = [
    {
      id: "source",
      label: "Nguồn kiểm chứng của giải",
      detail: plan.sourceUrl ? hostOf(plan.sourceUrl) : "Chưa có",
      state: state(!!plan.sourceUrl),
      step: "overview",
      required: true,
    },
    {
      id: "entrants",
      label: "Có ít nhất hai đội tham dự",
      detail: `${plan.entrants.length} đội`,
      state: state(plan.entrants.length >= 2),
      step: "teams",
      required: true,
    },
    {
      id: "stages",
      label: "Thể thức và tiêu chí xếp hạng",
      detail: `${plan.stages.length} giai đoạn`,
      state: state(plan.stages.length > 0),
      step: "format",
      required: true,
    },
  ]
  if (plan.organizerPageId)
    checks.push({
      id: "organizer",
      label: "Tổ chức đã công bố hồ sơ",
      detail: input.organizerName || "Đã liên kết",
      state: state(!!input.organizerPublished),
      step: "overview",
      required: true,
    })
  else
    checks.push({
      id: "organizer",
      label: "Liên kết đơn vị tổ chức",
      detail: "Chưa liên kết",
      state: "todo",
      step: "overview",
      required: false,
    })
  checks.push(
    {
      id: "rosters",
      label: "Đội hình được khai báo cho từng đội",
      detail: `${withRoster}/${plan.entrants.length} đội`,
      state: state(plan.entrants.length > 0 && withRoster === plan.entrants.length),
      step: "teams",
      required: false,
    },
    {
      id: "schedule",
      label: "Lịch đấu đã tạo",
      detail: `${plan.matches.length} trận`,
      state: state(plan.matches.length > 0),
      step: "schedule",
      required: false,
    },
    {
      id: "times",
      label: "Giờ thi đấu đầy đủ",
      detail: `${timed}/${plan.matches.length}`,
      state: state(plan.matches.length > 0 && timed === plan.matches.length),
      step: "schedule",
      required: false,
    },
    {
      id: "consistent",
      label: "Kết quả khớp các suất đi tiếp",
      detail: resolved.every((match) => match.consistent) ? "Không lệch" : "Có trận lệch suất",
      state: state(resolved.every((match) => match.consistent)),
      step: "schedule",
      required: false,
    },
    {
      id: "results",
      label: "Tỷ số các trận đã đấu",
      detail: `${dueScored}/${due.length} trận`,
      state: state(dueScored === due.length),
      step: "schedule",
      required: false,
    },
    {
      id: "placements",
      label: "Thứ hạng chung cuộc",
      detail: input.placements ? `${input.placements} dòng` : finished ? "Chưa có" : "Chờ giải kết thúc",
      state: input.placements ? "ok" : finished ? "todo" : "waiting",
      step: "final",
      required: false,
    },
  )
  return checks
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export type RecordingTotals = {
  games: number
  withWinner: number
  withPlayers: number
  withDraftOrder: number
  published: number
}

export function recordingTotals(games: DocumentView<GameContent>[]): RecordingTotals {
  const totals: RecordingTotals = {
    games: games.length,
    withWinner: 0,
    withPlayers: 0,
    withDraftOrder: 0,
    published: 0,
  }
  for (const entry of games) {
    const participants = entry.content.sides.flatMap((side) => side.participants)
    if (entry.content.winner) totals.withWinner++
    if (participants.length === 10 && participants.every((participant) => participant.playerId)) totals.withPlayers++
    if (entry.content.draft?.turns?.length) totals.withDraftOrder++
    if (entry.publishedAt) totals.published++
  }
  return totals
}

export type PendingChange = {
  kind: "score" | "match" | "schedule" | "teams" | "format" | "info" | "final"
  text: string
}

const stable = (value: unknown) => JSON.stringify(value ?? null)

/** What a new publication would change for readers, in the order an editor wants to check it. */
export function pendingChanges(draft: CompetitionSnapshot, published: CompetitionSnapshot): PendingChange[] {
  const changes: PendingChange[] = []
  const before = resolvedIndex(published.resolved)
  const after = resolvedIndex(draft.resolved)
  const planned = new Map(published.plan.matches.map((match) => [match.key, match]))
  const side = (match: PlannedMatch, row: ResolvedMatch | undefined, which: "a" | "b") => {
    const id = which === "a" ? row?.teamAId : row?.teamBId
    const team = id ? draft.teams[id] : undefined
    return team?.shortName || team?.name || slotText(match[which], draft.plan, draft.teams)
  }
  let moved = 0
  for (const match of draft.plan.matches) {
    const now = after.get(match.key)
    const was = before.get(match.key)
    const pair = `${side(match, now, "a")} – ${side(match, now, "b")}`
    const previous = planned.get(match.key)
    if (!previous) {
      changes.push({ kind: "match", text: `Trận mới: ${pair}` })
      if (hasScore(now)) changes.push({ kind: "score", text: `Tỷ số mới: ${pair} ${now!.scoreA} : ${now!.scoreB}` })
      continue
    }
    if (now?.teamAId !== was?.teamAId || now?.teamBId !== was?.teamBId)
      changes.push({ kind: "match", text: `Đổi cặp đấu: ${matchName(match, adminText) || pair}` })
    if (hasScore(now) && !hasScore(was))
      changes.push({ kind: "score", text: `Tỷ số mới: ${pair} ${now!.scoreA} : ${now!.scoreB}` })
    else if (!hasScore(now) && hasScore(was))
      changes.push({ kind: "score", text: `Bỏ tỷ số: ${pair} (trước là ${was!.scoreA} : ${was!.scoreB})` })
    else if (hasScore(now) && (now!.scoreA !== was!.scoreA || now!.scoreB !== was!.scoreB))
      changes.push({
        kind: "score",
        text: `Đổi tỷ số: ${pair} ${was!.scoreA} : ${was!.scoreB} → ${now!.scoreA} : ${now!.scoreB}`,
      })
    if ((match.scheduledAt ?? null) !== (previous.scheduledAt ?? null)) moved++
  }
  const removed = published.plan.matches.filter((match) => !after.has(match.key)).length
  if (removed) changes.push({ kind: "match", text: `Bỏ ${removed} trận khỏi lịch` })
  if (moved) changes.push({ kind: "schedule", text: `Đổi giờ đấu ${moved} trận` })

  const entrants = (plan: CompetitionPlan) => plan.entrants.map((entry) => `${entry.teamId}:${entry.status}`).sort()
  if (stable(entrants(draft.plan)) !== stable(entrants(published.plan)))
    changes.push({
      kind: "teams",
      text: `Đội tham dự: ${published.plan.entrants.length} → ${draft.plan.entrants.length} đội hoặc đổi trạng thái`,
    })
  const rosters = (rows: RosterMembershipContent[]) =>
    rows.map((row) => `${row.teamId}:${row.playerId}:${row.lane ?? ""}:${row.status ?? ""}`).sort()
  if (stable(rosters(draft.rosters)) !== stable(rosters(published.rosters)))
    changes.push({ kind: "teams", text: "Đội hình đăng ký đã đổi" })
  if (
    stable(draft.plan.stages) !== stable(published.plan.stages) ||
    stable(draft.plan.playoffSeeds) !== stable(published.plan.playoffSeeds)
  )
    changes.push({ kind: "format", text: "Thể thức hoặc hạt giống đã đổi" })

  const { placements: draftPlaces, awards: draftAwards, ...draftInfo } = draft.tournament
  const { placements: liveplaces, awards: liveAwards, ...liveInfo } = published.tournament
  if (stable([draftPlaces, draftAwards]) !== stable([liveplaces, liveAwards]))
    changes.push({ kind: "final", text: "Thứ hạng chung cuộc hoặc giải thưởng đã đổi" })
  const about = (plan: CompetitionPlan) => [
    plan.circuitPageId,
    plan.organizerPageId,
    plan.timezone,
    plan.prizePool,
    plan.currency,
    plan.sourceUrl,
    plan.notes,
    plan.venues,
  ]
  if (stable(draftInfo) !== stable(liveInfo) || stable(about(draft.plan)) !== stable(about(published.plan)))
    changes.push({ kind: "info", text: "Thông tin giải đã đổi" })
  return changes
}

export type SuggestedPlacement = {
  place: string
  teamId?: string
  teamName: string
  reason: string
  /** The team's last match in the bracket: who it played and the score from its side, such as "4–2". */
  lastOpponent?: string
  lastScore?: string
}

/**
 * Final ranking read from a linked elimination bracket: the final gives first and second, each match whose loser goes
 * nowhere gives a place from the latest round back, and teams that never reached the bracket keep their table rank.
 */
export function suggestedPlacements(
  plan: CompetitionPlan,
  resolved: ResolvedMatch[],
  standings: CompetitionSnapshot["standings"],
  teams: Record<string, TeamContent>,
): SuggestedPlacement[] {
  const stage = [...plan.stages].reverse().find((entry) => !isLeagueStage(entry))
  if (!stage) return []
  const layout = layoutBracket(plan.matches.filter((match) => match.stageCode === stage.code))
  if (!layout.linked) return []
  const index = resolvedIndex(resolved)
  const name = (id?: string | null) => (id && teams[id]?.name) || ""
  const outcome = (key: string) => {
    const row = index.get(key)
    if (!row || !hasScore(row) || !row.consistent || row.scoreA === row.scoreB) return null
    const aWon = row.scoreA! > row.scoreB!
    const high = Math.max(row.scoreA!, row.scoreB!)
    const low = Math.min(row.scoreA!, row.scoreB!)
    return {
      winner: aWon ? row.teamAId : row.teamBId,
      loser: aWon ? row.teamBId : row.teamAId,
      row,
      winnerScore: `${high}–${low}`,
      loserScore: `${low}–${high}`,
    }
  }
  const dropsSomewhere = new Set(
    plan.matches.flatMap((match) =>
      [match.a, match.b].filter((slot) => slot.type === "LOSER").map((slot) => slot.matchKey),
    ),
  )
  const lines: SuggestedPlacement[] = []
  const final = layout.nodes.filter((node) => node.lane === "final").at(-1) ?? layout.nodes.at(-1)
  if (!final) return []
  const decided = outcome(final.match.key)
  lines.push(
    decided
      ? {
          place: "1",
          teamId: decided.winner ?? undefined,
          teamName: name(decided.winner),
          reason: `Thắng ${matchLabel(final.match)}`,
          lastOpponent: name(decided.loser) || undefined,
          lastScore: decided.winnerScore,
        }
      : { place: "1", teamName: "", reason: `Chờ ${matchLabel(final.match)}` },
    decided
      ? {
          place: "2",
          teamId: decided.loser ?? undefined,
          teamName: name(decided.loser),
          reason: `Thua ${matchLabel(final.match)}`,
          lastOpponent: name(decided.winner) || undefined,
          lastScore: decided.loserScore,
        }
      : { place: "2", teamName: "", reason: `Chờ ${matchLabel(final.match)}` },
  )
  let next = 3
  const eliminating = layout.nodes
    .filter((node) => node !== final && !dropsSomewhere.has(node.match.key))
    .sort((a, b) => b.column - a.column)
  for (const column of [...new Set(eliminating.map((node) => node.column))]) {
    const group = eliminating.filter((node) => node.column === column)
    const place = group.length === 1 ? String(next) : `${next}-${next + group.length - 1}`
    for (const node of group) {
      const result = outcome(node.match.key)
      lines.push(
        result
          ? {
              place,
              teamId: result.loser ?? undefined,
              teamName: name(result.loser),
              reason: `Thua ${matchLabel(node.match)} · ${result.loserScore}`,
              lastOpponent: name(result.winner) || undefined,
              lastScore: result.loserScore,
            }
          : { place, teamName: "", reason: `Chờ ${matchLabel(node.match)}` },
      )
    }
    next += group.length
  }
  const inBracket = new Set(
    layout.nodes.flatMap((node) => {
      const row = index.get(node.match.key)
      return [row?.teamAId, row?.teamBId].filter((id): id is string => !!id)
    }),
  )
  const table = [...standings].reverse().find((entry) => entry.complete)
  for (const row of table?.rows ?? []) {
    if (inBracket.has(row.teamId)) continue
    lines.push({
      place: String(next++),
      teamId: row.teamId,
      teamName: name(row.teamId),
      reason: `Hạng ${row.rank} vòng bảng`,
    })
  }
  return lines
}

const ROSTER_LANES = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const

/**
 * One team's roster the way a reader scans it: the five positions in map order, then the bench, then who left.
 * A position can hold nobody or more than one starter, and a starter may have no position recorded yet.
 */
/** A team's roster lines in the order its row draws them: starters by lane, then the bench, who left and the rest. */
export function rosterOrder(rows: RosterMembershipContent[]) {
  const board = rosterBoard(rows)
  return [
    ...board.lanes.flatMap((cell) => cell.players),
    ...board.unplaced,
    ...board.bench,
    ...board.left,
    ...board.unknown,
  ]
}

export function rosterBoard(rows: RosterMembershipContent[]) {
  const of = (status: string) => rows.filter((row) => (row.status ?? "UNKNOWN") === status)
  const starters = of("ACTIVE")
  return {
    lanes: ROSTER_LANES.map((lane) => ({ lane, players: starters.filter((row) => row.lane === lane) })),
    unplaced: starters.filter((row) => !row.lane),
    bench: of("SUBSTITUTE"),
    left: of("INACTIVE"),
    unknown: of("UNKNOWN"),
  }
}
