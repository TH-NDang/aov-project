import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useRevealedCount } from "@aov/ui/hooks/use-revealed-rows"
import { WikiVersionPicker } from "../../components/wiki-version-picker"
import { useWikiContext, useWikiText, wikiText } from "../../context/wiki-context"
import { normalizedHeroSearch } from "../../lib/hero-classifications"
import { skinCatalogQuery, type SkinEntry } from "../../lib/skin-api"
import { SkinCollectionHeading } from "./skin-collection-heading"
import { useSkinColumns } from "./skin-columns"
import { groupSkins, orderTierOptions } from "../../lib/skin-groups"
import { SkinPreview } from "../../components/skin-preview"
import { SkinResults } from "./skin-results"
import { SkinFilterStatus, SkinToolbar } from "./skin-toolbar"
import { useSkinFilters } from "./use-skin-filters"
import "./skin-directory.css"

/** How many heroes join the page each time the reader nears its end. */
const GROUP_STEP = 8

export function SkinDirectory() {
  const scope = useWikiContext()
  const text = useWikiText()
  const layout = usePageLayout()
  const columns = useSkinColumns()
  const filters = useSkinFilters()
  const { search, hero, rarity, heroSort, skinSort, hasFilters } = filters
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

  const heroes = query.data?.heroes ?? []
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
      <SkinToolbar
        layout={layout}
        filters={filters}
        heroes={heroes}
        rarities={rarities}
        skinCount={skins.length}
        onFiltersCleared={focusFilters}
      />
      {layout === "compact" && (
        <SkinFilterStatus
          filters={filters}
          heroes={heroes}
          rarities={rarities}
          summary={summary}
          ready={!!query.data}
          onFiltersCleared={focusFilters}
        />
      )}

      {query.isError && !!query.data && (
        <div className="wiki-skin-refresh-error" role="status">
          {text("Chưa cập nhật được danh sách.", "The collection could not be refreshed.")}
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {wikiText(scope.locale, "Thử lại", "Retry")}
          </button>
        </div>
      )}
      <SkinResults
        state={query.isPending ? "loading" : query.isError && !query.data ? "error" : "ready"}
        groups={groups}
        skins={skins}
        mixed={mixed}
        revealed={reveal.count}
        layout={layout}
        columns={columns}
        skinSort={skinSort}
        hasFilters={hasFilters}
        expanded={expanded}
        focusNext={focusNext}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        onClearFilters={() => {
          focusFilters()
          filters.clear()
        }}
        onFold={setFolded}
        onOpen={open}
      />
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
