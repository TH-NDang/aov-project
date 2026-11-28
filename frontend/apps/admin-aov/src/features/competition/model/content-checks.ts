import type {
  CompetitionPlan,
  ContentVerification,
  DocumentView,
  RosterMembershipContent,
  SeriesContent,
  TournamentContent,
} from "@aov/community-contracts"
import type { WorkspaceStep } from "../workspace/model"
import type { WorkspaceFocus } from "../workspace/parts"

/**
 * The owner's own checks of a tournament's data (spec 04, tournament data verification). A tournament is checked part by
 * part, the way the workspace shows it: its information, each team with its roster, the format, the matches of each
 * stage, the final standings. A check names the version that was read, as a token taken from the part's saved
 * content, so any later change shows the part as changed until someone checks it again. Only Admin shows checks.
 */

/** One part as the workspace shows it, with what a check of it covers. */
export type CheckPart = {
  /** `INFO`, `TEAM:<team id>`, `FORMAT`, `SCHEDULE:<stage code>` or `FINAL`, as the server stores it. */
  part: string
  label: string
  step: WorkspaceStep
  focus?: WorkspaceFocus
  /** The saved content a check of this part covers; its token tells versions apart. */
  token: string
}

export type CheckState = "checked" | "changed" | "unchecked"

/** A part with its state: `mark` is the check of this version, or the newest one of an older version. */
export type PartCheck = CheckPart & { state: CheckState; mark?: ContentVerification; marks: ContentVerification[] }

export type CheckInput = {
  /** The tournament record, which holds the information, the staff and the final standings. */
  tournament: TournamentContent
  /** The plan as last saved: a check covers what is saved, never a draft. */
  plan: CompetitionPlan
  rosters: RosterMembershipContent[]
  series: DocumentView<SeriesContent>[]
  teamName: (teamId: string) => string
}

const INFO_FIELDS = [
  "name",
  "region",
  "year",
  "startsOn",
  "endsOn",
  "sourceUrl",
  "note",
  "logoUrl",
  "logoDarkUrl",
  "tier",
  "competitionType",
  "venueMode",
  "localCurrency",
  "parentTournamentId",
  "broadcast",
] as const satisfies readonly (keyof TournamentContent)[]
const PLAN_INFO_FIELDS = [
  "circuit",
  "circuitPageId",
  "organizer",
  "organizerPageId",
  "timezone",
  "prizePool",
  "currency",
  "sourceUrl",
  "notes",
  "venues",
] as const satisfies readonly (keyof CompetitionPlan)[]
const FINAL_FIELDS = ["result", "placements", "awards", "links"] as const satisfies readonly (keyof TournamentContent)[]
const SERIES_FIELDS = [
  "name",
  "title",
  "teamAId",
  "teamBId",
  "bestOf",
  "scheduledAt",
  "sourceUrl",
  "note",
  "result",
  "mvpPlayerId",
] as const satisfies readonly (keyof SeriesContent)[]

const pick = <T extends object, K extends keyof T>(value: T, keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, K>

/**
 * A value with what carries no fact taken out: empty text, empty lists and objects, null, false. A save that drops an
 * empty field, or writes it back as null, is no change of the facts and keeps the token.
 */
function facts(value: unknown): unknown {
  if (typeof value === "string") {
    const text = value.normalize("NFC").trim()
    return text || undefined
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (value === true) return true
  if (Array.isArray(value)) {
    const items = value.map(facts).filter((item) => item !== undefined)
    return items.length ? items : undefined
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const item = facts((value as Record<string, unknown>)[key])
        return item === undefined ? [] : [[key, item] as const]
      })
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  return undefined
}

/** The facts of a value as one text, the same for the same facts whatever the order of their fields. */
export function canonicalText(value: unknown) {
  return JSON.stringify(facts(value) ?? null)
}

/** Two 64-bit rounds of a multiply-xor hash; Admin also runs on plain-HTTP LAN addresses, where Web Crypto is off. */
function hash64(text: string, seed: number) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")
}

/** The token of a part's content: `fp1:` and 32 hex digits. A change of any fact gives a new token. */
export function contentToken(value: unknown) {
  const text = canonicalText(value)
  return `fp1:${hash64(text, 0x9e3779b9)}${hash64(text, 0x85ebca6b)}`
}

const byPlayer = (a: Pick<RosterMembershipContent, "playerId" | "startsOn">, b: typeof a) =>
  a.playerId.localeCompare(b.playerId) || (a.startsOn ?? "").localeCompare(b.startsOn ?? "")

/**
 * The parts of a tournament a person can check, in the order of the workspace's steps. A part with nothing in it yet
 * (a stage without matches, no final standings) is left out: there is nothing to check.
 */
export function checkParts(input: CheckInput): CheckPart[] {
  const { tournament, plan } = input
  const series = new Map(input.series.map((row) => [row.id, row.content]))
  const parts: CheckPart[] = [
    {
      part: "INFO",
      label: "Thông tin giải",
      step: "overview",
      token: contentToken({ tournament: pick(tournament, INFO_FIELDS), plan: pick(plan, PLAN_INFO_FIELDS) }),
    },
  ]
  for (const entrant of plan.entrants) {
    const roster = input.rosters
      .filter((row) => row.teamId === entrant.teamId)
      .map(({ tournamentId: _tournament, teamId: _team, ...row }) => row)
      .sort(byPlayer)
    const staff = (tournament.staff ?? []).filter((line) => line.teamId === entrant.teamId)
    parts.push({
      part: `TEAM:${entrant.teamId}`,
      label: input.teamName(entrant.teamId),
      step: "teams",
      focus: { team: entrant.teamId },
      token: contentToken({ entrant: pick(entrant, ["seed", "status", "note"]), roster, staff }),
    })
  }
  if (plan.stages.length)
    parts.push({
      part: "FORMAT",
      label: "Thể thức",
      step: "format",
      token: contentToken({ stages: plan.stages, playoffSeeds: plan.playoffSeeds }),
    })
  for (const stage of plan.stages) {
    const matches = plan.matches.filter((match) => match.stageCode === stage.code)
    if (!matches.length) continue
    parts.push({
      part: `SCHEDULE:${stage.code}`,
      label: `Lịch & kết quả · ${stage.name}`,
      step: "schedule",
      focus: { stage: stage.code },
      token: contentToken(
        matches.map(({ stageCode: _stage, ...match }) => {
          const record = match.seriesId ? series.get(match.seriesId) : undefined
          return { ...match, series: record && pick(record, SERIES_FIELDS) }
        }),
      ),
    })
  }
  const final = pick(tournament, FINAL_FIELDS)
  if (facts(final) !== undefined)
    parts.push({ part: "FINAL", label: "Chung cuộc", step: "final", token: contentToken(final) })
  return parts
}

/** How each part stands against the checks: `marks` come newest first, as the server lists them. */
export function partChecks(parts: CheckPart[], marks: ContentVerification[]): PartCheck[] {
  return parts.map((part) => {
    const own = marks.filter((mark) => mark.part === part.part)
    const current = own.find((mark) => mark.contentToken === part.token)
    if (current) return { ...part, state: "checked", mark: current, marks: own }
    if (own.length) return { ...part, state: "changed", mark: own[0], marks: own }
    return { ...part, state: "unchecked", marks: own }
  })
}

/** How many parts stand checked, and how many changed since their check. */
export function checkTotals(parts: PartCheck[]) {
  return {
    total: parts.length,
    checked: parts.filter((part) => part.state === "checked").length,
    changed: parts.filter((part) => part.state === "changed").length,
  }
}
