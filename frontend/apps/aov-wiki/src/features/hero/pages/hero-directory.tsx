import { localeText } from "@aov/ui/lib/locale-text"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { PatchChangesRow, type ChangedSubject } from "../../../components/patch-changes-row"
import { WikiIcon } from "../../../components/wiki-icon"
import { WikiVersionPicker } from "../../../components/wiki-version-picker"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { CatalogHeading } from "../../../layout/catalog-heading"
import { usePublishedChanges } from "../../../lib/wiki-patch-changes"
import { heroCatalogQuery } from "../../../lib/hero-api"
import { HeroCard } from "../components/hero-card"
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
import "./hero-directory.css"

/** A filter group inside the bottom sheet: large targets in two columns, each with its mark and name. */
function FilterSheetChoices<Value extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: readonly HeroFilterOption<Value>[]
  selected: readonly Value[]
  onToggle: (value: Value) => void
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
            onClick={() => onToggle(option.value)}
          >
            <HeroGlyph name={option.glyph} />
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function HeroDirectory() {
  const scope = useWikiContext()
  const layout = usePageLayout()
  const query = useQuery(heroCatalogQuery(scope))
  const changes = usePublishedChanges("HERO")
  const { locale } = scope
  const t = localeText(locale)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = (searchParams.get("q") || "").slice(0, 120)
  const roles = selectedHeroFilters(searchParams.get("role"), HERO_ROLES)
  const positions = selectedHeroFilters(searchParams.get("position"), HERO_POSITIONS)
  const hasFilters = ["q", "role", "position"].some((key) => searchParams.has(key))
  const needle = normalizedHeroSearch(search)
  const heroes = query.data?.items ?? []
  const visibleHeroes = heroes.filter((hero) => {
    const matchesSearch = !needle || normalizedHeroSearch(heroSearchTexts(hero).join(" ")).includes(needle)
    const matchesRole = !roles.length || roles.some((role) => hero.roles.includes(role))
    const matchesPosition = !positions.length || positions.some((position) => hero.positions?.includes(position))
    return matchesSearch && matchesRole && matchesPosition
  })
  const publishedHeroes = new Map(heroes.map((hero) => [hero.id, hero]))
  // Changes are recorded per form, so a form's change opens that form on its hero's page (ADR-024).
  const publishedForms = new Map(
    heroes.flatMap((hero) => (hero.forms ?? []).map((form) => [form.id, { hero, form }] as const)),
  )
  const visibleIds = new Set(visibleHeroes.map((hero) => hero.id))
  const changed: ChangedSubject[] = []
  for (const { id, name, kind } of changes.subjects.values()) {
    const owner = publishedForms.get(id)
    const hero = publishedHeroes.get(id) ?? owner?.hero
    if (hero && visibleIds.has(hero.id)) {
      const shown = owner?.form ?? hero
      changed.push({
        id,
        name: shown.name,
        kind,
        image: shown.head?.currentVersion?.url ?? shown.portrait?.currentVersion?.url,
        href: scope.href(owner ? heroFormPath(hero.code, owner.form.formKey, hero.forms) : `/hero/${hero.code}`),
      })
    } else if (!hero && name && !roles.length && !positions.length && normalizedHeroSearch(name).includes(needle)) {
      // Official notes can precede the first published profile for a hero.
      changed.push({ id, kind, name: name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) })
    }
  }

  function updateSearch(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set("q", value)
    else next.delete("q")
    setSearchParams(next, { replace: true })
  }

  function toggleFilter<Value extends string>(key: "role" | "position", value: Value, selected: readonly Value[]) {
    const values = selected.includes(value) ? selected.filter((current) => current !== value) : [...selected, value]
    const next = new URLSearchParams(searchParams)
    if (values.length) next.set(key, values.sort().join(","))
    else next.delete(key)
    setSearchParams(next)
  }

  function clearFilters(keys = ["q", "role", "position"]) {
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
  const picker = <WikiVersionPicker changedVariants={changes.changedVariants} />
  const searchBox = (
    <label className="wiki-hero-search">
      <WikiIcon name="search" size={18} />
      <span className="sr-only">{t("Tìm tướng", "Search heroes")}</span>
      <input
        type="search"
        value={search}
        onChange={(event) => updateSearch(event.target.value)}
        maxLength={120}
        placeholder={wikiText(locale, "Tìm tên tướng…", "Search hero names…")}
      />
    </label>
  )
  const found = visibleHeroes.length

  return (
    <div className="wiki-hero-directory">
      <CatalogHeading title={wikiText(locale, "Thư viện Tướng", "Hero library")} action={picker} />
      {layout === "compact" ? (
        <>
          <section className="wiki-hero-toolbar-compact" aria-label={filtersLabel}>
            {searchBox}
            <PublicFilterSheet
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
              />
              <FilterSheetChoices
                label={roleLabel}
                options={roleOptions}
                selected={roles}
                onToggle={(value) => toggleFilter("role", value, roles)}
              />
            </PublicFilterSheet>
          </section>
          {/* Under the search, as on every list: the version is read once, the search is used all the time. */}
          <div className="wiki-hero-version">{picker}</div>
        </>
      ) : (
        <section className="wiki-hero-controls" aria-label={filtersLabel}>
          {searchBox}
          <div className="wiki-hero-filter-groups">
            <HeroFilterChips
              label={laneLabel}
              options={laneOptions}
              selected={positions}
              onToggle={(value) => toggleFilter("position", value, positions)}
            />
            <HeroFilterChips
              label={roleLabel}
              options={roleOptions}
              selected={roles}
              onToggle={(value) => toggleFilter("role", value, roles)}
            />
          </div>
        </section>
      )}

      {/* The changed heroes wait for the list, which gives them their pictures and their pages. */}
      <PatchChangesRow
        entries={query.isPending ? [] : changed}
        pending={changes.pending || query.isPending}
        failed={changes.failed}
        retry={changes.retry}
      />
      {query.isError && !query.data ? (
        <div className="wiki-hero-list-state" role="status">
          <h2>{wikiText(locale, "Chưa thể tải thư viện Tướng", "Could not load the hero library")}</h2>
          <p>{wikiText(locale, "Vui lòng kiểm tra kết nối và thử lại.", "Check your connection and try again.")}</p>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {t("Thử lại", "Retry")}
          </button>
        </div>
      ) : query.data && !found ? (
        <div className="wiki-hero-list-state" role="status">
          <h2>
            {hasFilters
              ? wikiText(locale, "Không tìm thấy tướng phù hợp", "No matching heroes")
              : wikiText(locale, "Thư viện đang được bổ sung", "More heroes are on the way")}
          </h2>
          <p>
            {hasFilters
              ? wikiText(locale, "Thử tên khác hoặc bỏ bớt điều kiện lọc.", "Try another name or remove a filter.")
              : wikiText(locale, "Các tướng được công bố sẽ xuất hiện tại đây.", "Published heroes will appear here.")}
          </p>
          {hasFilters && (
            <button type="button" onClick={() => clearFilters()}>
              {wikiText(locale, "Xóa bộ lọc", "Clear filters")}
            </button>
          )}
        </div>
      ) : (
        <section aria-labelledby="wiki-hero-list-title">
          <header className="wiki-hero-list-heading">
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
          </header>
          {query.data ? (
            <div className="wiki-hero-grid">
              {visibleHeroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} from={returnPath} credit />
              ))}
            </div>
          ) : (
            <HeroGridSkeleton />
          )}
        </section>
      )}
    </div>
  )
}
