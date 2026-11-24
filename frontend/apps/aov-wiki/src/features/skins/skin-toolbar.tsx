import { useEffect, useRef } from "react"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import type { PageLayout } from "@aov/ui/hooks/use-page-layout"
import { SkinIcon } from "../../components/skin-icon"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { FilterArt, FilterSelect, SkinSearch, type FilterKind, type FilterOption } from "./skin-filters"
import type { FilterKey, SkinFilters } from "./use-skin-filters"

/**
 * Marks a pinned bar once the page has scrolled under it, so the bar gets a backing only while it covers content.
 * The marker is an empty element placed right before the bar.
 */
function usePinnedBar(layout: PageLayout) {
  const bar = useRef<HTMLElement>(null)
  const marker = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const element = bar.current
    const start = marker.current
    if (!element || !start) return
    if (typeof IntersectionObserver === "undefined") {
      element.setAttribute("data-stuck", "")
      return
    }
    const top = parseFloat(getComputedStyle(element).top) || 0
    const observer = new IntersectionObserver(
      ([entry]) =>
        element.toggleAttribute("data-stuck", !entry.isIntersecting && entry.boundingClientRect.top <= top + 1),
      { rootMargin: `${-(top + 1)}px 0px 0px 0px` },
    )
    observer.observe(start)
    return () => observer.disconnect()
  }, [layout])
  return { bar, marker }
}

/**
 * The filters, pinned under the header: on wide screens the search, the hero and tier lists, the orders and a way to
 * clear them all; on phones the search and one sheet holding the rest.
 */
