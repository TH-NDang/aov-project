export interface PublishedChange {
  id?: string
  changeSetId?: string
  confirmed?: boolean
  summary?: string | null
  actualLocale?: string | null
  sourceUrl?: string | null
  /** The hero joined the game in this update (ADR-016). */
  introducesHero?: boolean
  subject?: { id: string; code: string; displayName?: string }
  patchVariantId?: string
  changeKinds?: string[]
  heroId?: string
  heroCode?: string
  spellId?: string
  code?: string
  name?: string
  overallKind?: string
  changes?: { type: string }[]
}

export function publishedNotesForSubject(rows: PublishedChange[], id: string) {
  return rows.filter(
    (row) => (row.subject?.id === id && row.confirmed === true && !!changeKind(row)) || row.spellId === id,
  )
}

export function changeKind(row: PublishedChange): string | undefined {
  if (row.subject) {
    const kinds = row.changeKinds?.filter((kind) => kind !== "DATA_BASELINE") ?? []
    return kinds.length > 1 ? "ADJUSTMENT" : kinds[0]
  }
  if (row.spellId) return "REMOVED"
  if (row.heroId) return row.overallKind || (row.changes?.length ? "UPDATED" : undefined)
}

export function changedSubjects(rows: PublishedChange[]) {
  const subjects = new Map<string, { id: string; name?: string; kind: string }>()
  for (const row of rows) {
    const id = row.subject?.id ?? row.heroId ?? row.spellId
    const kind = changeKind(row)
    if (!id || !kind) continue
    const previous = subjects.get(id)
    const name = row.subject?.displayName || row.name || previous?.name || row.code || row.heroCode
    subjects.set(id, { id, name, kind: previous && previous.kind !== kind ? "ADJUSTMENT" : kind })
  }
  return subjects
}
