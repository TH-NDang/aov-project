import type { GameContent, Selection, Side } from "@aov/community-contracts"

export type HeroStat = {
  key: string
  name: string
  picks: number
  wins: number
  bans: number
  blue: { picks: number; wins: number }
  red: { picks: number; wins: number }
}
export type GameStats = {
  games: number
  decided: number
  sideWins: Record<Side, number>
  heroes: HeroStat[]
  shortest?: { gameIndex: number; seconds: number }
  longest?: { gameIndex: number; seconds: number }
  averageSeconds: number | null
}

const heroKey = (selection?: Selection | null) =>
  selection?.id || (selection?.name ? `name:${selection.name.toLocaleLowerCase()}` : "")

/** Pick/ban and side statistics over recorded games; games without a winner only count toward presence. */
export function gameStatistics(games: GameContent[]): GameStats {
  const heroes = new Map<string, HeroStat>()
  const hero = (selection: Selection) => {
    const key = heroKey(selection)
    let entry = heroes.get(key)
    if (!entry) {
      entry = {
        key,
        name: selection.name || "Chưa rõ",
        picks: 0,
        wins: 0,
        bans: 0,
        blue: { picks: 0, wins: 0 },
        red: { picks: 0, wins: 0 },
      }
      heroes.set(key, entry)
    }
    return entry
  }
  const sideWins: Record<Side, number> = { BLUE: 0, RED: 0 }
  const durations: { gameIndex: number; seconds: number }[] = []
  let decided = 0

  games.forEach((game, gameIndex) => {
    if (game.winner) {
      decided++
      sideWins[game.winner]++
    }
    if (game.durationSeconds) durations.push({ gameIndex, seconds: game.durationSeconds })
    for (const side of game.sides) {
      for (const ban of side.bans) if (heroKey(ban)) hero(ban).bans++
      for (const participant of side.participants) {
        if (!heroKey(participant.hero)) continue
        const entry = hero(participant.hero)
        const bucket = side.side === "BLUE" ? entry.blue : entry.red
        entry.picks++
        bucket.picks++
        if (game.winner === side.side) {
          entry.wins++
          bucket.wins++
        }
      }
    }
  })

  const sorted = [...durations].sort((a, b) => a.seconds - b.seconds)
  return {
    games: games.length,
    decided,
    sideWins,
    heroes: [...heroes.values()].sort((a, b) => b.picks + b.bans - (a.picks + a.bans) || b.picks - a.picks),
    shortest: sorted[0],
    longest: sorted.at(-1),
    averageSeconds: durations.length
      ? Math.round(durations.reduce((total, entry) => total + entry.seconds, 0) / durations.length)
      : null,
  }
}

export const rate = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "–")
