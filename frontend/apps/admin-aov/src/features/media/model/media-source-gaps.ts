import { needsMediaCredit, type MediaCredit } from "@aov/ui/lib/media-credit"

/**
 * What keeps an image from counting as credited. A credited image needs one verified source that names both where the
 * image came from (label) and who owns it (ownerName); see `needsMediaCredit`.
 */
export type SourceGap = "none" | "missing-source" | "unverified" | "missing-owner"

export const sourceGapLabels: Record<SourceGap, string> = {
  none: "Đủ nguồn & chủ sở hữu",
  "missing-source": "Chưa có nguồn",
  unverified: "Nguồn chưa xác minh",
  "missing-owner": "Thiếu chủ sở hữu",
}

export const sourceGapHints: Record<SourceGap, string> = {
  none: "Ảnh đã có nơi lấy và người cần ghi công.",
  "missing-source": "Chưa biết ảnh lấy từ đâu. Thêm tên nguồn và chủ sở hữu.",
  unverified: "Nguồn đang ghi là chưa xác minh. Xác minh lại rồi thêm nguồn và chủ sở hữu.",
  "missing-owner": "Đã biết ảnh lấy từ đâu nhưng chưa ghi ai là chủ sở hữu cần ghi công.",
}

/** User avatars belong to the user who uploaded them and never need a source or owner (03, needsCredit). */
export const needsNoCredit = (semanticType?: string | null) => semanticType === "USER_AVATAR"

const unverified = (source: MediaCredit) => source.label.includes("Chưa xác minh")

export function sourceGap(sources: readonly MediaCredit[]): SourceGap {
  if (!needsMediaCredit([...sources])) return "none"
  const named = sources.filter((source) => source.label.trim())
  if (!named.length) return "missing-source"
  if (named.every(unverified)) return "unverified"
  return "missing-owner"
}

/** The verified source that only lacks its owner; adding the owner makes the image credited. */
export function ownerCandidate<T extends MediaCredit>(sources: readonly T[]): T | undefined {
  return sources.find((source) => source.label.trim() && !source.ownerName?.trim() && !unverified(source))
}

/** The best source to show for an image: a complete one, else any verified one. */
export function primarySource<T extends MediaCredit>(sources: readonly T[]): T | undefined {
  return (
    sources.find((source) => source.label.trim() && source.ownerName?.trim() && !unverified(source)) ??
    sources.find((source) => source.label.trim() && !unverified(source))
  )
}

const sameOrigin = (a: MediaCredit, b: MediaCredit) =>
  (a.type ?? "") === (b.type ?? "") && a.label.trim() === b.label.trim() && (a.url ?? "") === (b.url ?? "")

/**
 * Sources can only be added, so completing an owner leaves the older ownerless copy behind. Hide a source when another
 * one for the same origin already names its owner.
 */
export function visibleSources<T extends MediaCredit>(sources: readonly T[]): T[] {
  return sources.filter(
    (source) =>
      source.ownerName?.trim() ||
      !sources.some((other) => other !== source && other.ownerName?.trim() && sameOrigin(other, source)),
  )
}

/** One line for hover hints on image thumbnails: who owns the image and where it came from. */
export function creditSummary(sources: readonly MediaCredit[]) {
  const gap = sourceGap(sources)
  const source = primarySource(visibleSources(sources))
  if (gap === "none" && source) return `© ${source.ownerName!.trim()} · Nguồn: ${source.label}`
  if (gap === "missing-owner" && source) return `Chưa ghi chủ sở hữu · Nguồn: ${source.label}`
  return sourceGapLabels[gap]
}
