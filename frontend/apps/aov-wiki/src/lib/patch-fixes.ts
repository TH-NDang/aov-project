import { changeKind, type PublishedChange } from "./published-change-subjects.ts"
import { changeSetKind, type HeroChangeItem } from "./wiki-change-format.ts"

/** The kind of a change that only fixes a bug or smooths how something plays. */
export const FIX_KIND = "FIX"

type HeroRow = PublishedChange & { changes?: HeroChangeItem[] }

/**
 * Bug fixes and optimisations are read apart from the balance changes, as the official notes print them. A hero keeps
 * its other changes where they were and hands its fixes to the fixes; a hero that only had fixes leaves the hero list.
 * Both lists keep the order the update gives its heroes.
 */
export function splitHeroFixes<Row extends HeroRow>(rows: Row[]): { main: Row[]; fixes: Row[] } {
  const main: Row[] = []
  const fixes: Row[] = []
  for (const row of rows) {
    const lines: HeroChangeItem[] = row.changes ?? []
    if (!lines.length) {
      ;(changeSetKind(row) === FIX_KIND ? fixes : main).push(row)
      continue
    }
    const fixed = lines.filter((line) => line.changeKind === FIX_KIND)
    const other = lines.filter((line) => line.changeKind !== FIX_KIND)
    // A set rated as a fix as a whole but holding other changes reads by those changes once its fixes have left.
    if (other.length)
      main.push(
        fixed.length
          ? { ...row, changes: other, overallKind: row.overallKind === FIX_KIND ? undefined : row.overallKind }
          : row,
      )
    if (fixed.length) fixes.push(other.length ? { ...row, changes: fixed, overallKind: FIX_KIND } : row)
  }
  return { main, fixes }
}

/** An armory entry whose only change in the update is a fix. */
export function isCatalogFix(row: PublishedChange) {
  return changeKind(row) === FIX_KIND
}
