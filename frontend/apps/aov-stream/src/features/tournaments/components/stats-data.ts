import type { CompetitionView } from "@aov/community-contracts"
import type { Counted, FeedPeriod, GameFeed } from "../../../lib/game-feed"
import type { HeroRecord } from "../../../lib/hero-model"

/** What every part of the statistics is drawn from. */
export type StatsData = {
  view: CompetitionView
  /** Every published game of the competition. */
  whole: GameFeed
  /** The games counted: all of them, or those of the period the address names. */
  feed: GameFeed
  period: FeedPeriod | null
  /** How many games those are, and how many of them show their bans. */
  counted: Counted
  /** What became of each hero in the games counted. */
  records: Map<string, HeroRecord>
}
