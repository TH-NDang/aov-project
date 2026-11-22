import { localeText } from "@aov/ui/lib/locale-text"
import { useQuery } from "@tanstack/react-query"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../../components/wiki-icon"
import { WikiVersionPicker } from "../../../components/wiki-version-picker"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { usePublishedChanges } from "../../../lib/wiki-patch-changes"
import { heroCatalogQuery, type HeroListItem } from "../../../lib/hero-api"
import {
  HERO_POSITIONS,
  HERO_ROLES,
  localizedHeroOptions,
  normalizedHeroSearch,
  selectedHeroFilters,
  type HeroFilterOption,
} from "../../../lib/hero-classifications"
import { HeroFilterChips } from "../components/hero-filter-chips"
import { heroFormPath, heroSearchTexts } from "../../../lib/hero-forms"
import { HeroGlyph } from "../../../components/hero-glyph"
import { HeroGridSkeleton } from "../components/hero-loading"
import { HeroShowcase } from "../components/hero-showcase"
import { HeroSearch } from "../components/hero-search"
import { HeroLibraryGrid } from "../components/hero-library-grid"
import { heroSearchRank } from "../model/hero-search-rank"
import { HeroPatchBoard, type ChangedHero } from "../components/hero-patch-board"
import "./hero-directory.css"

