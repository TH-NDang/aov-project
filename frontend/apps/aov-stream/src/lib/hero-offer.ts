import type { Lane } from "@aov/community-contracts"
import { heroChoices, type HeroRole, type Question } from "./finder-model.ts"
import { heroByKey, type FeedHero, type GameFeed } from "./game-feed.ts"
import { laneCounts, type HeroRecord } from "./hero-model.ts"
import { namedLike, playsLane } from "./heroes-view.ts"
import { LANES } from "./tournament-model.ts"

/** A hero on offer for a seat: the games that would remain with it there, and the lanes it plays. */
export type HeroOffer = { hero: FeedHero; games: number; lanes: Lane[] }

/** Every hero that leaves games when it takes a seat, the one that leaves most first. */
export function heroOffers(
  feed: Pick<GameFeed, "games" | "heroes">,
  records: Map<string, HeroRecord>,
  question: Question,
  role: HeroRole,
): HeroOffer[] {
  return [...heroChoices(feed.games, question, role)]
    .flatMap(([key, games]): HeroOffer[] => {
      const hero = heroByKey(feed, key)
      if (!hero) return []
      const picks = records.get(key)?.picks ?? []
      const line = { lanes: laneCounts(picks), picks: picks.length }
      return [{ hero, games, lanes: LANES.filter((lane) => playsLane(line, lane)) }]
    })
    .sort((x, y) => y.games - x.games || x.hero.name.localeCompare(y.hero.name, "vi"))
}

/** Where a key goes from one tile of a grid to another: null for other keys, -1 for up and out of the first row. */
export function tileAfter(key: string, at: number, columns: number, tiles: number): number | null {
  if (key === "ArrowRight") return Math.min(at + 1, tiles - 1)
  if (key === "ArrowLeft") return Math.max(at - 1, 0)
  if (key === "ArrowDown") return Math.min(at + columns, tiles - 1)
  if (key === "ArrowUp") return Math.max(at - columns, -1)
  if (key === "Home") return 0
  return key === "End" ? tiles - 1 : null
}

/** The offers a search and a lane leave. */
export const narrowOffers = (offers: HeroOffer[], search: string, lane: Lane | null): HeroOffer[] =>
  namedLike(offers, search).filter(({ lanes }) => !lane || lanes.includes(lane))
