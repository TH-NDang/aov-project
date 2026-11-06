import { PatchChangesRow, type ChangedSubject } from "../../components/patch-changes-row"
import { usePublishedChanges } from "../../lib/wiki-patch-changes"
import { CatalogHeading } from "../../layout/catalog-heading"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { heroCatalogQuery, type HeroListItem } from "./hero-api"
import {
  HERO_POSITIONS,
  HERO_ROLES,
  localizedHeroOptions,
  normalizedHeroSearch,
  referencePositions,
  selectedHeroFilters,
  type HeroFilterOption,
} from "./hero-classifications"
import { HeroGlyph } from "./hero-glyph"
import { HeroGridSkeleton } from "./hero-loading"
import { WikiImage } from "../../components/wiki-image"
import { WikiImageCredit as ImageCredit } from "../../components/wiki-image-credit"
import { WikiIcon } from "../../components/wiki-icon"
import "./hero-directory.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiVersionPicker } from "../../components/wiki-version-picker"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"

/** The same choices with their names written out, as a touch screen has no tooltip to explain an icon. */
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

function FilterChoices<Value extends string>({
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
  const { locale } = useWikiContext()
  return (
    <div className="wiki-hero-filter-row">
      <div className="wiki-hero-filter-label">
        <span>{label}</span>
      </div>
      <div
        className="wiki-hero-filter-choices"
        role="group"
        aria-label={wikiText(locale, `Lọc theo ${label.toLowerCase()}`, `Filter by ${label.toLowerCase()}`)}
      >
        {options.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="wiki-hero-filter-chip"
                aria-label={option.label}
                aria-pressed={selected.includes(option.value)}
                onClick={() => onToggle(option.value)}
              >
                <HeroGlyph name={option.glyph} />
                <span className="sr-only">{option.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {option.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

function HeroCard({ hero, from }: { hero: HeroListItem; from: string }) {
  const { href, locale } = useWikiContext()
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const portraitUrl = hero.portrait?.currentVersion?.url
  const imageUrl = [portraitUrl, hero.head?.currentVersion?.url].find((url) => url && !failedUrls.includes(url))
  const media = imageUrl === portraitUrl ? hero.portrait : hero.head
  const roles = localizedHeroOptions(HERO_ROLES, locale).filter((role) => hero.roles.includes(role.value))

  return (
    <div className="relative">
      <Link
        className="wiki-hero-card"
        data-role={hero.roles[0]}
        to={href(`/hero/${hero.code}`)}
        state={{ from }}
        aria-label={`${hero.name}${roles.length ? ` — ${roles.map((role) => role.label).join(", ")}` : ""}`}
      >
        <div className="wiki-hero-card-portrait" data-image-kind={imageUrl === portraitUrl ? "portrait" : "head"}>
          {imageUrl ? (
            <WikiImage
              src={imageUrl}
              focus={media?.currentVersion?.focalPoint}
              alt=""
              width="140"
              height="160"
              loading="lazy"
              decoding="async"
              onError={() => setFailedUrls((current) => [...current, imageUrl])}
            />
          ) : (
            <span className="wiki-hero-card-placeholder" aria-hidden="true">
              {hero.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="wiki-hero-card-body">
          <span className="wiki-hero-card-name">
            {hero.name}
            {hero.unscopedBaseline && (
              <span className="block wiki-type-meta text-muted-foreground">
                {wikiText(locale, "Chưa rõ mốc", "Undated baseline")}
              </span>
            )}
          </span>
          {!!roles.length && (
            <span className="wiki-hero-card-roles" aria-hidden="true">
              {roles.slice(0, 2).map((role) => (
                <span key={role.value} title={role.label}>
                  <HeroGlyph name={role.glyph} />
                  <span className="wiki-hero-card-role-label">{role.label}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      </Link>
      {imageUrl && media?.currentVersion && (
        <ImageCredit
          className="top-2 right-2 bottom-auto"
          sources={media.currentVersion.sources}
          contactHref={`/contact?assetId=${media.assetId}&versionId=${media.currentVersion.versionId}`}
        />
      )}
    </div>
  )
}

export function HeroDirectory() {
  const scope = useWikiContext()
  const layout = usePageLayout()
  const query = useQuery(heroCatalogQuery(scope))
  const changes = usePublishedChanges("HERO")
  const { locale, t } = scope
  const [searchParams, setSearchParams] = useSearchParams()
  const search = (searchParams.get("q") || "").slice(0, 120)
  const roles = selectedHeroFilters(searchParams.get("role"), HERO_ROLES)
  const positions = selectedHeroFilters(searchParams.get("position"), HERO_POSITIONS)
  const hasFilters = ["q", "role", "position"].some((key) => searchParams.has(key))
  const needle = normalizedHeroSearch(search)
  const visibleHeroes = (query.data?.items || []).filter((hero) => {
    const matchesSearch = !needle || normalizedHeroSearch(`${hero.name} ${hero.code}`).includes(needle)
    const matchesRole = !roles.length || roles.some((role) => hero.roles.includes(role))
    const matchesPosition =
      !positions.length || positions.some((position) => referencePositions(hero.code).includes(position))
    return matchesSearch && matchesRole && matchesPosition
  })
  const publishedHeroes = new Map(query.data?.items.map((hero) => [hero.id, hero]))
  const visibleIds = new Set(visibleHeroes.map((hero) => hero.id))
  const changed: ChangedSubject[] = []
  for (const { id, name, kind } of changes.subjects.values()) {
    const hero = publishedHeroes.get(id)
    if (hero && visibleIds.has(id)) {
      changed.push({
        id,
        name: hero.name,
        kind,
        image: hero.head?.currentVersion?.url ?? hero.portrait?.currentVersion?.url,
        href: scope.href(`/hero/${hero.code}`),
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
  const searchBox = (
    <label className="wiki-hero-search">
      <WikiIcon name="search" size={18} />
      <span className="sr-only">{t("searchHeroes")}</span>
      <input
        type="search"
        value={search}
        onChange={(event) => updateSearch(event.target.value)}
        maxLength={120}
        placeholder={wikiText(locale, "Tìm tên tướng…", "Search hero names…")}
      />
    </label>
  )

  return (
    <div className="wiki-hero-directory">
      <CatalogHeading title={wikiText(locale, "Thư viện Tướng", "Hero library")} section={t("characters")} />
      <WikiVersionPicker changedVariants={changes.changedVariants} />
      {layout === "compact" ? (
        <section
          className="wiki-hero-toolbar-compact public-panel"
          aria-label={wikiText(locale, "Bộ lọc tướng", "Hero filters")}
        >
          {searchBox}
          <PublicFilterSheet
            title={wikiText(locale, "Lọc tướng", "Filter heroes")}
            triggerLabel={wikiText(locale, "Lọc", "Filter")}
            count={roles.length + positions.length}
            resetLabel={wikiText(locale, "Xóa lọc", "Clear")}
            onReset={() => clearFilters(["role", "position"])}
            resultLabel={wikiText(
              locale,
              `Xem ${visibleHeroes.length} tướng`,
              `Show ${visibleHeroes.length} ${visibleHeroes.length === 1 ? "hero" : "heroes"}`,
            )}
          >
            <FilterSheetChoices
              label={wikiText(locale, "Vị trí", "Lane")}
              options={localizedHeroOptions(HERO_POSITIONS, locale)}
              selected={positions}
              onToggle={(value) => toggleFilter("position", value, positions)}
            />
            <FilterSheetChoices
              label={wikiText(locale, "Vai trò", "Role")}
              options={localizedHeroOptions(HERO_ROLES, locale)}
              selected={roles}
              onToggle={(value) => toggleFilter("role", value, roles)}
            />
          </PublicFilterSheet>
        </section>
      ) : (
        <section
          className="wiki-hero-filters public-panel wiki-slip"
          aria-label={wikiText(locale, "Bộ lọc tướng", "Hero filters")}
        >
          <div className="wiki-hero-filter-tools">
            {searchBox}
            {hasFilters && (
              <button
                className="wiki-hero-clear"
                type="button"
                onClick={() => clearFilters()}
                aria-label={wikiText(locale, "Xóa bộ lọc", "Clear filters")}
                title={wikiText(locale, "Xóa bộ lọc", "Clear filters")}
              >
                <WikiIcon name="close" size={14} /> {wikiText(locale, "Xóa lọc", "Clear filters")}
              </button>
            )}
            {query.data && (
              <span className="wiki-hero-result-count" role="status" aria-live="polite">
                {visibleHeroes.length} {wikiText(locale, "tướng", visibleHeroes.length === 1 ? "hero" : "heroes")}
              </span>
            )}
          </div>
          <TooltipProvider delayDuration={180}>
            <FilterChoices
              label={wikiText(locale, "Vị trí", "Lane")}
              options={localizedHeroOptions(HERO_POSITIONS, locale)}
              selected={positions}
              onToggle={(value) => toggleFilter("position", value, positions)}
            />
            <FilterChoices
              label={wikiText(locale, "Vai trò", "Role")}
              options={localizedHeroOptions(HERO_ROLES, locale)}
              selected={roles}
              onToggle={(value) => toggleFilter("role", value, roles)}
            />
          </TooltipProvider>
        </section>
      )}

      <PatchChangesRow entries={changed} failed={changes.failed} retry={changes.retry} />
      {query.isPending ? (
        <HeroGridSkeleton />
      ) : query.isError && !query.data ? (
        <div className="wiki-hero-list-state" role="status">
          <h2>{wikiText(locale, "Chưa thể tải thư viện Tướng", "Could not load the hero library")}</h2>
          <p>{wikiText(locale, "Vui lòng kiểm tra kết nối và thử lại.", "Check your connection and try again.")}</p>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {t("retry")}
          </button>
        </div>
      ) : !visibleHeroes.length ? (
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
        <>
          <h2 className="mb-2 type-section-title">
            {wikiText(locale, "Tất cả tướng", "All heroes")}
            {layout === "compact" && <span className="wiki-hero-grid-count">{visibleHeroes.length}</span>}
          </h2>
          <div className="wiki-hero-grid">
            {visibleHeroes.map((hero) => (
              <HeroCard hero={hero} from={returnPath} key={hero.id} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
