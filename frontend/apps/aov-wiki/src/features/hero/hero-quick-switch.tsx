import { useRef, useState, type MouseEvent, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { heroCatalogQuery, type HeroListItem } from "./hero-api"
import {
  HERO_POSITIONS,
  HERO_ROLES,
  normalizedHeroSearch,
  referencePositions,
  type HeroPosition,
  type HeroRole,
} from "./hero-classifications"
import { HeroGlyph, type HeroGlyphName } from "./hero-glyph"
import { useDragScroll } from "./use-drag-scroll"
import { WikiImage } from "../../components/wiki-image"
import "./hero-quick-switch.css"

function SwitchIcon({ close = false }: { close?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {close ? (
        <path d="m14 5-7 7 7 7m6-14-7 7 7 7" />
      ) : (
        <>
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="15" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <path d="M13 17h8m-3-3 3 3-3 3" />
        </>
      )}
    </svg>
  )
}

function FilterButton({
  label,
  selected,
  onSelect,
  glyph,
  side = "bottom",
}: {
  label: string
  selected: boolean
  onSelect: () => void
  glyph?: HeroGlyphName
  side?: "bottom" | "right"
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-filter-all={glyph ? undefined : "true"}
          aria-label={label}
          aria-pressed={selected}
          onClick={onSelect}
        >
          {glyph ? (
            <HeroGlyph name={glyph} />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function HeroChoice({
  hero,
  selected,
  returnTo,
  onPick,
}: {
  hero: HeroListItem
  selected: boolean
  returnTo: string
  onPick: () => void
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const image = [hero.portrait?.currentVersion?.url, hero.head?.currentVersion?.url].find(
    (url) => url && !failedUrls.includes(url),
  )
  const positions = HERO_POSITIONS.filter((option) => referencePositions(hero.code).includes(option.value))
  const roles = HERO_ROLES.filter((option) => hero.roles.includes(option.value))
  const label = [
    selected ? `Đang xem: ${hero.name}` : hero.name,
    positions.length ? `Vị trí tham khảo: ${positions.map((option) => option.label).join(", ")}` : "",
    roles.length ? `Vai trò: ${roles.map((option) => option.label).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(". ")

  function selectHero(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    if (selected) event.preventDefault()
    onPick()
  }

  return (
    <Link
      className="wiki-hero-switch-choice"
      to={`/hero/${hero.code}`}
      state={{ from: returnTo }}
      aria-label={label}
      aria-current={selected ? "page" : undefined}
      onClick={selectHero}
    >
      <span className="wiki-hero-switch-portrait">
        {image ? (
          <WikiImage
            src={image}
            alt=""
            width="140"
            height="160"
            loading="lazy"
            decoding="async"
            onError={() => setFailedUrls((current) => [...current, image])}
          />
        ) : (
          <span className="wiki-hero-switch-placeholder" aria-hidden="true">
            {hero.name.charAt(0)}
          </span>
        )}
      </span>
      <span className="wiki-hero-switch-classifications" aria-hidden="true">
        {!!positions.length && (
          <span
            className="wiki-hero-switch-icon-stack"
            title={`Vị trí tham khảo: ${positions.map((option) => option.label).join(", ")}`}
          >
            {positions.map((option) => (
              <span key={option.value}>
                <HeroGlyph name={option.glyph} />
              </span>
            ))}
          </span>
        )}
        {!!roles.length && (
          <span
            className="wiki-hero-switch-icon-stack"
            title={`Vai trò: ${roles.map((option) => option.label).join(", ")}`}
          >
            {roles.map((option) => (
              <span key={option.value}>
                <HeroGlyph name={option.glyph} />
              </span>
            ))}
          </span>
        )}
      </span>
      {selected && (
        <span className="wiki-hero-switch-selected">
          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
            <path
              d="m4 10 4 4 8-8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sr-only">Đang xem: </span>
        </span>
      )}
      <span className="wiki-hero-switch-name">{hero.name}</span>
    </Link>
  )
}

function HeroPicker({
  currentHeroId,
  returnTo,
  onPick,
  searchRef,
}: {
  currentHeroId: string
  returnTo: string
  onPick: () => void
  searchRef: RefObject<HTMLInputElement | null>
}) {
  const query = useQuery(heroCatalogQuery)
  const roleScroll = useDragScroll<HTMLDivElement>("horizontal")
  const laneScroll = useDragScroll<HTMLElement>("vertical")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<HeroRole | null>(null)
  const [position, setPosition] = useState<HeroPosition | null>(null)
  const needle = normalizedHeroSearch(search)
  const heroes = (query.data?.items || []).filter(
    (hero) =>
      (!role || hero.roles.includes(role)) &&
      (!position || referencePositions(hero.code).includes(position)) &&
      (!needle || normalizedHeroSearch(`${hero.name} ${hero.code}`).includes(needle)),
  )
  const hasFilters = !!search || !!role || !!position
  const roleLabel = HERO_ROLES.find((option) => option.value === role)?.label
  const positionLabel = HERO_POSITIONS.find((option) => option.value === position)?.label
  const filterLabel = [positionLabel, roleLabel].filter(Boolean).join(" · ")

  function resetFilters() {
    setSearch("")
    setRole(null)
    setPosition(null)
    searchRef.current?.focus()
  }

  return (
    <>
      <div className="wiki-hero-switch-controls">
        <div className="wiki-hero-switch-heading">
          <div className="wiki-hero-switch-title-row">
            <SheetTitle>Chọn tướng</SheetTitle>
            {query.isSuccess && (
              <span
                className="wiki-hero-switch-count"
                role="status"
                aria-label={`${filterLabel ? `${filterLabel}: ` : ""}${heroes.length} tướng`}
              >
                {heroes.length}
              </span>
            )}
            <SheetDescription className="sr-only">Tìm và chuyển nhanh sang một tướng đã xuất bản.</SheetDescription>
          </div>
          <SheetClose className="wiki-hero-switch-close" aria-label="Đóng danh sách tướng" title="Đóng">
            <SwitchIcon close />
          </SheetClose>
        </div>
        <div className="wiki-hero-switch-tools">
          <label className="wiki-hero-switch-search">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
            <span className="sr-only">Tìm tên hoặc mã tướng</span>
            <input
              ref={searchRef}
              type="search"
              placeholder="Tìm…"
              maxLength={120}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="wiki-hero-switch-filter-row">
            <div
              className="wiki-hero-switch-filters"
              role="group"
              aria-label="Lọc vai trò"
              ref={roleScroll.ref}
              {...roleScroll.handlers}
            >
              <FilterButton label="Tất cả vai trò" selected={!role} onSelect={() => setRole(null)} />
              {HERO_ROLES.map((option) => (
                <FilterButton
                  key={option.value}
                  label={option.label}
                  glyph={option.glyph}
                  selected={role === option.value}
                  onSelect={() => setRole((current) => (current === option.value ? null : option.value))}
                />
              ))}
            </div>
            {filterLabel && <span className="wiki-hero-switch-active-filters">{filterLabel}</span>}
          </div>
        </div>
      </div>
      <div className="wiki-hero-switch-workspace">
        <aside className="wiki-hero-switch-lanes" aria-label="Lọc vị trí" ref={laneScroll.ref} {...laneScroll.handlers}>
          <div className="wiki-hero-switch-lane-filters" role="group" aria-label="Vị trí">
            <FilterButton label="Tất cả vị trí" selected={!position} onSelect={() => setPosition(null)} side="right" />
            {HERO_POSITIONS.map((option) => (
              <FilterButton
                key={option.value}
                label={option.label}
                glyph={option.glyph}
                side="right"
                selected={position === option.value}
                onSelect={() => setPosition((current) => (current === option.value ? null : option.value))}
              />
            ))}
          </div>
        </aside>
        <div className="wiki-hero-switch-scroll">
          {query.isPending ? (
            <div className="wiki-hero-switch-grid" aria-busy="true" aria-label="Đang tải danh sách tướng">
              {Array.from({ length: 10 }, (_, index) => (
                <div className="wiki-hero-switch-skeleton" key={index}>
                  <span />
                  <i />
                </div>
              ))}
            </div>
          ) : query.isError && !query.data ? (
            <div className="wiki-hero-switch-state" role="status">
              <p>Chưa thể tải danh sách tướng.</p>
              <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
                Thử lại
              </button>
            </div>
          ) : !heroes.length ? (
            <div className="wiki-hero-switch-state" role="status">
              <p>{hasFilters ? "Không tìm thấy tướng phù hợp." : "Chưa có tướng được xuất bản."}</p>
              {hasFilters && (
                <button type="button" onClick={resetFilters}>
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="wiki-hero-switch-grid">
              {heroes.map((hero) => (
                <HeroChoice
                  key={hero.id}
                  hero={hero}
                  selected={hero.id === currentHeroId}
                  returnTo={returnTo}
                  onPick={onPick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function HeroQuickSwitch({ currentHeroId, returnTo }: { currentHeroId: string; returnTo: string }) {
  const [open, setOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="wiki-hero-switch-trigger" aria-label="Đổi tướng nhanh" title="Đổi tướng nhanh">
          <SwitchIcon />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="wiki-hero-switch-panel"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
      >
        <TooltipProvider delayDuration={180}>
          <HeroPicker
            currentHeroId={currentHeroId}
            returnTo={returnTo}
            searchRef={searchRef}
            onPick={() => setOpen(false)}
          />
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  )
}
