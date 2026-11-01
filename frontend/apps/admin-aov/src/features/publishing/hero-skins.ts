import type { Skin } from "./types"

const baseAppearanceKey = /^(.+)-(?:mac-dinh|heroskin|default)-1$/

/**
 * The hero's own images stored as a skin (ADR-010 `<heroCode>-mac-dinh-1` and its legacy forms), which the public
 * skin catalog leaves out too. Keys start with the hero code, so the prefix must be shared by every other skin; a
 * real skin whose name merely ends in "mac-dinh" keeps showing.
 */
export function visibleSkins<T extends Pick<Skin, "skinKey">>(skins: readonly T[]): T[] {
  const isBase = (key: string) => {
    if (key === "default") return true
    const heroCode = baseAppearanceKey.exec(key)?.[1]
    return !!heroCode && skins.every((other) => other.skinKey === "default" || other.skinKey.startsWith(`${heroCode}-`))
  }
  return skins.filter((skin) => !isBase(skin.skinKey))
}
