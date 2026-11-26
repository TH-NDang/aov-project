import type { Skin } from "@/lib/hero-types"
import { slugify } from "@/lib/text"

/** Lower case, no accents, words joined by hyphens, as in "tan-thuy-thu" for the Vietnamese sailor skin name. */
export function skinSlug(text: string) {
  return slugify(text)
}

/**
 * The hero part of the skin keys, read off the keys already there: `ata-tan-thuy-thu-1` named after "tan-thuy-thu" gives
 * `ata`. Keys follow `<hero>-<name>-<number>`, so a new skin can take the same form without anyone typing it.
 */
export function skinKeyPrefix(skins: readonly Skin[]) {
  for (const skin of skins) {
    for (const text of skin.translations) {
      const tail = new RegExp(`-${skinSlug(text.name)}-\\d+$`)
      if (skinSlug(text.name) && tail.test(skin.skinKey)) return skin.skinKey.replace(tail, "")
    }
  }
  return ""
}

/** A key for a skin of this name that no other skin of the hero uses yet. */
export function nextSkinKey(skins: readonly Skin[], name: string, own?: string) {
  const prefix = skinKeyPrefix(skins)
  const base = [prefix, skinSlug(name) || "trang-phuc"].filter(Boolean).join("-")
  const used = new Set(skins.map((skin) => skin.skinKey).filter((key) => key !== own))
  let number = 1
  while (used.has(`${base}-${number}`)) number++
  return `${base}-${number}`
}
