import { sameDraftValue } from "./draft-store"

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

/** Merge untouched remote fields while flagging overlapping edits; local values win only in the preview. */
export function reconcileDraft(base: unknown, local: unknown, remote: unknown): { value: unknown; conflict: boolean } {
  if (sameDraftValue(base, local)) return { value: remote, conflict: false }
  if (sameDraftValue(base, remote) || sameDraftValue(local, remote)) return { value: local, conflict: false }
  if (object(base) && object(local) && object(remote)) {
    const value: Record<string, unknown> = {}
    let conflict = false
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const result = reconcileDraft(base[key], local[key], remote[key])
      if (result.value !== undefined || Object.hasOwn(local, key)) value[key] = result.value
      conflict ||= result.conflict
    }
    return { value, conflict }
  }
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const all = [...base, ...local, ...remote]
    const identity = ["skillKey", "skinKey", "statKey", "locale", "effectType"].find(
      (key) =>
        all.length &&
        all.every((row) => object(row) && typeof row[key] === "string" && row[key]) &&
        [base, local, remote].every((rows) => new Set(rows.map((row) => row[key])).size === rows.length),
    )
    if (identity) {
      const index = (rows: Record<string, unknown>[]) => new Map(rows.map((row) => [row[identity] as string, row]))
      const before = index(base)
      const mine = index(local)
      const theirs = index(remote)
      const localOrderChanged = !sameDraftValue([...before.keys()], [...mine.keys()])
      const order = localOrderChanged ? [...mine.keys(), ...theirs.keys()] : [...theirs.keys(), ...mine.keys()]
      const value: unknown[] = []
      let conflict = false
      for (const key of new Set(order)) {
        const result = reconcileDraft(before.get(key), mine.get(key), theirs.get(key))
        if (result.value !== undefined) value.push(result.value)
        conflict ||= result.conflict
      }
      return { value, conflict }
    }
  }
  return { value: local, conflict: true }
}
