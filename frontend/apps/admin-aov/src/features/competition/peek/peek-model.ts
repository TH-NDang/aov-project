import type { ResolvedMatch, RosterMembershipContent, RosterStatus } from "@aov/community-contracts"

/** What a peek card shows: a team or a player of the tournament. */
export type PeekTarget = { kind: "team" | "player"; id: string }

/** How a team entered the tournament. */
export const ENTRY_STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Đã đăng ký",
  INVITED: "Khách mời",
  QUALIFIED: "Vượt vòng loại",
  WITHDRAWN: "Rút lui",
}

/** How a roster line stands in the tournament, as the team step names it. */
export const LINE_STATUS_LABELS: Record<RosterStatus, string> = {
  ACTIVE: "Đá chính",
  SUBSTITUTE: "Dự bị",
  INACTIVE: "Đã rời",
  UNKNOWN: "Chưa rõ vai trò",
}

/** Matches and games a team won and lost in the tournament, counted from the scored matches. */
export function teamRecord(resolved: Iterable<ResolvedMatch>, teamId: string) {
  const record = { played: 0, won: 0, lost: 0, gameWins: 0, gameLosses: 0 }
  for (const match of resolved) {
    if (match.scoreA == null || match.scoreB == null) continue
    const side = match.teamAId === teamId ? "a" : match.teamBId === teamId ? "b" : null
    if (!side) continue
    const own = side === "a" ? match.scoreA : match.scoreB
    const other = side === "a" ? match.scoreB : match.scoreA
    record.played++
    record.gameWins += own
    record.gameLosses += other
    if (own > other) record.won++
    else if (own < other) record.lost++
  }
  return record
}

/** The place of a team in the last ranked stage that lists it, with that stage's name. */
export function lastRank(
  standings: { stageCode: string; rows: { teamId: string; rank: number }[] }[],
  stageName: (code: string) => string | undefined,
  teamId: string,
) {
  for (const table of [...standings].reverse()) {
    const row = table.rows.find((entry) => entry.teamId === teamId)
    if (row) return { rank: row.rank, stage: stageName(table.stageCode) ?? "" }
  }
  return null
}

/** The lines of a player in the tournament, the one that plays first: a player may move between teams. */
export function linesOfPlayer(rosters: RosterMembershipContent[], playerId: string) {
  const order: RosterStatus[] = ["ACTIVE", "SUBSTITUTE", "UNKNOWN", "INACTIVE"]
  return rosters
    .filter((row) => row.playerId === playerId)
    .sort((a, b) => order.indexOf(a.status ?? "UNKNOWN") - order.indexOf(b.status ?? "UNKNOWN"))
}

/** A trail of cards: opening one from inside another keeps the way back, and opening one already on it goes back. */
export function followTrail(trail: PeekTarget[], next: PeekTarget) {
  const at = trail.findIndex((entry) => entry.kind === next.kind && entry.id === next.id)
  return at >= 0 ? trail.slice(0, at + 1) : [...trail, next]
}

/** The year a player was born, from a full or partial date. */
export const birthYear = (date?: string | null) => {
  const year = Number(date?.slice(0, 4))
  return Number.isFinite(year) && year > 1900 ? year : null
}

/** Where a page opened from a tournament or a profile leads back to, carried in the router state. */
export type BackLink = { label: string; to: string }

/** Router state of a link that opens a profile: the profile's back link returns there. */
export const backState = (back: BackLink) => ({ back })

/** The back link a profile was opened with, when the state holds a well-formed one. */
export function backFromState(state: unknown): BackLink | null {
  const back = (state as { back?: unknown } | null)?.back as Partial<BackLink> | undefined
  return back && typeof back.label === "string" && typeof back.to === "string" && /^\/(?!\/)/.test(back.to)
    ? { label: back.label, to: back.to }
    : null
}