export function SkinToolbar({
  layout,
  filters,
  heroes,
  rarities,
  skinCount,
  onFiltersCleared,
}: {
  layout: PageLayout
  filters: SkinFilters
  heroes: FilterOption[]
  rarities: FilterOption[]
  /** How many skins the filters leave. */
  skinCount: number
  /** Before a control that removes itself is pressed, so the focus has somewhere to go. */
  onFiltersCleared: () => void
}) {
  const text = useWikiText()
  const { locale } = useWikiContext()
  const pinned = usePinnedBar(layout)
  const { search, hero, rarity, heroSort, skinSort, activeFilters, update, clear } = filters
  const heroSorts = [
    ["most", text("Nhiều trang phục nhất", "Most skins")],
    ["fewest", text("Ít trang phục nhất", "Fewest skins")],
    ["name", text("Tên tướng A–Z", "Hero name A–Z")],
  ] as const
  const skinSorts = [
    ["tier", text("Bậc cao nhất trước", "Highest tier first")],
    ["name", text("Tên trang phục A–Z", "Skin name A–Z")],
  ] as const
  const heroSortLabel = text("Thứ tự tướng", "Hero order")
  const skinSortLabel = text("Trang phục của mỗi tướng", "Each hero's skins")
  const sortHeroes = (value: (typeof heroSorts)[number][0]) => update("heroSort", value === "most" ? "" : value)
  const sortSkins = (value: (typeof skinSorts)[number][0]) => update("skinSort", value === "tier" ? "" : value)

  const searchField = <SkinSearch value={search} onChange={(value) => update("q", value)} />
  const heroLabel = text("Tướng", "Hero")
  const tierLabel = text("Bậc", "Tier")
  const heroFilter = (named: boolean) => (
    <FilterSelect
      label={heroLabel}
      allLabel={text("Tất cả tướng", "All heroes")}
      named={named}
      kind="hero"
      value={hero}
      options={heroes}
      onChange={(value) => update("hero", value)}
    />
  )
  const tierFilter = (named: boolean) => (
    <FilterSelect
      label={tierLabel}
      allLabel={text("Tất cả bậc", "All tiers")}
      named={named}
      kind="badge"
      value={rarity}
      options={rarities}
      onChange={(value) => update("rarity", value)}
    />
  )

  return (
    <>
      <span ref={pinned.marker} className="wiki-skin-toolbar-marker" aria-hidden="true" />
      {layout === "compact" ? (
        <section
          ref={pinned.bar}
          className="wiki-skin-toolbar wiki-skin-toolbar-compact"
          aria-label={text("Bộ lọc trang phục", "Skin filters")}
        >
          {searchField}
          <PublicFilterSheet
            title={text("Lọc và sắp xếp", "Filter and sort")}
            triggerLabel={text("Lọc", "Filter")}
            count={activeFilters}
            resetLabel={text("Xóa lọc", "Clear")}
            onReset={() => clear(["hero", "rarity"])}
            resultLabel={text(
              `Xem ${skinCount.toLocaleString(locale)} trang phục`,
              `Show ${skinCount.toLocaleString(locale)} ${skinCount === 1 ? "skin" : "skins"}`,
            )}
          >
            <div className="wiki-skin-sheet">
              <div className="wiki-skin-sheet-field">
                <span>{heroLabel}</span>
                {heroFilter(true)}
              </div>
              <div className="wiki-skin-sheet-field">
                <span>{tierLabel}</span>
                {tierFilter(true)}
              </div>
              <div className="wiki-skin-sheet-field" role="group" aria-labelledby="skin-sheet-hero-sort">
                <span id="skin-sheet-hero-sort">{heroSortLabel}</span>
                <div className="wiki-skin-sheet-choices" data-count={heroSorts.length}>
                  {heroSorts.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={heroSort === value}
                      onClick={() => sortHeroes(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="wiki-skin-sheet-field" role="group" aria-labelledby="skin-sheet-skin-sort">
                <span id="skin-sheet-skin-sort">{skinSortLabel}</span>
                <div className="wiki-skin-sheet-choices" data-count={skinSorts.length}>
                  {skinSorts.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={skinSort === value}
                      onClick={() => sortSkins(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PublicFilterSheet>
        </section>
      ) : (
        <section ref={pinned.bar} className="wiki-skin-toolbar" aria-label={text("Bộ lọc trang phục", "Skin filters")}>
          {searchField}
          {heroFilter(false)}
          {tierFilter(false)}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="wiki-skin-sort"
                data-active={heroSort !== "most" || skinSort !== "tier" || undefined}
                aria-label={text("Sắp xếp trang phục", "Sort skins")}
              >
                <SkinIcon name="sort" size={16} />
                {text("Sắp xếp", "Sort")}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              drawerTitle={text("Sắp xếp trang phục", "Sort skins")}
              className="wiki-skin-sort-menu"
            >
              <div role="radiogroup" aria-labelledby="skin-sort-heroes">
                <p id="skin-sort-heroes">{heroSortLabel}</p>
                {heroSorts.map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="hero-sort"
                      checked={heroSort === value}
                      onChange={() => sortHeroes(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div role="radiogroup" aria-labelledby="skin-sort-skins">
                <p id="skin-sort-skins">{skinSortLabel}</p>
                {skinSorts.map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="skin-sort"
                      checked={skinSort === value}
                      onChange={() => sortSkins(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {activeFilters + (search ? 1 : 0) > 1 && (
            <button
              type="button"
              className="wiki-skin-clear"
              onClick={() => {
                onFiltersCleared()
                clear()
              }}
            >
              <SkinIcon name="close" size={14} />
              {text("Xóa lọc", "Clear filters")}
            </button>
          )}
        </section>
      )}
    </>
  )
}

/**
 * Under the compact bar, once a filter is chosen: what the sheet's filters are set to, each a chip that clears it, with
 * how much they leave. The whole library needs no count here.
 */
export function SkinFilterStatus({
  filters,
  heroes,
  rarities,
  summary,
  ready,
  onFiltersCleared,
}: {
  filters: SkinFilters
  heroes: FilterOption[]
  rarities: FilterOption[]
  summary: string
  /** The collection has loaded, so the count means something. */
  ready: boolean
  onFiltersCleared: () => void
}) {
  const text = useWikiText()
  const { hero, rarity, hasFilters, update } = filters
  const chips: { key: FilterKey; kind: FilterKind; option?: FilterOption; value: string }[] = []
  if (hero) chips.push({ key: "hero", kind: "hero", option: heroes.find((entry) => entry.code === hero), value: hero })
  if (rarity) {
    const option = rarities.find((entry) => entry.code === rarity)
    chips.push({ key: "rarity", kind: "badge", option, value: rarity })
  }
  // Nothing to say until a filter is chosen; the version is in the head of the page.
  if (!hasFilters || !ready) return null
  return (
    <div className="wiki-skin-status">
      <div className="wiki-skin-result">
        {chips.map((chip) => {
          const name = chip.option?.name ?? chip.value
          return (
            <button
              key={chip.key}
              type="button"
              className="wiki-skin-chip"
              aria-label={`${text("Bỏ lọc", "Clear the filter")}: ${name}`}
              onClick={() => {
                onFiltersCleared()
                update(chip.key, "")
              }}
            >
              <FilterArt kind={chip.kind} image={chip.option?.image} />
              <span>{name}</span>
              <SkinIcon name="close" size={14} />
            </button>
          )
        })}
        <span role="status" aria-live="polite">
          {summary}
        </span>
      </div>
    </div>
  )
}
