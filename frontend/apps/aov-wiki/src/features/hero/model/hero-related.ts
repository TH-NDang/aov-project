/** What a hero shares with another to count as one to read next: its lanes first, then its roles. */
export interface RelatedCandidate {
  id: string
  name: string
  roles: readonly string[]
  positions?: readonly string[] | null
}

/**
 * The heroes played where this one is played, those that also share a role first, then by name. A hero without a lane
 * falls back to the heroes that share a role. The hero itself is never listed.
 */
export function relatedHeroes<Hero extends RelatedCandidate>(
  current: RelatedCandidate,
  heroes: readonly Hero[],
  { limit, locale }: { limit: number; locale: string },
): Hero[] {
  const lanes = current.positions ?? []
  const shared = (left: readonly string[] | null | undefined, right: readonly string[]) =>
    (left ?? []).filter((value) => right.includes(value)).length
  const byName = new Intl.Collator(locale, { sensitivity: "base" })

  return heroes
    .filter((hero) => hero.id !== current.id)
    .map((hero) => ({ hero, lanes: shared(hero.positions, lanes), roles: shared(hero.roles, current.roles) }))
    .filter((entry) => (lanes.length ? entry.lanes > 0 : entry.roles > 0))
    .sort(
      (left, right) =>
        right.lanes - left.lanes || right.roles - left.roles || byName.compare(left.hero.name, right.hero.name),
    )
    .slice(0, limit)
    .map((entry) => entry.hero)
}
