import type { CompetitionStatistics, HeroCount } from "@aov/community-contracts"

/** A hero of a competition's statistics; `key` is what an address calls it, as among the published games. */
export type SeenHero = HeroCount & { key: string; presence: number }

/** The heroes picked or banned in the most games, or picked in the most, the one seen most first. */
export function mostSeen(
  { heroes }: Pick<CompetitionStatistics, "heroes">,
  size: number,
  by: "presence" | "picks" = "presence",
): SeenHero[] {
  return heroes
    .map((hero): SeenHero => ({
      ...hero,
      key: hero.code || hero.id || hero.name,
      presence: hero.picks + hero.bans,
    }))
    .filter((hero) => hero[by] > 0)
    .sort((x, y) => y[by] - x[by] || y.picks - x.picks || x.name.localeCompare(y.name))
    .slice(0, size)
}
