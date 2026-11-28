import type { PublicationOverview, Variant } from "../../api/publication-overview"
import { dateLabel } from "@/lib/schedule-date"
import type { CatalogFilter } from "@/lib/catalog-scope"

export interface TimelineCount {
  changes: number
  baseline: number
}

export interface TimelineProps {
  data: PublicationOverview
  value: CatalogFilter
  onChange: (value: CatalogFilter) => void
  counts?: Map<string, TimelineCount>
  loading?: boolean
  showCounts?: boolean
  allLabel?: string
  currentFilter?: CatalogFilter
}

export interface SeasonGroup {
  id: string
  name: string
  current: boolean
  variants: Variant[]
}

export const UNSCOPED_NAME = "Chưa gắn mùa"

/** Seasons oldest first, each with its patches in ruleset order; patches without a season lead as their own group. */
export function seasonGroups(props: TimelineProps, hideEmpty: boolean): SeasonGroup[] {
  const { data } = props
  const seasons = [...data.seasons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
  const groups: SeasonGroup[] = seasons.map((season) => ({
    id: season.id,
    name: season.displayName,
    current: data.markets.some((m) => m.currentSeasonId === season.id),
    variants: [],
  }))
  const unscoped: SeasonGroup = { id: "", name: UNSCOPED_NAME, current: false, variants: [] }
  for (const variant of data.variants) {
    if (
      hideEmpty &&
      variant.id !== props.value.variantId &&
      variant.id !== props.currentFilter?.variantId &&
      props.counts?.get(variant.id)?.changes === 0
    )
      continue
    const group = groups.find((group) => group.id === variant.seasonId) ?? unscoped
    group.variants.push(variant)
  }
  for (const group of [...groups, unscoped])
    group.variants.sort((a, b) => a.rulesetId.localeCompare(b.rulesetId) || a.rulesetOrdinal - b.rulesetOrdinal)
  return unscoped.variants.length ? [unscoped, ...groups] : groups
}

/**
 * The group the track opens: the season of the chosen patch, or the chosen season. With nothing chosen every group
 * stays open, as a page that has not picked a moment yet shows the whole history.
 */
export function openGroupId({ data, value }: TimelineProps, groups: SeasonGroup[]): string | null {
  if (value.variantId) {
    const group = groups.find((group) => group.variants.some((variant) => variant.id === value.variantId))
    if (group) return group.id
    const variant = data.variants.find((variant) => variant.id === value.variantId)
    if (variant) return groups.some((group) => group.id === variant.seasonId) ? variant.seasonId! : ""
  }
  if (value.seasonId && groups.some((group) => group.id === value.seasonId)) return value.seasonId
  return null
}

/** A chosen patch that has no changes stays on the track, marked, so the reader sees where they are. */
export function pinnedSelection({ value, counts, currentFilter, allLabel }: TimelineProps, id: string) {
  return !!allLabel && id === value.variantId && id !== currentFilter?.variantId && counts?.get(id)?.changes === 0
}

export function isCurrent(data: PublicationOverview, variant: Variant) {
  return data.releases.some((r) => r.variantId === variant.id && data.markets.some((m) => m.currentReleaseId === r.id))
}

/** The patch the markets play now, or the one the page treats as current. */
export function currentVariantId(props: TimelineProps) {
  return props.currentFilter?.variantId || props.data.variants.find((variant) => isCurrent(props.data, variant))?.id
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * What a patch chip shows. Patches named by their date read as day/month inside a season, which already names the
 * year; other codes stay as written.
 */
export function patchLabel(code: string) {
  const day = ISO_DAY.exec(code)
  return day ? `${day[3]}/${day[2]}` : code
}

/** The year a patch named by its date falls in, used to mark year changes along a long group. */
export function patchYear(code: string) {
  return ISO_DAY.exec(code)?.[1] ?? null
}

export function countText({ counts, loading = false, showCounts = true }: TimelineProps, variant: Variant) {
  if (!showCounts) return ""
  if (loading) return "Đang tải…"
  const count = counts?.get(variant.id)
  if (!count) return "Chưa tải thống kê"
  const parts = [count.changes > 0 ? `${count.changes} mục thay đổi` : "Chưa ghi nhận thay đổi"]
  if (count.baseline > 0) parts.push(`${count.baseline} mục nhập dữ liệu`)
  return parts.join(" · ")
}

export function releaseText(data: PublicationOverview, variant: Variant) {
  const dates = data.releases
    .filter((r) => r.variantId === variant.id && r.status !== "CANCELLED")
    .map((r) => r.effectiveOn ?? r.effectiveAt)
    .filter((date): date is string => !!date)
    .sort()
  if (!dates.length) return "Chưa có lịch thị trường"
  return `Áp dụng ${dateLabel(dates[0], "vi-VN")}${new Set(dates).size > 1 ? " · theo thị trường" : ""}`
}
