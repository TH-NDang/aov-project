import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { usePageLayout, type PageLayout } from "@aov/ui/hooks/use-page-layout"
import { useRevealedCount } from "@aov/ui/hooks/use-revealed-rows"
import { WikiVersionPicker } from "../../components/wiki-version-picker"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { normalizedHeroSearch } from "../hero/hero-classifications"
import { skinCatalogQuery, type SkinEntry } from "./skin-api"
import { HeroSkinGroup, SkinCard } from "./skin-cards"
import { SkinCollectionHeading } from "./skin-collection-heading"
import { useSkinColumns } from "./skin-columns"
import { FilterArt, FilterSelect, SkinSearch, type FilterKind, type FilterOption } from "./skin-filters"
import { groupSkins, orderTierOptions, type HeroSort, type SkinSort } from "./skin-groups"
import { SkinIcon } from "./skin-icon"
import { SkinGridSkeleton } from "./skin-loading"
import { SkinPreview, skinId } from "./skin-preview"
import "./skin-directory.css"

type FilterKey = "q" | "hero" | "rarity" | "heroSort" | "skinSort"

/** How many heroes join the page each time the reader nears its end. */
const GROUP_STEP = 8

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

export function SkinDirectory() {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const layout = usePageLayout()
  const columns = useSkinColumns()
  const pinned = usePinnedBar(layout)
  const [parameters, setParameters] = useSearchParams()
  const search = (parameters.get("q") || "").slice(0, 120)
  const hero = parameters.get("hero") || ""
  const rarity = parameters.get("rarity") || ""
  const heroOrder = parameters.get("heroSort")
  const heroSort: HeroSort = heroOrder === "fewest" || heroOrder === "name" ? heroOrder : "most"
  const skinSort: SkinSort = parameters.get("skinSort") === "name" ? "name" : "tier"
  const query = useQuery(skinCatalogQuery(scope))
  const [selected, setSelected] = useState<SkinEntry | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const focusNext = useRef<string | null>(null)

  const groups = useMemo(() => {
    const terms = normalizedHeroSearch(search).split(/\s+/).filter(Boolean)
    const matches = (query.data?.items ?? []).filter((skin) => {
      if ((hero && skin.heroCode !== hero) || (rarity && skin.rarityCode !== rarity)) return false
      if (!terms.length) return true
      const names = normalizedHeroSearch(`${skin.heroName} ${skin.heroCode} ${skin.name} ${skin.skinKey}`)
      return terms.every((term) => names.includes(term))
    })
    return groupSkins(matches, heroSort, skinSort, scope.locale)
  }, [query.data, search, hero, rarity, heroSort, skinSort, scope.locale])
  const rarities = useMemo(() => orderTierOptions(query.data?.rarities ?? [], scope.locale), [query.data, scope.locale])
  // A search or a tier picks a few skins from many heroes: one grid of them reads better than a row for each hero.
  const mixed = (!!search || !!rarity) && groups.length > 1
  const skins = useMemo(() => groups.flat(), [groups])
  const steps = useMemo(() => (mixed ? [skins] : groups), [mixed, skins, groups])

  // A new filter, order or version starts the list again from its first rows.
  const listKey = [
    mixed,
    search,
    hero,
    rarity,
    heroSort,
    skinSort,
    scope.region,
    scope.locale,
    scope.seasonId,
    scope.patchVariantId,
  ].join("|")
  const [viewed, setViewed] = useState({ list: listKey, count: 0 })
  const reveal = useRevealedCount(listKey, mixed ? columns * 6 : GROUP_STEP, viewed.list === listKey ? viewed.count : 0)
  const loader = reveal.loader(mixed ? skins.length : groups.length)

  // Moves the focus to what replaced the control that was just pressed.
  useLayoutEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    document.querySelector<HTMLElement>(target)?.focus({ preventScroll: true })
  })

  const activeFilters = (hero ? 1 : 0) + (rarity ? 1 : 0)
  const hasFilters = !!search || activeFilters > 0
  const count = (value: number) => value.toLocaleString(scope.locale)
  const summary = query.isPending
    ? text("Đang tải trang phục…", "Loading skins…")
    : !query.data
      ? ""
      : groups.length > 1
        ? text(
            `${count(skins.length)} trang phục của ${count(groups.length)} tướng`,
            `${count(skins.length)} skins of ${count(groups.length)} heroes`,
          )
        : `${count(skins.length)} ${text("trang phục", skins.length === 1 ? "skin" : "skins")}`

  function updateFilter(key: FilterKey, value: string) {
    const next = new URLSearchParams(parameters)
    if (value) next.set(key, value)
    else next.delete(key)
    setParameters(next, { replace: key === "q" })
  }

  function clearFilters(keys: FilterKey[] = ["q", "hero", "rarity"]) {
    const next = new URLSearchParams(parameters)
    for (const key of keys) next.delete(key)
    setParameters(next)
  }

  /**
   * A control that removes itself by being pressed hands the focus to the filters, which stay. Never to the search
   * field, where a touch screen would raise its keyboard.
   */
  function focusFilters() {
    const stop = layout === "compact" ? ".public-filter-button" : ".wiki-skin-select"
    document.querySelector<HTMLElement>(`.wiki-skin-toolbar ${stop}`)?.focus({ preventScroll: true })
  }

  function setFolded(heroId: string, folded: boolean) {
    setExpanded((current) => {
      const next = new Set(current)
      if (folded) next.delete(heroId)
      else next.add(heroId)
      return next
    })
  }

  function open(entry: SkinEntry) {
    setSelected(entry)
    setPreviewOpen(true)
  }

  /** Keeps the card of the skin on show in the page, so closing the viewer can return to it. */
  function show(entry: SkinEntry) {
    setSelected(entry)
    if (mixed) {
      const index = skins.indexOf(entry)
      if (index >= reveal.count) setViewed({ list: listKey, count: index + 1 })
    } else if (!expanded.has(entry.heroId)) {
      const group = groups.find((candidate) => candidate[0].heroId === entry.heroId)
      if (group && group.length > columns && group.indexOf(entry) >= columns - 1) setFolded(entry.heroId, false)
    }
  }

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

  const searchField = <SkinSearch value={search} onChange={(value) => updateFilter("q", value)} />
  const heroLabel = text("Tướng", "Hero")
  const tierLabel = text("Bậc", "Tier")
  const heroFilter = (named: boolean) => (
    <FilterSelect
      label={heroLabel}
      allLabel={text("Tất cả tướng", "All heroes")}
      named={named}
      kind="hero"
      value={hero}
      options={query.data?.heroes ?? []}
      onChange={(value) => updateFilter("hero", value)}
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
      onChange={(value) => updateFilter("rarity", value)}
    />
  )
  const chips: { key: FilterKey; kind: FilterKind; option?: FilterOption; value: string }[] = []
  if (hero) {
    const option = query.data?.heroes.find((entry) => entry.code === hero)
    chips.push({ key: "hero", kind: "hero", option, value: hero })
  }
  if (rarity) {
    const option = rarities.find((entry) => entry.code === rarity)
    chips.push({ key: "rarity", kind: "badge", option, value: rarity })
  }

  let content: ReactNode
  if (query.isPending) content = <SkinGridSkeleton />
  else if (query.isError && !query.data)
    content = (
      <div className="wiki-skin-state" role="status">
        <h2>{text("Chưa tải được trang phục", "Skins could not be loaded")}</h2>
        <p>{text("Vui lòng kiểm tra kết nối và thử lại.", "Check your connection and try again.")}</p>
        <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
          {scope.t("retry")}
        </button>
      </div>
    )
  else if (!groups.length)
    content = (
      <div className="wiki-skin-state" role="status">
        <h2>
          {hasFilters
            ? text("Không tìm thấy trang phục phù hợp", "No matching skins")
            : text("Chưa có trang phục tại mốc này", "No skins for this scope")}
        </h2>
        <p>
          {hasFilters
            ? text("Thử tên khác hoặc bỏ bớt điều kiện lọc.", "Try another name or fewer filters.")
            : text("Các trang phục đã công bố sẽ xuất hiện tại đây.", "Published skins will appear here.")}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              focusFilters()
              clearFilters()
            }}
          >
            {text("Xóa bộ lọc", "Clear filters")}
          </button>
        )}
      </div>
    )
  else if (mixed)
    content = (
      <section className="wiki-skin-grid" aria-label={text("Trang phục phù hợp", "Matching skins")}>
        {skins.slice(0, reveal.count).map((skin) => (
          <SkinCard key={skinId(skin)} skin={skin} showHero onOpen={open} />
        ))}
      </section>
    )
  else
    content = (
      <div className="wiki-skin-groups">
        {groups.slice(0, reveal.count).map((group) => {
          const heroId = group[0].heroId
          const rowId = CSS.escape(`skin-row-${heroId}`)
          return (
            <HeroSkinGroup
              key={`${heroId}:${skinSort}`}
              skins={group}
              layout={layout}
              columns={columns}
              whole={groups.length === 1}
              counted={groups.length > 1 || (layout === "compact" && !hasFilters)}
              expanded={expanded.has(heroId)}
              onExpand={() => {
                focusNext.current = `[data-skin-card="${CSS.escape(skinId(group[columns - 1]))}"]`
                setFolded(heroId, false)
              }}
              onCollapse={() => {
                focusNext.current = `#${rowId} > .wiki-skin-more`
                setFolded(heroId, true)
              }}
              onOpen={open}
            />
          )
        })}
      </div>
    )

  return (
    <div
      className="wiki-skin-directory"
      style={{ "--skin-columns": columns } as CSSProperties}
      aria-busy={query.isPending}
    >
      <SkinCollectionHeading
        lead={
          <span className="wiki-skin-summary" role="status" aria-live="polite">
            {summary}
          </span>
        }
        action={
          <div className="wiki-skin-version">
            <WikiVersionPicker />
          </div>
        }
      />
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
            onReset={() => clearFilters(["hero", "rarity"])}
            resultLabel={text(
              `Xem ${count(skins.length)} trang phục`,
              `Show ${count(skins.length)} ${skins.length === 1 ? "skin" : "skins"}`,
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
                      onClick={() => updateFilter("heroSort", value === "most" ? "" : value)}
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
                      onClick={() => updateFilter("skinSort", value === "tier" ? "" : value)}
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
                      onChange={() => updateFilter("heroSort", value === "most" ? "" : value)}
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
                      onChange={() => updateFilter("skinSort", value === "tier" ? "" : value)}
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
                focusFilters()
                clearFilters()
              }}
            >
              <SkinIcon name="close" size={14} />
              {text("Xóa lọc", "Clear filters")}
            </button>
          )}
        </section>
      )}
      {layout === "compact" && (
        <div className="wiki-skin-status">
          {/* What the sheet's filters are set to and how much they leave; the whole library needs no count here. */}
          {hasFilters && !!query.data && (
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
                      focusFilters()
                      updateFilter(chip.key, "")
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
          )}
          <div className="wiki-skin-version">
            <WikiVersionPicker />
          </div>
        </div>
      )}

      {query.isError && !!query.data && (
        <div className="wiki-skin-refresh-error" role="status">
          {text("Chưa cập nhật được danh sách.", "The collection could not be refreshed.")}
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {scope.t("retry")}
          </button>
        </div>
      )}
      {content}
      {!query.isPending && groups.length > 0 && (
        <InfiniteScroll query={loader} label={text("Đang tải thêm trang phục…", "Loading more skins…")} />
      )}
      <SkinPreview
        skin={selected}
        groups={steps}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onMove={show}
      />
    </div>
  )
}
