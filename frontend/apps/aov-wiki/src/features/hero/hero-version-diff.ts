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

/** Text as a reader sees it: color markup and spacing differences say nothing about gameplay. */
const readable = (value: string) => stripSkillMarkup(value).replace(/\s+/g, " ").trim()

const MAX_DIFF_CELLS = 1_000_000
/** Numbers stand apart from the words around them, so "(+80%Attack" to "(+90%Attack" marks only the number. */
const DIFF_TOKEN = /\s+|\d+(?:[.,]\d+)*%?|[\p{L}\p{M}]+|[^\s\p{L}\p{M}\d]/gu
const isSpace = (token: string) => !token.trim()
const sameToken = (left: string, right: string) => left === right || (isSpace(left) && isSpace(right))
const JOINING_TEXT = /^[\s\p{P}\p{S}]{1,4}$/u

/** Two edits a space or a bracket apart read as one edit, instead of old and new words taking turns. */
function joinNearbyEdits(segments: DiffSegment[]) {
  const joined: DiffSegment[] = []
  let removed = ""
  let added = ""
  const flush = () => {
    if (removed) joined.push({ kind: "del", text: removed })
    if (added) joined.push({ kind: "ins", text: added })
    removed = ""
    added = ""
  }
  segments.forEach((segment, index) => {
    if (segment.kind === "del") removed += segment.text
    else if (segment.kind === "ins") added += segment.text
    else if (removed && added && index < segments.length - 1 && JOINING_TEXT.test(segment.text)) {
      removed += segment.text
      added += segment.text
    } else {
      flush()
      joined.push(segment)
    }
  })
  flush()
  return joined
}

export function diffWords(before: string, after: string): DiffSegment[] {
  const a = before.match(DIFF_TOKEN) ?? []
  const b = after.match(DIFF_TOKEN) ?? []
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
      lengths[i * width + j] = sameToken(a[i], b[j])
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
    if (i < a.length && j < b.length && sameToken(a[i], b[j])) {
      push("same", b[j])
      i++
      j++
    } else if (j >= b.length || (i < a.length && lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      push("del", a[i++])
    } else {
      push("ins", b[j++])
    }
  }
  return joinNearbyEdits(segments)
}

function snapshot(skill: PublicSkill) {
  return skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata ?? undefined
}

function changed(before: string | undefined, after: string | undefined): ValueChange | null {
  const oldValue = readable(before ?? "")
  const newValue = readable(after ?? "")
  return oldValue === newValue ? null : { before: oldValue || "—", after: newValue || "—" }
}

function tableRows(skill: PublicSkill) {
  const rows = new Map<string, (string | null)[]>()
  for (const row of snapshot(skill)?.levelTable?.rows ?? []) {
    if (row?.label)
      rows.set(
        row.label,
        (row.display_values ?? []).map((value) => (value == null ? null : readable(String(value)))),
      )
  }
  return rows
}

export function skillDifference(before: PublicSkill | undefined, after: PublicSkill): SkillDifference | null {
  if (!before) return { isNew: true, description: null, rows: new Map(), cooldown: null, energyCost: null }

  const oldText = stripSkillMarkup(before.description ?? "")
  const newText = stripSkillMarkup(after.description ?? "")
  const description = readable(oldText) === readable(newText) ? null : diffWords(oldText, newText)

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
