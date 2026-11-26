import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { stageBracket, type BracketLayout, type BracketNode } from "./bracket-model.ts"
import { isElimination } from "./competition-model.ts"
import { competitionMatches, type CompetitionMatch } from "./match-model.ts"

/** Every round as a column of its own, from the top; no match leads to another. */
function roundsLayout(entries: CompetitionMatch[]): BracketLayout {
  const numbers = [...new Set(entries.map(({ match }) => match.round))].sort((x, y) => x - y)
  const rounds = numbers.map((round) => entries.filter(({ match }) => match.round === round))
  const nodes = rounds.flatMap((own, column) =>
    own.map((entry, row): BracketNode => ({
      entry,
      lane: "rounds",
      column,
      row,
      // No round of it closes anything, so none is called or drawn as a semifinal or a final.
      round: { lane: "rounds", order: column + 1, left: Infinity, matches: own.length },
    })),
  )
  const rows = Math.max(1, ...rounds.map((own) => own.length))
  return { nodes, links: [], columns: rounds.length, rows, lanes: [{ key: "rounds", row: 0 }] }
}

/**
 * The drawing of a stage without a table: its bracket, or its rounds beside each other where the plan ties no match to
 * another, as in a Swiss stage. Who meets whom there follows from the records of the teams, not from a match before.
 */
export function stageDrawing(view: CompetitionView, stage: CompetitionStage): BracketLayout {
  const entries = competitionMatches([view]).filter(({ match }) => match.stageCode === stage.code)
  const tied = entries.some(({ match }) => match.a.matchKey || match.b.matchKey)
  return tied || isElimination(stage) ? stageBracket(view, stage.code) : roundsLayout(entries)
}
