type PatchOrder = { id: string; seasonId: string; rulesetId: string; ordinal: number }

/** Versions of one ruleset in release order: by season, then by patch inside the season. */
export function orderedPatches<T extends PatchOrder>(
  patches: readonly T[],
  seasons: readonly { id: string; ordinal: number }[],
) {
  const seasonOrder = new Map(seasons.map((season) => [season.id, season.ordinal]))
  return [...patches].sort(
    (a, b) => (seasonOrder.get(a.seasonId) ?? 0) - (seasonOrder.get(b.seasonId) ?? 0) || a.ordinal - b.ordinal,
  )
}

export function previousPatch<T extends PatchOrder>(
  patches: readonly T[],
  seasons: readonly { id: string; ordinal: number }[],
  selected: T | undefined,
) {
  if (!selected) return undefined
  const line = orderedPatches(
    patches.filter((patch) => patch.rulesetId === selected.rulesetId),
    seasons,
  )
  return line[line.findIndex((patch) => patch.id === selected.id) - 1]
}
