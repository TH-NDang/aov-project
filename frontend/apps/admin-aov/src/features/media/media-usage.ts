/** Where an image is used, as reported by the Wiki service (03 section 35). */
export type MediaUsageState = "SHOWN" | "DRAFT_ONLY" | "HISTORY_ONLY" | "STORED_ONLY" | "NONE"
export type MediaUsageScope = "CURRENT" | "DRAFT" | "HISTORICAL"

export interface MediaUsageSummary {
  state: MediaUsageState
  current: number
  draft: number
  historical: number
  stored: number
  /** Competition and community records naming the image; null when that could not be checked. */
  competition: number | null
}

export interface MediaUsageTotals {
  states: Record<MediaUsageState, number>
  competitionChecked: boolean
}

export interface MediaUsageItem {
  ownerDomain: string
  ownerType: string
  ownerId: string
  revisionId: string | null
  propertyRole: string
  scope: MediaUsageScope
  shown: boolean
  ownerName: string | null
  partName: string | null
}

export interface MediaUsageReport {
  counts: { current: number; draft: number; historical: number }
  items: MediaUsageItem[]
}

export const usageStates: MediaUsageState[] = ["SHOWN", "DRAFT_ONLY", "HISTORY_ONLY", "STORED_ONLY", "NONE"]

export const usageStateLabels: Record<MediaUsageState, string> = {
  SHOWN: "Đang hiển thị",
  DRAFT_ONLY: "Chỉ ở bản nháp",
  HISTORY_ONLY: "Chỉ ở bản cũ",
  STORED_ONLY: "Chỉ còn lưu mã",
  NONE: "Không còn nơi nào",
}

export const usageStateHints: Record<MediaUsageState, string> = {
  SHOWN: "Có nơi đang hiện ảnh này cho người đọc.",
  DRAFT_ONLY: "Chỉ bản nháp dùng ảnh này; ảnh hiện ra khi bản nháp được xuất bản.",
  HISTORY_ONLY: "Chỉ các bản đã xuất bản trước đây dùng ảnh này; người đọc chỉ thấy khi xem lịch sử.",
  STORED_ONLY:
    "Người đọc không thấy ảnh này ở đâu, chỉ còn lưu mã ảnh: ảnh bổ sung chưa được chọn, head trang phục đã có chân dung thay thế, thư viện ảnh kỹ năng (chỉ hiện trong Admin) hoặc phiên nhập đang chờ. Phải bỏ các tham chiếu này trước khi xóa được ảnh.",
  NONE: "Không còn tham chiếu nào, có thể xóa ảnh.",
}

/** A short line for a list row. */
export function usageSummaryLabel(summary: MediaUsageSummary) {
  const shown = summary.current + (summary.competition ?? 0)
  if (summary.state === "SHOWN") return `${shown} nơi`
  if (summary.state === "DRAFT_ONLY") return `${summary.draft} nơi trong bản nháp`
  if (summary.state === "HISTORY_ONLY") return `${summary.historical} nơi ở bản cũ`
  if (summary.state === "STORED_ONLY") return `Chỉ còn lưu mã ở ${summary.stored} nơi`
  return usageStateLabels.NONE
}

/** What else the row's count leaves out, such as places found only in drafts. */
export function usageSummaryExtra(summary: MediaUsageSummary) {
  const extras: string[] = []
  if (summary.state === "SHOWN" && summary.draft) extras.push(`${summary.draft} bản nháp`)
  if ((summary.state === "SHOWN" || summary.state === "DRAFT_ONLY") && summary.historical)
    extras.push(`${summary.historical} bản cũ`)
  if (summary.state !== "STORED_ONLY" && summary.stored) extras.push(`${summary.stored} chỉ lưu mã`)
  return extras.length ? `+ ${extras.join(", ")}` : null
}

const usageOwners: Record<string, string> = {
  HERO: "Tướng",
  HERO_IMPORT: "Phiên nhập tướng",
  HERO_SKILL_IMAGE: "Thư viện ảnh kỹ năng",
  HERO_UPLOAD_SESSION: "Phiên tải ảnh tướng",
  SKIN_BADGE: "Nhãn bậc trang phục",
  ITEM: "Trang bị",
  ITEM_METADATA: "Nhóm trang bị",
  ENCHANTMENT: "Phù hiệu",
  ENCHANTMENT_METADATA: "Hệ phù hiệu",
  ARCANA: "Ngọc",
  SPELL: "Phụ trợ",
  USER_PROFILE: "Hồ sơ người dùng",
}

const roleLabels: Record<string, string> = {
  HEAD: "Head",
  PORTRAIT: "Chân dung",
  SPLASH: "Ảnh nền",
  SKIN_ART: "Ảnh nền",
  SKIN_PORTRAIT: "Chân dung",
  SKIN_HEAD: "Head",
  ICON: "Icon",
  BACKGROUND: "Ảnh nền",
  AVATAR: "Ảnh đại diện",
}

const catalogPages: Record<string, string> = {
  ITEM: "/items",
  ENCHANTMENT: "/enchantments",
  ARCANA: "/arcana",
  SPELL: "/spells",
}
const sharedPages: Record<string, string> = {
  ITEM_METADATA: "/items",
  ENCHANTMENT_METADATA: "/enchantments",
  SKIN_BADGE: "/hero/media?tab=badges",
}

const scopeRank: Record<MediaUsageScope, number> = { CURRENT: 0, DRAFT: 1, HISTORICAL: 2 }

