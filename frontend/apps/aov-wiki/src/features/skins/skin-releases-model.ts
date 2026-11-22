/** What a skin needs to be compared across two versions of the collection. */
export interface ReleasedSkin {
  skinKey: string
  unscopedBaseline?: boolean
}

/**
 * The skins a version brought: in its collection but not in the version before. The data holds no release day for
 * skins, so this is only said where both versions were recorded: a version before with no skins at all, or a skin from
 * the undated baseline, says nothing about when a skin came. Until the collection is recorded version by version, the
 * list stays empty.
 */
export function skinsNewIn<Skin extends ReleasedSkin>(
  current: readonly Skin[],
  previous: readonly ReleasedSkin[] | undefined,
): Skin[] {
  if (!previous?.length) return []
  const before = new Set(previous.map((skin) => skin.skinKey))
  return current.filter((skin) => !skin.unscopedBaseline && !before.has(skin.skinKey))
}
