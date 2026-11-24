import type { CompetitionView, TeamContent, TournamentPlacement } from "@aov/community-contracts"
import { stageBracket } from "./bracket-model.ts"
import { champion, competitionStatus, matchWinner, playedOrder } from "./competition-model.ts"
import type { CompetitionMatch } from "./match-model.ts"

export type ChampionTeam = Pick<TeamContent, "name" | "shortName" | "logoUrl" | "logoDarkUrl"> & { id: string | null }
export type Champion = { winner: ChampionTeam; runnerUp: ChampionTeam | null; score: string | null }

/** A team a result names, with its logo and id when the competition knows it. */
function namedTeam(view: CompetitionView, name: string): ChampionTeam {
  const found = Object.entries(view.content.teams).find(([, team]) => team.name === name || team.shortName === name)
  return found ? { ...found[1], id: found[0] } : { name, id: null }
}

function teamById(view: CompetitionView, id: string | null | undefined): ChampionTeam | null {
  const team = id ? view.content.teams[id] : undefined
  return team ? { ...team, id: id! } : null
}

/**
 * The match that ends the bracket of a competition, when one match does: its last stage played is a bracket with a
 * single match nobody goes on from.
 */
function decidingMatch(view: CompetitionView): CompetitionMatch | null {
  const { plan } = view.content
  const played = plan.stages.filter((stage) => plan.matches.some((match) => match.stageCode === stage.code))
  const last = playedOrder(played, plan.matches).at(-1)
  if (!last || last.format === "ROUND_ROBIN") return null
  const { nodes, links } = stageBracket(view, last.code)
  if (nodes.length > 1 && !links.length) return null
  if (nodes.some((node) => matchWinner(node.entry) == null)) return null
  const ends = nodes.filter((node) => node.lane !== "third" && !links.some((link) => link.from === node))
  return ends.length === 1 ? ends[0]!.entry : null
}

/**
 * Who won a competition: the champion of its final table or of its recorded result, or else the winner of the match
 * that ends the bracket of a finished event. A qualifier names no champion that way, since it may send on several.
 */
export function competitionChampion(view: CompetitionView): Champion | null {
  const { tournament, teams } = view.content
  const recorded = champion(tournament, teams)
  if (recorded)
    return {
      winner: namedTeam(view, recorded.winner.name),
      runnerUp: recorded.runnerUp ? namedTeam(view, recorded.runnerUp.name) : null,
      score: recorded.score,
    }
  if (competitionStatus(view.content) !== "FINISHED" || tournament.competitionType === "QUALIFIER") return null
  const final = decidingMatch(view)
  if (!final) return null
  const { match, result } = final
  const ids = { a: result?.teamAId || match.a.teamId, b: result?.teamBId || match.b.teamId }
  const won = matchWinner(final)!
  const winner = teamById(view, ids[won])
  if (!winner) return null
  const { scoreA, scoreB } = result!
  return {
    winner,
    runnerUp: teamById(view, ids[won === "a" ? "b" : "a"]),
    score: won === "a" ? `${scoreA}–${scoreB}` : `${scoreB}–${scoreA}`,
  }
}

export type FinalRow = TournamentPlacement & { team: ChampionTeam }

/** The lines of the final table with the team of each; lines that name nobody are left out. */
export function finalTable(view: CompetitionView): FinalRow[] {
  return (view.content.tournament.placements ?? []).flatMap((line) => {
    const name = line.teamName?.trim()
    const team = teamById(view, line.teamId) ?? (name ? namedTeam(view, name) : null)
    return team ? [{ ...line, team }] : []
  })
}

/** The team that won more of the given competitions than any other, once it won at least two. */
export function mostTitles(views: CompetitionView[]) {
  const titles = new Map<string, { team: ChampionTeam; count: number }>()
  for (const view of views) {
    const team = competitionChampion(view)?.winner
    if (!team) continue
    const key = team.id ?? team.name.toLocaleLowerCase()
    titles.set(key, { team, count: (titles.get(key)?.count ?? 0) + 1 })
  }
  const [first, second] = [...titles.values()].sort((a, b) => b.count - a.count)
  return first && first.count > 1 && first.count > (second?.count ?? 0) ? first : null
}