export interface UsagePlace {
  key: string
  title: string
  detail: string
  /** Why this place counts as it does, when the label alone would not say. */
  note: string | null
  href: string | null
  shown: boolean
  /** The strongest state of this place across its revisions. */
  state: Exclude<MediaUsageState, "NONE">
  draft: number
  historical: number
}

function describe(item: MediaUsageItem) {
  const colon = item.propertyRole.indexOf(":")
  const kind = colon < 0 ? item.propertyRole : item.propertyRole.slice(0, colon)
  const key = colon < 0 ? null : item.propertyRole.slice(colon + 1)
  const owner = usageOwners[item.ownerType] ?? item.ownerType
  const heroPath = `/hero/${item.ownerId}?${item.revisionId ? `revision=${item.revisionId}&` : ""}`
  if (item.ownerType === "HERO") {
    if (kind === "SKILL_ICON")
      return {
        title: `${item.ownerName ?? "Tướng"} · ${item.partName ?? key}`,
        detail: "Kỹ năng · Icon",
        href: `${heroPath}tab=skills&skill=${encodeURIComponent(key ?? "")}`,
      }
    if (kind.startsWith("SKIN_"))
      return {
        title: `${item.ownerName ?? "Tướng"} · ${item.partName ?? key}`,
        detail: `Trang phục · ${roleLabels[kind] ?? kind}`,
        href: `${heroPath}tab=skins&skin=${encodeURIComponent(key ?? "")}`,
      }
    return {
      title: item.ownerName ?? "Tướng",
      detail: `Ảnh tướng · ${roleLabels[kind] ?? kind}`,
      href: `${heroPath}tab=media`,
    }
  }
  if (item.ownerType === "USER_PROFILE")
    return { title: owner, detail: roleLabels[kind] ?? kind, href: `/users/${item.ownerId}` }
  if (item.ownerType === "HERO_SKILL_IMAGE")
    return {
      title: owner,
      detail: `Ô ${key?.split(":").join(", bản ") ?? ""}`,
      href: `/hero/${item.ownerId}?tab=skills`,
    }
  if (item.ownerType === "HERO_UPLOAD_SESSION" || item.ownerType === "HERO_IMPORT")
    return {
      title: owner,
      detail: item.propertyRole === "Pending import" ? "Đang chờ nhập" : item.propertyRole,
      href: null,
    }
  return {
    title: item.ownerName ? `${owner} · ${item.ownerName}` : owner,
    detail: kind === "BADGE_ICON" ? `Icon · ${key}` : (roleLabels[kind] ?? kind),
    href: catalogPages[item.ownerType]
      ? `${catalogPages[item.ownerType]}?item=${item.ownerId}`
      : (sharedPages[item.ownerType] ?? null),
  }
}

function storedNote(item: MediaUsageItem) {
  if (item.propertyRole.startsWith("SKIN_HEAD:"))
    return "Head trang phục đã bỏ khỏi Admin. Wiki chỉ dùng ảnh này khi trang phục thiếu chân dung, nên ở đây chỉ còn lưu mã."
  if (item.ownerType === "HERO_SKILL_IMAGE")
    return "Chỉ hiện trong Admin khi kỹ năng chưa gắn icon riêng; người đọc không thấy ảnh này."
  if (item.ownerType === "HERO_UPLOAD_SESSION" || item.ownerType === "HERO_IMPORT")
    return "Chưa nhập xong nên chưa hiện ở đâu."
  return "Ảnh bổ sung chưa được chọn làm ảnh chính nên không hiện ra."
}

/** One row per place, however many revisions repeat it, with the strongest use first. */
export function usagePlaces(items: readonly MediaUsageItem[]): UsagePlace[] {
  const groups = new Map<string, MediaUsageItem[]>()
  for (const item of items) {
    const key = `${item.ownerType}:${item.ownerId}:${item.propertyRole}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()]
    .map(([key, group]): UsagePlace => {
      const shownItems = group.filter((item) => item.shown)
      const strongest = [...(shownItems.length ? shownItems : group)].sort(
        (left, right) => scopeRank[left.scope] - scopeRank[right.scope],
      )[0]!
      const fallback = strongest.propertyRole.startsWith("SKIN_HEAD:") && strongest.shown
      const state: UsagePlace["state"] = !shownItems.length
        ? "STORED_ONLY"
        : strongest.scope === "CURRENT"
          ? "SHOWN"
          : strongest.scope === "DRAFT"
            ? "DRAFT_ONLY"
            : "HISTORY_ONLY"
      return {
        key,
        ...describe(strongest),
        note: fallback
          ? "Wiki đang dùng ảnh này vì trang phục chưa có chân dung."
          : shownItems.length
            ? null
            : storedNote(strongest),
        shown: !!shownItems.length,
        state,
        draft: state === "DRAFT_ONLY" ? 0 : shownItems.filter((item) => item.scope === "DRAFT").length,
        historical: state === "HISTORY_ONLY" ? 0 : shownItems.filter((item) => item.scope === "HISTORICAL").length,
      }
    })
    .sort((left, right) => usageStates.indexOf(left.state) - usageStates.indexOf(right.state))
}

/** The verdict shown on an image's own sheet, from its places plus records elsewhere. */
export function usageStateOf(places: readonly UsagePlace[], competition: number): MediaUsageState {
  if (competition > 0) return "SHOWN"
  return usageStates.find((state) => places.some((place) => place.state === state)) ?? ("NONE" as const)
}
