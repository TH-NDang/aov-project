import type { BracketLayout, BracketNode } from "./bracket-model.ts"
import { matchWinner } from "./competition-model.ts"
import type { CompetitionMatch } from "./match-model.ts"

type Side = "a" | "b"

/** One match of a team's way through a bracket. */
export type JourneyStop = {
  node: BracketNode
  side: Side
  opponentId: string | null
  /** Its own score, then the opponent's; null until the match is played. */
  score: [own: number, rival: number] | null
  outcome: "won" | "lost" | null
}

/** How a team's way ended: with the title, beaten in the final, out before it, or not over yet. */
export type JourneyEnd = "champion" | "runner-up" | "out" | "open"

const teamOf = ({ match, result }: CompetitionMatch, side: Side) =>
  (side === "a" ? result?.teamAId : result?.teamBId) || match[side].teamId || null

const startOf = ({ match }: CompetitionMatch) => Date.parse(match.scheduledAt || "") || 0

/** The matches of a team in the order it played them. */
export function teamJourney(layout: BracketLayout, teamId: string): JourneyStop[] {
  return layout.nodes
    .flatMap((node): JourneyStop[] => {
      const { entry } = node
      const side = (["a", "b"] as const).find((key) => teamOf(entry, key) === teamId)
      if (!side) return []
      const rival = side === "a" ? "b" : "a"
      const { scoreA, scoreB } = entry.result ?? {}
      const played = scoreA != null && scoreB != null
      const winner = matchWinner(entry)
      return [
        {
          node,
          side,
          opponentId: teamOf(entry, rival),
          score: played ? (side === "a" ? [scoreA, scoreB] : [scoreB, scoreA]) : null,
          outcome: winner == null ? null : winner === side ? "won" : "lost",
        },
      ]
    })
    .sort((x, y) => x.node.column - y.node.column || startOf(x.node.entry) - startOf(y.node.entry))
}

/** The node that ends the bracket: the grand final, or the last match of a bracket of one lane. */
function decider(layout: BracketLayout) {
  const ends = layout.nodes.filter(
    (node) => node.lane !== "third" && !layout.links.some((link) => link.from === node) && node.column > 0,
  )
  return ends.find((node) => node.lane === "final") ?? (ends.length === 1 ? ends[0] : undefined)
}

export function journeyEnd(layout: BracketLayout, stops: JourneyStop[]): JourneyEnd {
  const last = stops.at(-1)
  const final = stops.find((stop) => stop.node === decider(layout))
  if (final?.outcome === "won") return "champion"
  if (final?.outcome === "lost") return "runner-up"
  return !last || last.outcome !== "lost" || final ? "open" : "out"
}

/** Every team of a bracket, the one that went furthest first: the champion, the other finalist, then by last round. */
export function bracketTeams(layout: BracketLayout): string[] {
  const ids = new Set(
    layout.nodes.flatMap(({ entry }) => [teamOf(entry, "a"), teamOf(entry, "b")].filter((id) => id != null)),
  )
  const rank = { champion: 0, "runner-up": 1, open: 2, out: 3 } satisfies Record<JourneyEnd, number>
  const reach = [...ids].map((id) => {
    const stops = teamJourney(layout, id)
    const last = stops.at(-1)!
    return { id, end: rank[journeyEnd(layout, stops)], column: last.node.column, at: startOf(last.node.entry) }
  })
  return reach.sort((x, y) => x.end - y.end || y.column - x.column || y.at - x.at).map(({ id }) => id)
}
