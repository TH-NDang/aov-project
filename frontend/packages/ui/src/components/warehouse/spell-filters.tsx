import { Archive, LayoutGrid } from "lucide-react"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
export function SpellFilters({
  availability,
  setAvailability,
  count,
  archivedCount,
  locale = "vi-VN",
}: {
  availability: string
  setAvailability: (value: string | null) => void
  count: number
  archivedCount: number
  locale?: string
}) {
  const ui = (vi: string, en: string) => (locale.startsWith("en") ? en : vi)
  return (
    <FilterTabs label={ui("Lọc khả dụng phụ trợ", "Talent availability")}>
      <FilterTab active={!availability} count={count} onClick={() => setAvailability(null)}>
        <LayoutGrid aria-hidden />
        {ui("Tất cả", "All")}
      </FilterTab>

      <FilterTab active={availability === "REMOVED"} count={archivedCount} onClick={() => setAvailability("REMOVED")}>
        <Archive aria-hidden />
        {ui("Đã gỡ", "Retired")}
      </FilterTab>
    </FilterTabs>
  )
}
