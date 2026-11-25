import type { CompetitionMatch } from "./match-model.ts"

/** The entries before and after the one at `at`; nothing on a side where the list ends. */
export const beside = <T>(list: T[], at: number): { before: T | null; after: T | null } => ({
  before: (at > 0 && list[at - 1]) || null,
  after: (at >= 0 && list[at + 1]) || null,
})

/** Whether both teams of a match are known, so its name says something. */
const named = ({ match, result }: CompetitionMatch) =>
  !!((result?.teamAId || match.a.teamId) && (result?.teamBId || match.b.teamId))

/**
 * The matches played just before and just after one, by when they were scheduled. Matches that name no teams or no time
 * are passed over.
 */
export function matchNeighbours(entries: CompetitionMatch[], key: string) {
  const order = entries
    .filter((entry) => entry.match.key === key || (named(entry) && !!entry.match.scheduledAt))
    .sort(
      (a, b) =>
        (Date.parse(a.match.scheduledAt || "") || 0) - (Date.parse(b.match.scheduledAt || "") || 0) ||
        a.match.key.localeCompare(b.match.key),
    )
  const at = order.findIndex((entry) => entry.match.key === key)
  // A match without a time has no place among the others.
  if (at < 0 || !order[at]!.match.scheduledAt) return { before: null, after: null }
  return beside(order, at)
}