/** A filter group inside the bottom sheet: large targets in two columns, each with its mark and name. */
function FilterSheetChoices<Value extends string>({
  label,
  options,
  selected,
  onToggle,
  counts,
}: {
  label: string
  options: readonly HeroFilterOption<Value>[]
  selected: readonly Value[]
  onToggle: (value: Value) => void
  counts: ReadonlyMap<Value, number>
}) {
  return (
    <fieldset className="wiki-hero-sheet-group">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="wiki-hero-sheet-choice"
            aria-pressed={selected.includes(option.value)}
            data-empty={(counts.get(option.value) === 0 && !selected.includes(option.value)) || undefined}
            onClick={() => onToggle(option.value)}
          >
            <HeroGlyph name={option.glyph} />
            {option.label}
            <span className="wiki-hero-sheet-count">{counts.get(option.value) ?? 0}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function optionCounts<Value extends string>(
  values: readonly Value[],
  heroes: readonly HeroListItem[],
  valuesOf: (hero: HeroListItem) => readonly string[],
) {
  return new Map(values.map((value) => [value, heroes.filter((hero) => valuesOf(hero).includes(value)).length]))
}

/**
 * Whether the element has scrolled up under the bars pinned at the top of the page, which are `covered` pixels tall.
 * It stays false until the element has been laid out.
 */
function useScrolledUnder<T extends Element>(covered: number) {
  const ref = useRef<T>(null)
  const [under, setUnder] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setUnder(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < covered),
      { rootMargin: `-${covered}px 0px 0px 0px` },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [covered])
  return [ref, under] as const
}

export function HeroDirectory() {
  const scope = useWikiContext()
  const layout = usePageLayout()
  const query = useQuery(heroCatalogQuery(scope))
  const changes = usePublishedChanges("HERO")
  const { locale } = scope
  const t = localeText(locale)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  // The header and the search bar pinned under it; the mark filters hide under them as the list scrolls up.
  const [markFilters, marksCovered] = useScrolledUnder<HTMLDivElement>(112)
  const searchInAddress = (searchParams.get("q") || "").slice(0, 120)
  const [typed, setTyped] = useState(searchInAddress)
  const written = useRef(searchInAddress)
  // A search that arrives from the address (the back button, a shared link) replaces what the field holds.
  useEffect(() => {
    if (searchInAddress !== written.current) {
      written.current = searchInAddress
      setTyped(searchInAddress)
    }
  }, [searchInAddress])
  const search = useDeferredValue(typed)
  const roles = selectedHeroFilters(searchParams.get("role"), HERO_ROLES)
  const positions = selectedHeroFilters(searchParams.get("position"), HERO_POSITIONS)
  // The list follows the deferred search, so a key press redraws the field first and the list when there is time.
  const hasFilters = !!search.trim() || roles.length > 0 || positions.length > 0
  const needle = normalizedHeroSearch(search)
  const heroes = query.data?.items ?? []
  // Every hero's names, folded once per list rather than on every key press. The search reads names only: the lanes
  // and the roles have filters of their own, and matching their words would bring in heroes the reader did not mean.
  const searchIndex = useMemo(
    () =>
      new Map(
        (query.data?.items ?? []).map((hero) => [
          hero.id,
          heroSearchTexts(hero).map((text) => normalizedHeroSearch(text)),
        ]),
      ),
    [query.data],
  )
  const searchRank = (hero: HeroListItem) => heroSearchRank(searchIndex.get(hero.id) ?? [], needle)
  const matchesSearch = (hero: HeroListItem) => !needle || searchRank(hero) !== undefined
  const matchesRole = (hero: HeroListItem) => !roles.length || roles.some((role) => hero.roles.includes(role))
  const matchesPosition = (hero: HeroListItem) =>
    !positions.length || positions.some((position) => hero.positions?.includes(position))
  const roleKey = searchParams.get("role") ?? ""
  const positionKey = searchParams.get("position") ?? ""
  // Kept as the same list while the search and the filters stay the same, so the grid is not drawn again for nothing.
  const visibleHeroes = useMemo(
    () => {
      const kept = heroes.filter((hero) => matchesSearch(hero) && matchesRole(hero) && matchesPosition(hero))
      // A name that starts with the search comes first, then a word that does, then a name that only holds it.
      return needle ? kept.sort((a, b) => (searchRank(a) ?? 3) - (searchRank(b) ?? 3)) : kept
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the matchers read only the list, the search and these keys
    [query.data, needle, roleKey, positionKey, searchIndex],
  )
  // What each chip would show: the heroes with that lane or role that every other filter and the search keep.
  const laneCounts = optionCounts(
    HERO_POSITIONS.map((option) => option.value),
    heroes.filter((hero) => matchesSearch(hero) && matchesRole(hero)),
    (hero) => hero.positions ?? [],
  )
  const roleCounts = optionCounts(
    HERO_ROLES.map((option) => option.value),
    heroes.filter((hero) => matchesSearch(hero) && matchesPosition(hero)),
    (hero) => hero.roles,
  )
  // The board's heroes stay the same list while the changes and the heroes do, so typing does not redraw the board.
  const changed = useMemo(() => {
    const publishedHeroes = new Map(heroes.map((hero) => [hero.id, hero]))
    // Changes are recorded per form, so a form's change opens that form on its hero's page (ADR-024).
    const publishedForms = new Map(
      heroes.flatMap((hero) => (hero.forms ?? []).map((form) => [form.id, { hero, form }] as const)),
    )
    const list: ChangedHero[] = []
    for (const { id, name, kind } of changes.subjects.values()) {
      const owner = publishedForms.get(id)
      const hero = publishedHeroes.get(id) ?? owner?.hero
      if (hero) {
        const shown = owner?.form ?? hero
        list.push({
          id,
          name: shown.name,
          kind,
          image: shown.head?.currentVersion?.url ?? shown.portrait?.currentVersion?.url,
          portrait: shown.portrait?.currentVersion?.url,
          href: scope.href(owner ? heroFormPath(hero.code, owner.form.formKey, hero.forms) : `/hero/${hero.code}`),
        })
      } else if (name) {
        // Official notes can precede the first published profile for a hero.
        list.push({ id, kind, name: name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) })
      }
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built from the changes and the list alone
  }, [changes.subjects, query.data, locale, scope.href])

  // The address follows the field once typing pauses, so a reader can share or come back to a search.
  useEffect(() => {
    if (typed === written.current) return
    const timer = window.setTimeout(() => {
      written.current = typed
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (typed) next.set("q", typed)
          else next.delete("q")
          return next
        },
        { replace: true },
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [typed, setSearchParams])

  function toggleFilter<Value extends string>(key: "role" | "position", value: Value, selected: readonly Value[]) {
    const values = selected.includes(value) ? selected.filter((current) => current !== value) : [...selected, value]
    const next = new URLSearchParams(searchParams)
    if (values.length) next.set(key, values.sort().join(","))
    else next.delete(key)
    setSearchParams(next)
  }

  function clearFilters(keys = ["q", "role", "position"]) {
    if (keys.includes("q")) {
      written.current = ""
      setTyped("")
    }
    const next = new URLSearchParams(searchParams)
    for (const key of keys) next.delete(key)
    setSearchParams(next)
  }

  const currentFilters = searchParams.toString()
  const returnPath = `/hero${currentFilters ? `?${currentFilters}` : ""}`
  const laneLabel = wikiText(locale, "Vị trí", "Lane")
  const roleLabel = wikiText(locale, "Vai trò", "Role")
  const laneOptions = localizedHeroOptions(HERO_POSITIONS, locale)
  const roleOptions = localizedHeroOptions(HERO_ROLES, locale)
  const filtersLabel = wikiText(locale, "Bộ lọc tướng", "Hero filters")
  const picker = <WikiVersionPicker changedVariants={changes.changedVariants} appearance="pill" />
  const found = visibleHeroes.length
  const only = found === 1 ? visibleHeroes[0] : undefined
  const searchBox = (
    <HeroSearch
      value={typed}
      onChange={(value) => setTyped(value.slice(0, 120))}
      size={layout === "compact" ? "large" : "regular"}
      atEnd={layout !== "compact"}
      onOpenOnly={only && (() => navigate(scope.href(`/hero/${only.code}`), { state: { from: returnPath } }))}
    />
  )
  const listHeading = (
    <>
      <h2 id="wiki-hero-list-title">
        {hasFilters ? wikiText(locale, "Kết quả", "Results") : wikiText(locale, "Tất cả tướng", "All heroes")}
      </h2>
      {query.data && (
        <small role="status">
          {hasFilters
            ? wikiText(locale, `${found}/${heroes.length} tướng`, `${found} of ${heroes.length} heroes`)
            : found}
        </small>
      )}
      {hasFilters && (
        <button type="button" className="wiki-hero-clear" onClick={() => clearFilters()}>
          <WikiIcon name="close" size={14} />
          {wikiText(locale, "Xóa bộ lọc", "Clear filters")}
        </button>
      )}
    </>
  )

  return (
    <div className="wiki-hero-directory">
      <HeroShowcase heroes={query.data?.items} version={picker} />
      {/*
       * What the version changed comes first and stays whole: it is the version's news, read before looking anything up.
       * The search and the filters follow, right above the list they narrow. The changed heroes wait for the list, which
       * gives them their pictures and their pages.
       */}
      <HeroPatchBoard
        entries={query.isPending ? [] : changed}
        pending={changes.pending || query.isPending}
        failed={changes.failed}
        retry={changes.retry}
      />
      {layout === "compact" ? (
        <>
          {/* The filters are marks under the search; once they scroll away, one button in the pinned bar opens them. */}
          <section
            className="wiki-hero-toolbar-compact"
            data-marks-covered={marksCovered || undefined}
            aria-label={filtersLabel}
          >
            {searchBox}
            <PublicFilterSheet
              iconOnly
              triggerClassName="wiki-hero-filter-trigger"
              title={wikiText(locale, "Lọc tướng", "Filter heroes")}
              triggerLabel={wikiText(locale, "Lọc", "Filter")}
              count={roles.length + positions.length}
              resetLabel={wikiText(locale, "Xóa lọc", "Clear")}
              onReset={() => clearFilters(["role", "position"])}
              resultLabel={wikiText(locale, `Xem ${found} tướng`, `Show ${found} ${found === 1 ? "hero" : "heroes"}`)}
            >
              <FilterSheetChoices
                label={laneLabel}
                options={laneOptions}
                selected={positions}
                onToggle={(value) => toggleFilter("position", value, positions)}
                counts={laneCounts}
              />
              <FilterSheetChoices
                label={roleLabel}
                options={roleOptions}
                selected={roles}
                onToggle={(value) => toggleFilter("role", value, roles)}
                counts={roleCounts}
              />
            </PublicFilterSheet>
          </section>
          <div ref={markFilters} className="wiki-hero-mark-filters">
            <HeroFilterChips
              layout="icons"
              label={laneLabel}
              options={laneOptions}
              selected={positions}
              onToggle={(value) => toggleFilter("position", value, positions)}
              counts={laneCounts}
            />
            <HeroFilterChips
              layout="icons"
              label={roleLabel}
              options={roleOptions}
              selected={roles}
              onToggle={(value) => toggleFilter("role", value, roles)}
              counts={roleCounts}
            />
          </div>
        </>
      ) : null}

      <section className="wiki-hero-library" aria-labelledby="wiki-hero-list-title">
        {layout === "compact" ? (
          <header className="wiki-hero-list-heading">{listHeading}</header>
        ) : (
          // The finder heads the list it narrows: the list's name and count beside the search, then the filters.
          <div className="wiki-hero-finder" aria-label={filtersLabel} role="group">
            <header className="wiki-hero-finder-head">
              {listHeading}
              {searchBox}
            </header>
            <div className="wiki-hero-filter-groups">
              <HeroFilterChips
                label={laneLabel}
                options={laneOptions}
                selected={positions}
                onToggle={(value) => toggleFilter("position", value, positions)}
                counts={laneCounts}
              />
              <HeroFilterChips
                label={roleLabel}
                options={roleOptions}
                selected={roles}
                onToggle={(value) => toggleFilter("role", value, roles)}
                counts={roleCounts}
              />
            </div>
          </div>
        )}
        {query.isError && !query.data ? (
          <div className="wiki-hero-list-state wiki-mascot-state" role="status">
            <h2>{wikiText(locale, "Chưa thể tải thư viện Tướng", "Could not load the hero library")}</h2>
            <p>{wikiText(locale, "Vui lòng kiểm tra kết nối và thử lại.", "Check your connection and try again.")}</p>
            <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {t("Thử lại", "Retry")}
            </button>
          </div>
        ) : query.data && !heroes.length ? (
          <div className="wiki-hero-list-state wiki-mascot-state" role="status">
            <h2>{wikiText(locale, "Thư viện đang được bổ sung", "More heroes are on the way")}</h2>
            <p>
              {wikiText(locale, "Các tướng được công bố sẽ xuất hiện tại đây.", "Published heroes will appear here.")}
            </p>
          </div>
        ) : (
          <>
            {/* Nothing matches: a line says so above the grid, which stays, every hero faded under it. */}
            {query.data && hasFilters && !found && (
              <p className="wiki-hero-no-match" role="status">
                {wikiText(
                  locale,
                  "Không có tướng khớp. Thử tên khác hoặc bỏ bớt điều kiện lọc.",
                  "No hero matches. Try another name or remove a filter.",
                )}{" "}
                <button type="button" onClick={() => clearFilters()}>
                  {wikiText(locale, "Xóa bộ lọc", "Clear filters")}
                </button>
              </p>
            )}
            {query.data ? (
              <HeroLibraryGrid
                heroes={heroes}
                matched={visibleHeroes}
                filtering={hasFilters}
                search={search}
                from={returnPath}
              />
            ) : (
              <HeroGridSkeleton />
            )}
          </>
        )}
      </section>
    </div>
  )
}
