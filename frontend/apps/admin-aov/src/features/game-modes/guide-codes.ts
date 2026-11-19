import type { GuideContent } from "./game-mode-api"
import { slugify } from "@/lib/text"

/**
 * Codes that no longer follow their entry's name: every code of the saved draft, which the public guide and its links
 * may already use, and every code another entry of the open draft points at.
 */
export function fixedCodes(saved: GuideContent | null, content: GuideContent): ReadonlySet<string> {
  const codes = new Set<string>()
  const add = (list: readonly (string | null | undefined)[]) => list.forEach((code) => code && codes.add(code))
  if (saved)
    for (const rows of [saved.units, saved.traits, saved.itemGroups, saved.items, saved.blessings, saved.lineups])
      add(rows.map((row) => row.code))
  add(content.units.flatMap((unit) => unit.traitCodes))
  add(content.items.map((item) => item.groupCode))
  for (const lineup of content.lineups) {
    add(lineup.units.flatMap((unit) => [unit.unitCode, ...unit.itemCodes]))
    add(lineup.emblems)
    add(lineup.blessingCodes)
    add((lineup.stages ?? []).flatMap((stage) => stage.unitCodes))
    add(lineup.priorityItemCodes ?? [])
  }
  return codes
}

/**
 * The entry under a new name. A new entry's code follows its name while it is typed; a fixed code stays, because the
 * public guide or other entries use it, and changes only through the explicit code rename, which updates them too.
 */
export function named<T extends { code: string; name: string }>(entry: T, name: string, fixed: ReadonlySet<string>): T {
  const followsName = !entry.code || (!fixed.has(entry.code) && entry.code === slugify(entry.name))
  return { ...entry, name, code: followsName ? slugify(name) : entry.code }
}
