import { localeText } from "@aov/ui/lib/locale-text"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../../components/wiki-icon"
import { WikiVersionPicker } from "../../../components/wiki-version-picker"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import {
  HERO_CHANGE,
  HERO_DIFFICULTIES,
  HERO_POSITIONS,
  HERO_ROLES,
  localizedHeroOptions,
  type HeroFilterOption,
} from "../../../lib/hero-classifications"
import { heroFormPath } from "../../../lib/hero-forms"
import { useMediaQuery } from "../../../lib/use-media-query"
import { HeroGlyph } from "../../../components/hero-glyph"
import { HeroFilterChips } from "../components/hero-filter-chips"
import { HeroGridSkeleton } from "../components/hero-loading"
import { HeroLetterRail } from "../components/hero-letter-rail"
import { HeroLibraryGrid } from "../components/hero-library-grid"
import { HeroPatchBoard, type ChangedHero } from "../components/hero-patch-board"
import { HeroSearch } from "../components/hero-search"
import { HeroShowcase } from "../components/hero-showcase"
import { HeroSortSelect } from "../components/hero-sort-select"
import { useHeroDirectory } from "./use-hero-directory"
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

const LIBRARY_ID = "wiki-hero-library"

export function HeroDirectory() {
  const scope = useWikiContext()
  const layout = usePageLayout()
  const { locale } = scope
  const t = localeText(locale)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const library = useHeroDirectory()
  const { query, changes, heroes, selected, counts, visibleHeroes, hasFilters, toggleFilter, clearFilters } = library
  // A preview on resting the pointer only helps a mouse.
  const hovers = useMediaQuery("(hover: hover) and (pointer: fine)")
  // The header and the search bar pinned under it; the mark filters hide under them as the list scrolls up.
  const [markFilters, marksCovered] = useScrolledUnder<HTMLDivElement>(112)

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
  }, [changes.subjects, heroes, locale, scope])

  const currentFilters = searchParams.toString()
  const returnPath = `/hero${currentFilters ? `?${currentFilters}` : ""}`
  const groups = [
    {
      key: "position" as const,
      label: wikiText(locale, "Vị trí", "Lane"),
      options: localizedHeroOptions(HERO_POSITIONS, locale),
      selected: selected.positions,
      counts: counts.position,
    },
    {
      key: "role" as const,
      label: wikiText(locale, "Vai trò", "Role"),
      options: localizedHeroOptions(HERO_ROLES, locale),
      selected: selected.roles,
      counts: counts.role,
    },
    ...(library.hasDifficulty
      ? [
          {
            key: "difficulty" as const,
            label: wikiText(locale, "Độ khó", "Difficulty"),
            options: localizedHeroOptions(HERO_DIFFICULTIES, locale),
            selected: selected.difficulties,
            counts: counts.difficulty,
          },
        ]
      : []),
    ...(library.hasChanges
      ? [
          {
            key: "changed" as const,
            label: wikiText(locale, "Phiên bản", "Version"),
            options: localizedHeroOptions(HERO_CHANGE, locale),
            selected: selected.changedOnly,
            counts: counts.changed,
          },
        ]
      : []),
  ]
  // The lanes and the roles also stand as marks under the search on a phone; the rest are in the sheet only.
  const markGroups = groups.slice(0, 2)
  const filtersLabel = wikiText(locale, "Bộ lọc tướng", "Hero filters")
  const picker = <WikiVersionPicker changedVariants={changes.changedVariants} appearance="pill" />
  const found = visibleHeroes.length
  const only = found === 1 ? visibleHeroes[0] : undefined
  const letters =
    layout === "compact" && library.sort === "name" && !hasFilters
      ? library.runs.map((run) => ({ key: run.key, label: run.label ?? "" }))
      : []
  const searchBox = (
    <HeroSearch
      value={library.typed}
      onChange={library.setTyped}
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
      <HeroSortSelect sorts={library.sorts} sort={library.sort} onChange={library.setSort} />
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
              count={library.filterCount}
              resetLabel={wikiText(locale, "Xóa lọc", "Clear")}
              onReset={() => clearFilters(["role", "position", "difficulty", "changed"])}
              resultLabel={wikiText(locale, `Xem ${found} tướng`, `Show ${found} ${found === 1 ? "hero" : "heroes"}`)}
            >
              {groups.map((group) => (
                <FilterSheetChoices
                  key={group.key}
                  label={group.label}
                  options={group.options}
                  selected={group.selected}
                  onToggle={(value) => toggleFilter(group.key, value, group.selected)}
                  counts={group.counts as ReadonlyMap<string, number>}
                />
              ))}
            </PublicFilterSheet>
          </section>
          <div ref={markFilters} className="wiki-hero-mark-filters">
            {markGroups.map((group) => (
              <HeroFilterChips
                key={group.key}
                layout="icons"
                label={group.label}
                options={group.options}
                selected={group.selected}
                onToggle={(value) => toggleFilter(group.key, value, group.selected)}
                counts={group.counts as ReadonlyMap<string, number>}
              />
            ))}
          </div>
        </>
      ) : null}

      <section id={LIBRARY_ID} className="wiki-hero-library" aria-labelledby="wiki-hero-list-title">
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
              {groups.map((group) => (
                <HeroFilterChips
                  key={group.key}
                  label={group.label}
                  options={group.options}
                  selected={group.selected}
                  onToggle={(value) => toggleFilter(group.key, value, group.selected)}
                  counts={group.counts as ReadonlyMap<string, number>}
                />
              ))}
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
                runs={library.runs}
                total={heroes.length}
                matched={visibleHeroes}
                filtering={hasFilters}
                search={library.search}
                from={returnPath}
                standings={library.standings}
                preview={layout !== "compact" && hovers}
              />
            ) : (
              <HeroGridSkeleton />
            )}
          </>
        )}
      </section>
      {letters.length > 1 && <HeroLetterRail letters={letters} gridId={LIBRARY_ID} />}
    </div>
  )
}
