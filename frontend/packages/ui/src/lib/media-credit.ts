export interface MediaCredit {
  type?: string
  label: string
  /**
   * Recorded without evidence of where the image came from. It never counts as a credit, and the interface words it
   * itself instead of showing `label`, which a placeholder leaves empty. Requests never send it.
   */
  unverified?: boolean
  url?: string | null
  ownerName?: string | null
  contactUrl?: string | null
  observedAt?: string | null
  ownerPageId?: string | null
  relatedPageId?: string | null
}

export interface MediaSourceInput extends Omit<MediaCredit, "unverified"> {
  note?: string | null
}

export function needsMediaCredit(sources: MediaCredit[]) {
  return !sources.some((source) => source.label.trim() && source.ownerName?.trim() && !source.unverified)
}

export function creditHttpUrl(value: string | null | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

export function currentMediaSources<T extends MediaCredit & { versionId?: string | null }>(
  sources: T[],
  versionId: string | null | undefined,
) {
  const specific = sources.filter((source) => source.versionId && source.versionId === versionId)
  const selected = specific.length ? specific : sources.filter((source) => !source.versionId)
  const seen = new Set<string>()
  return selected.filter((source) => {
    const key = JSON.stringify([
      source.type,
      source.label,
      source.url,
      source.ownerName,
      source.contactUrl,
      source.ownerPageId,
      source.relatedPageId,
    ])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
