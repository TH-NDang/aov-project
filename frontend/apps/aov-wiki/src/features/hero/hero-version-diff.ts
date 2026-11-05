import type { HeroDetail, PublicSkill } from "./hero-api"

/** Compares two published snapshots of a hero. It only reads gameplay text and numbers; images never count. */
export type DiffSegment = { kind: "same" | "del" | "ins"; text: string }
export type ValueChange = { before: string; after: string }

export interface SkillDifference {
  isNew: boolean
  description: DiffSegment[] | null
  rows: Map<string, { before: (string | null)[]; after: (string | null)[] }>
  cooldown: ValueChange | null
  energyCost: ValueChange | null
}

export interface HeroDifferences {
  skills: Map<string, SkillDifference>
  stats: Map<string, ValueChange>
}

export const NO_DIFFERENCES: HeroDifferences = { skills: new Map(), stats: new Map() }

export function stripSkillMarkup(value: string) {
  return value.replace(/<\/?[a-z][^>]*>/gi, "")
}

const MAX_DIFF_CELLS = 1_000_000

export function diffWords(before: string, after: string): DiffSegment[] {
  const a = before.match(/\s+|[^\s]+/g) ?? []
  const b = after.match(/\s+|[^\s]+/g) ?? []
  if (a.length * b.length > MAX_DIFF_CELLS) {
    return [
      { kind: "del", text: before },
      { kind: "ins", text: after },
    ]
  }

  const width = b.length + 1
  const lengths = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] =
        a[i] === b[j]
          ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1])
    }
  }

  const segments: DiffSegment[] = []
  const push = (kind: DiffSegment["kind"], text: string) => {
    const last = segments.at(-1)
    if (last?.kind === kind) last.text += text
    else segments.push({ kind, text })
  }
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push("same", a[i])
      i++
      j++
    } else if (j >= b.length || (i < a.length && lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      push("del", a[i++])
    } else {
      push("ins", b[j++])
    }
  }
  return segments
}

function snapshot(skill: PublicSkill) {
  return skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata ?? undefined
}

const changed = (before: string | undefined, after: string | undefined): ValueChange | null =>
  (before ?? "") === (after ?? "") ? null : { before: before ?? "—", after: after ?? "—" }

function tableRows(skill: PublicSkill) {
  const rows = new Map<string, (string | null)[]>()
  for (const row of snapshot(skill)?.levelTable?.rows ?? []) {
    if (row?.label)
      rows.set(
        row.label,
        (row.display_values ?? []).map((value) => (value == null ? null : String(value))),
      )
  }
  return rows
}

export function skillDifference(before: PublicSkill | undefined, after: PublicSkill): SkillDifference | null {
  if (!before) return { isNew: true, description: null, rows: new Map(), cooldown: null, energyCost: null }

  const oldText = stripSkillMarkup(before.description ?? "")
  const newText = stripSkillMarkup(after.description ?? "")
  const description = oldText === newText ? null : diffWords(oldText, newText)

  const rows: SkillDifference["rows"] = new Map()
  const oldRows = tableRows(before)
  for (const [label, values] of tableRows(after)) {
    const previous = oldRows.get(label)
    if (previous && JSON.stringify(previous) !== JSON.stringify(values))
      rows.set(label, { before: previous, after: values })
  }

  const cooldown = changed(snapshot(before)?.cooldown?.display, snapshot(after)?.cooldown?.display)
  const energyCost = changed(snapshot(before)?.energyCost?.display, snapshot(after)?.energyCost?.display)
  if (!description && !rows.size && !cooldown && !energyCost) return null
  return { isNew: false, description, rows, cooldown, energyCost }
}

export function heroDifferences(
  before: Pick<HeroDetail, "content">,
  after: Pick<HeroDetail, "content">,
): HeroDifferences {
  const skills = new Map<string, SkillDifference>()
  const oldSkills = new Map(before.content.skills?.skills?.map((skill) => [skill.skillKey, skill]))
  for (const skill of after.content.skills?.skills ?? []) {
    const difference = skillDifference(oldSkills.get(skill.skillKey), skill)
    if (difference) skills.set(skill.skillKey, difference)
  }

  const stats = new Map<string, ValueChange>()
  const oldStats = new Map(before.content.combatStats?.values?.map((stat) => [stat.statKey, stat.baseValue]))
  for (const stat of after.content.combatStats?.values ?? []) {
    const previous = oldStats.get(stat.statKey)
    if (previous != null && stat.baseValue != null && previous !== stat.baseValue) {
      stats.set(stat.statKey, { before: String(previous), after: String(stat.baseValue) })
    }
  }
  return { skills, stats }
}

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
