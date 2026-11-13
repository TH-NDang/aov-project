import type { GameContent, Selection, Side } from "@aov/community-contracts"
import { nameKey } from "./name-key"

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

/**
 * One key per hero across the games: the catalog id, also for a record that has only a name when another record pairs
 * that name with an id, else the folded name. Imported games name heroes without an id while games recorded by hand
 * carry both, so keying by id alone would count one hero twice.
 */
function heroKeyer(games: GameContent[]) {
  const idByName = new Map<string, string>()
  for (const game of games)
    for (const side of game.sides)
      for (const selection of [...side.bans, ...side.participants.map((participant) => participant.hero)])
        if (selection?.id && selection.name?.trim()) idByName.set(nameKey(selection.name), selection.id)
  return (selection?: Selection | null) => {
    if (selection?.id) return selection.id
    if (!selection?.name?.trim()) return ""
    const key = nameKey(selection.name)
    return idByName.get(key) ?? `name:${key}`
  }
}

/** Pick/ban and side statistics over recorded games; games without a winner only count toward presence. */
export function gameStatistics(games: GameContent[]): GameStats {
  const heroKey = heroKeyer(games)
  const heroes = new Map<string, HeroStat>()
  const hero = (selection: Selection) => {
    const key = heroKey(selection)
    let entry = heroes.get(key)
    // The catalog's spelling wins over an imported one.
    if (entry && selection.id && selection.name) entry.name = selection.name
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
