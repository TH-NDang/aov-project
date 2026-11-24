import type { TournamentAward } from "@aov/community-contracts"

/** Awards of one title together, in the order the titles first appear, such as the five of a best line-up. */
export function awardGroups(awards: readonly TournamentAward[]): { title: string; awards: TournamentAward[] }[] {
  const groups = new Map<string, TournamentAward[]>()
  for (const award of awards) groups.set(award.title, [...(groups.get(award.title) ?? []), award])
  return [...groups].map(([title, members]) => ({ title, awards: members }))
}
