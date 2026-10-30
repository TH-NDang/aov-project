import { useRef, useState, type MouseEvent, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { heroCatalogQuery, type HeroListItem } from "./hero-api"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  HERO_POSITIONS,
  HERO_ROLES,
  localizedHeroOptions,
  normalizedHeroSearch,
  referencePositions,
  type HeroPosition,
  type HeroRole,
} from "./hero-classifications"
import { HeroGlyph, type HeroGlyphName } from "./hero-glyph"
import { useDragScroll } from "./use-drag-scroll"
import { WikiImage } from "../../components/wiki-image"
import { WikiIcon } from "../../components/wiki-icon"
import "./hero-quick-switch.css"

function SwitchIcon({ close = false }: { close?: boolean }) {
  return <WikiIcon name={close ? "close" : "switch"} />
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
          {glyph ? <HeroGlyph name={glyph} /> : <WikiIcon name="all" size={18} />}
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
  const { locale, href } = useWikiContext()
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const image = [hero.portrait?.currentVersion?.url, hero.head?.currentVersion?.url].find(
    (url) => url && !failedUrls.includes(url),
  )
  const positions = localizedHeroOptions(HERO_POSITIONS, locale).filter((option) =>
    referencePositions(hero.code).includes(option.value),
  )
  const roles = localizedHeroOptions(HERO_ROLES, locale).filter((option) => hero.roles.includes(option.value))
  const positionLabel = `${wikiText(locale, "Vị trí", "Lane")}: ${positions.map((option) => option.label).join(", ")}`
  const roleLabel = `${wikiText(locale, "Vai trò", "Role")}: ${roles.map((option) => option.label).join(", ")}`
  const label = [
    selected ? wikiText(locale, `Đang xem: ${hero.name}`, `Currently viewing: ${hero.name}`) : hero.name,
    positions.length ? positionLabel : "",
    roles.length ? roleLabel : "",
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
      to={href(`/hero/${hero.code}`)}
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
          <span className="wiki-hero-switch-icon-stack" title={positionLabel}>
            {positions.map((option) => (
              <span key={option.value}>
                <HeroGlyph name={option.glyph} />
              </span>
            ))}
          </span>
        )}
        {!!roles.length && (
          <span className="wiki-hero-switch-icon-stack" title={roleLabel}>
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
          <WikiIcon name="check" size={15} />
          <span className="sr-only">{wikiText(locale, "Đang xem: ", "Currently viewing: ")}</span>
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
  const scope = useWikiContext()
  const { locale, t } = scope
  const roleOptions = localizedHeroOptions(HERO_ROLES, locale)
  const positionOptions = localizedHeroOptions(HERO_POSITIONS, locale)
  const query = useQuery(heroCatalogQuery(scope))
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
  const roleLabel = roleOptions.find((option) => option.value === role)?.label
  const positionLabel = positionOptions.find((option) => option.value === position)?.label
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
            <SheetTitle>{wikiText(locale, "Chọn tướng", "Choose a hero")}</SheetTitle>
            {query.isSuccess && (
              <span
                className="wiki-hero-switch-count"
                role="status"
                aria-label={`${filterLabel ? `${filterLabel}: ` : ""}${heroes.length} ${wikiText(locale, "tướng", heroes.length === 1 ? "hero" : "heroes")}`}
              >
                {heroes.length}
              </span>
            )}
            <SheetDescription className="sr-only">
              {wikiText(
                locale,
                "Tìm và chuyển nhanh sang một tướng đã xuất bản.",
                "Find and switch to a published hero.",
              )}
            </SheetDescription>
          </div>
          <SheetClose
            className="wiki-hero-switch-close"
            aria-label={wikiText(locale, "Đóng danh sách tướng", "Close hero picker")}
            title={t("close")}
          >
            <SwitchIcon close />
          </SheetClose>
        </div>
        <div className="wiki-hero-switch-tools">
          <label className="wiki-hero-switch-search">
            <WikiIcon name="search" size={18} />
            <span className="sr-only">{wikiText(locale, "Tìm tên hoặc mã tướng", "Search hero name or code")}</span>
            <input
              ref={searchRef}
              type="search"
              placeholder={wikiText(locale, "Tìm…", "Search…")}
              maxLength={120}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="wiki-hero-switch-filter-row">
            <div
              className="wiki-hero-switch-filters"
              role="group"
              aria-label={wikiText(locale, "Lọc vai trò", "Filter roles")}
              ref={roleScroll.ref}
              {...roleScroll.handlers}
            >
              <FilterButton
                label={wikiText(locale, "Tất cả vai trò", "All roles")}
                selected={!role}
                onSelect={() => setRole(null)}
              />
              {roleOptions.map((option) => (
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
        <aside
          className="wiki-hero-switch-lanes"
          aria-label={wikiText(locale, "Lọc vị trí", "Filter lanes")}
          ref={laneScroll.ref}
          {...laneScroll.handlers}
        >
          <div className="wiki-hero-switch-lane-filters" role="group" aria-label={wikiText(locale, "Vị trí", "Lane")}>
            <FilterButton
              label={wikiText(locale, "Tất cả vị trí", "All lanes")}
              selected={!position}
              onSelect={() => setPosition(null)}
              side="right"
            />
            {positionOptions.map((option) => (
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
            <div
              className="wiki-hero-switch-grid"
              aria-busy="true"
              aria-label={wikiText(locale, "Đang tải danh sách tướng", "Loading the hero list")}
            >
              {Array.from({ length: 10 }, (_, index) => (
                <div className="wiki-hero-switch-skeleton" key={index}>
                  <span />
                  <i />
                </div>
              ))}
            </div>
          ) : query.isError && !query.data ? (
            <div className="wiki-hero-switch-state" role="status">
              <p>{wikiText(locale, "Chưa thể tải danh sách tướng.", "Could not load heroes.")}</p>
              <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
                {t("retry")}
              </button>
            </div>
          ) : !heroes.length ? (
            <div className="wiki-hero-switch-state" role="status">
              <p>
                {hasFilters
                  ? wikiText(locale, "Không tìm thấy tướng phù hợp.", "No matching heroes.")
                  : wikiText(locale, "Chưa có tướng được xuất bản.", "No heroes have been published yet.")}
              </p>
              {hasFilters && (
                <button type="button" onClick={resetFilters}>
                  {wikiText(locale, "Xóa bộ lọc", "Clear filters")}
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
  const { locale } = useWikiContext()
  const [open, setOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="wiki-hero-switch-trigger"
          aria-label={wikiText(locale, "Đổi tướng nhanh", "Switch hero")}
          title={wikiText(locale, "Đổi tướng nhanh", "Switch hero")}
        >
          <SwitchIcon />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="wiki-hero-switch-panel ease-out data-[state=open]:duration-200 data-[state=closed]:duration-150 motion-reduce:animate-none"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus({ preventScroll: true })
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
