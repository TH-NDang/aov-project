import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { heroCatalogQuery, type HeroListItem } from "./hero-api"
import {
  HERO_POSITIONS,
  HERO_ROLES,
  normalizedHeroSearch,
  referencePositions,
  selectedHeroFilters,
  type HeroFilterOption,
} from "./hero-classifications"
import { HeroGlyph } from "./hero-glyph"
import { HeroGridSkeleton } from "./hero-loading"
import { WikiImage } from "../../components/wiki-image"
import "./hero-directory.css"

function FilterChoices<Value extends string>({
  label,
  options,
  selected,
  onToggle,
  reference = false,
}: {
  label: string
  options: readonly HeroFilterOption<Value>[]
  selected: readonly Value[]
  onToggle: (value: Value) => void
  reference?: boolean
}) {
  return (
    <div className="wiki-hero-filter-row">
      <div className="wiki-hero-filter-label">
        <span>{label}</span>
        {reference && (
          <Tooltip>
            <TooltipTrigger className="wiki-hero-reference-note" type="button" aria-label="Thông tin phân loại vị trí">
              Tham khảo<span aria-hidden="true">ⓘ</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Phân loại minh họa, chờ biên tập.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div
        className="wiki-hero-filter-choices"
        role="group"
        aria-label={`Lọc theo ${label.toLocaleLowerCase("vi-VN")}`}
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

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </svg>
  )
}

function HeroCard({ hero, from }: { hero: HeroListItem; from: string }) {
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const portraitUrl = hero.portrait?.currentVersion?.url
  const imageUrl = [portraitUrl, hero.head?.currentVersion?.url].find((url) => url && !failedUrls.includes(url))
  const roles = HERO_ROLES.filter((role) => hero.roles.includes(role.value))

  return (
    <Link
      className="wiki-hero-card"
      data-role={hero.roles[0]}
      to={`/hero/${hero.code}`}
      state={{ from }}
      aria-label={`${hero.name}${roles.length ? ` — ${roles.map((role) => role.label).join(", ")}` : ""}`}
    >
      <div className="wiki-hero-card-portrait" data-image-kind={imageUrl === portraitUrl ? "portrait" : "head"}>
        {imageUrl ? (
          <WikiImage
            src={imageUrl}
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
        <span className="wiki-hero-card-name">{hero.name}</span>
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
        <span className="wiki-hero-card-divider" aria-hidden="true">
          <i />◇<i />
        </span>
        {roles[0] && <HeroGlyph name={roles[0].glyph} className="wiki-hero-card-watermark" />}
      </div>
    </Link>
  )
}

export function HeroDirectory() {
  const query = useQuery(heroCatalogQuery)
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

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    for (const key of ["q", "role", "position"]) next.delete(key)
    setSearchParams(next)
  }

  const currentFilters = searchParams.toString()
  const returnPath = `/hero${currentFilters ? `?${currentFilters}` : ""}`

  return (
    <div className="wiki-hero-directory">
      <nav className="wiki-hero-breadcrumb" aria-label="Đường dẫn">
        <Link to="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <span>Thư viện Tướng</span>
      </nav>
      <h1 className="wiki-hero-directory-title">Thư viện Tướng</h1>
      <section className="wiki-hero-filters" aria-label="Bộ lọc tướng">
        <TooltipProvider delayDuration={180}>
          <FilterChoices
            label="Vị trí"
            options={HERO_POSITIONS}
            selected={positions}
            reference
            onToggle={(value) => toggleFilter("position", value, positions)}
          />
          <FilterChoices
            label="Vai trò"
            options={HERO_ROLES}
            selected={roles}
            onToggle={(value) => toggleFilter("role", value, roles)}
          />
        </TooltipProvider>
        <div className="wiki-hero-filter-tools">
          <label className="wiki-hero-search">
            <SearchIcon />
            <span className="sr-only">Tìm tướng</span>
            <input
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              maxLength={120}
              placeholder="Tìm tên tướng…"
            />
          </label>
          {hasFilters && (
            <button className="wiki-hero-clear" type="button" onClick={clearFilters}>
              <span aria-hidden="true">×</span> Xóa lọc
            </button>
          )}
          {query.data && (
            <span className="wiki-hero-result-count" role="status" aria-live="polite">
              {visibleHeroes.length} tướng
            </span>
          )}
        </div>
      </section>

      {query.isPending ? (
        <HeroGridSkeleton />
      ) : query.isError && !query.data ? (
        <div className="wiki-hero-list-state" role="status">
          <h2>Chưa thể tải thư viện Tướng</h2>
          <p>Vui lòng kiểm tra kết nối và thử lại.</p>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            Thử lại
          </button>
        </div>
      ) : !visibleHeroes.length ? (
        <div className="wiki-hero-list-state" role="status">
          <h2>{hasFilters ? "Không tìm thấy tướng phù hợp" : "Thư viện đang được bổ sung"}</h2>
          <p>
            {hasFilters ? "Thử tên khác hoặc bỏ bớt điều kiện lọc." : "Các tướng được công bố sẽ xuất hiện tại đây."}
          </p>
          {hasFilters && (
            <button type="button" onClick={clearFilters}>
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="wiki-hero-grid">
          {visibleHeroes.map((hero) => (
            <HeroCard hero={hero} from={returnPath} key={hero.id} />
          ))}
        </div>
      )}
    </div>
  )
}
