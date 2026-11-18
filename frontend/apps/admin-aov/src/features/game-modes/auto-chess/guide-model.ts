/** Types, colours and list edits the auto chess guide sections share; no React here. */
import type { GuideContent } from "../game-mode-api"

export type Unit = GuideContent["units"][number]

export type Trait = GuideContent["traits"][number]

export type Item = GuideContent["items"][number]

export type Blessing = GuideContent["blessings"][number]

export interface SectionProps {
  content: GuideContent
  /** The draft as last saved; its codes no longer follow a name. */
  saved: GuideContent | null
  setContent: (content: GuideContent) => void
  image: (id?: string | null) => string | undefined
  upload: (file: File, label: string) => Promise<string>
}

/** The game's cost colors, so a price reads at a glance like in the guide. */
export const COST_COLOR: Record<number, string> = {
  1: "#9aa4b2",
  2: "#4fbf7a",
  3: "#4f9be0",
  4: "#b46cff",
  5: "#f2b440",
  6: "#e0625a",
}

export const swapAt = <T>(rows: T[], at: number, next: T) => rows.map((row, index) => (index === at ? next : row))

/** A copy right after the original, with a code nothing else uses yet. */
export function duplicateAt<T extends { code: string; name: string }>(rows: T[], at: number): T[] {
  const source = rows[at]
  const taken = new Set(rows.map((row) => row.code))
  const base = source.code.replace(/-\d+$/, "") || "ban-sao"
  let number = 2
  while (taken.has(`${base}-${number}`)) number++
  const copy = { ...source, code: `${base}-${number}`, name: `${source.name} (bản sao)` }
  return [...rows.slice(0, at + 1), copy, ...rows.slice(at + 1)]
}

export const moveAt = <T>(rows: T[], at: number, delta: -1 | 1) => {
  const target = at + delta
  if (target < 0 || target >= rows.length) return rows
  const next = [...rows]
  ;[next[at], next[target]] = [next[target], next[at]]
  return next
}

export function renameUnit(content: GuideContent, from: string, to: string): GuideContent {
  if (!from || from === to) return content
  return {
    ...content,
    units: content.units.map((unit) => (unit.code === from ? { ...unit, code: to } : unit)),
    lineups: content.lineups.map((lineup) => ({
      ...lineup,
      units: lineup.units.map((unit) => (unit.unitCode === from ? { ...unit, unitCode: to } : unit)),
    })),
  }
}

export function renameTrait(content: GuideContent, from: string, to: string): GuideContent {
  if (!from || from === to) return content
  return {
    ...content,
    traits: content.traits.map((trait) => (trait.code === from ? { ...trait, code: to } : trait)),
    units: content.units.map((unit) => ({
      ...unit,
      traitCodes: unit.traitCodes.map((code) => (code === from ? to : code)),
    })),
    lineups: content.lineups.map((lineup) => ({
      ...lineup,
      emblems: lineup.emblems.map((code) => (code === from ? to : code)),
    })),
  }
}
