import type { DocumentView, Lane, RosterMembershipContent } from "@aov/community-contracts"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { LANE_LABELS, LANE_ORDER } from "@/lib/lanes"
import type { RosterBatch } from "../api/tournament-api"
import { rosterFormIssue } from "./roster-model"

/** A line of the roster being edited: a stored one with its version, or a new one without. */
export type RosterLine = {
  stored?: { id: string; version: number; content: RosterMembershipContent }
  content: RosterMembershipContent
  removed?: boolean
}

const STATUS_ORDER: RosterMembershipContent["status"][] = ["ACTIVE", "SUBSTITUTE", "UNKNOWN", "INACTIVE"]

export const rosterLines = (rows: readonly DocumentView<RosterMembershipContent>[]): RosterLine[] =>
  sortedLines(
    rows.map((row) => ({ stored: { id: row.id, version: row.version, content: row.content }, content: row.content })),
  )

/** Starters by lane, then the bench, then who is unclear or left. */
export function sortedLines(lines: RosterLine[]): RosterLine[] {
  const rank = ({ content }: RosterLine) =>
    STATUS_ORDER.indexOf(content.status ?? "UNKNOWN") * 10 + (content.lane ? LANE_ORDER.indexOf(content.lane) : 9)
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => rank(a.line) - rank(b.line) || a.index - b.index)
    .map((row) => row.line)
}

/** A new line for a player: in their own lane when no starter holds it yet, on the bench otherwise. */
export function addedLine(
  lines: readonly RosterLine[],
  scope: { tournamentId: string; teamId: string },
  playerId: string,
  lane?: Lane | null,
): RosterLine {
  const taken = new Set(activeLines(lines).map((line) => line.content.lane))
  const starts = !!lane && !taken.has(lane) && activeLines(lines).length < LANE_ORDER.length
  return {
    content: {
      ...scope,
      playerId,
      lane: lane ?? null,
      jerseyNumber: null,
      status: starts ? "ACTIVE" : "SUBSTITUTE",
      startsOn: null,
      endsOn: null,
      sourceUrl: null,
      verification: "UNVERIFIED",
      note: null,
    },
  }
}

const activeLines = (lines: readonly RosterLine[]) =>
  lines.filter((line) => !line.removed && line.content.status === "ACTIVE")

const same = (a: RosterMembershipContent, b: RosterMembershipContent) => {
  const value = (content: RosterMembershipContent) => [
    content.playerId,
    content.lane ?? null,
    content.jerseyNumber ?? null,
    content.status ?? "UNKNOWN",
    content.startsOn ?? null,
    content.endsOn ?? null,
    content.sourceUrl ?? null,
    content.verification ?? "UNVERIFIED",
    content.note ?? null,
  ]
  return JSON.stringify(value(a)) === JSON.stringify(value(b))
}

export const lineChanged = (line: RosterLine) =>
  line.removed ? !!line.stored : !line.stored || !same(line.stored.content, line.content)

/** The write that turns the stored roster into the lines: only what changed. */
export function rosterBatchOf(lines: readonly RosterLine[]): Required<RosterBatch> {
  const changed = lines.filter(lineChanged)
  return {
    create: changed.filter((line) => !line.stored && !line.removed).map((line) => line.content),
    update: changed
      .filter((line) => line.stored && !line.removed)
      .map((line) => ({ id: line.stored!.id, version: line.stored!.version, content: line.content })),
    remove: changed
      .filter((line) => line.stored && line.removed)
      .map((line) => ({ id: line.stored!.id, version: line.stored!.version })),
  }
}

export type RosterWarning = { text: string; blocking: boolean }

/** What an editor should look at before saving. Only a line that does not hold blocks the save. */
export function rosterWarnings(lines: readonly RosterLine[], name: (playerId: string) => string): RosterWarning[] {
  const kept = lines.filter((line) => !line.removed)
  const warnings: RosterWarning[] = []
  for (const line of kept) {
    const issue = rosterFormIssue(line.content)
    if (issue) warnings.push({ text: `${name(line.content.playerId)}: ${issue}`, blocking: true })
  }
  const starters = activeLines(lines)
  for (const lane of LANE_ORDER) {
    const here = starters.filter((line) => line.content.lane === lane)
    if (here.length > 1)
      warnings.push({
        text: `${LANE_LABELS[lane].name} có ${here.length} người thi đấu chính: ${here.map((line) => name(line.content.playerId)).join(", ")}`,
        blocking: false,
      })
  }
  const missing = LANE_ORDER.filter((lane) => !starters.some((line) => line.content.lane === lane))
  if (kept.length && missing.length)
    warnings.push({
      text: `Chưa có người chính ở ${missing.map((lane) => LANE_LABELS[lane].short).join(", ")}`,
      blocking: false,
    })
  return warnings
}

/** Names pasted one per line or apart by commas, without numbering, each once. */
export function pastedNames(text: string): string[] {
  const names = text
    .split(/[\n,;\t]+/)
    .map((name) => name.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, "").trim())
    .filter(Boolean)
  const unique = new Map(names.map((name) => [foldSearchText(name), name]))
  return [...unique.values()]
}

/** Whether a record goes by the name, accents and case aside. */
export const goesByName = (name: string, names: readonly (string | null | undefined)[]) =>
  names.some((other) => other && foldSearchText(other).trim() === foldSearchText(name).trim())
