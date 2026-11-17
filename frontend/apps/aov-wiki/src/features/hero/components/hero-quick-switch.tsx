import { localeText } from "@aov/ui/lib/locale-text"
import { useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { heroCatalogQuery } from "../../../lib/hero-api"
import { HeroCard } from "./hero-card"
import {
  HERO_POSITIONS,
  HERO_ROLES,
  localizedHeroOptions,
  normalizedHeroSearch,
  type HeroPosition,
  type HeroRole,
} from "../../../lib/hero-classifications"
import { HeroFilterChips } from "./hero-filter-chips"
import { HeroCardSkeleton } from "./hero-loading"
import { useDragScroll } from "../../../lib/use-drag-scroll"
import "./hero-quick-switch.css"

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
  const { locale } = scope
  const t = localeText(locale)
  const roleOptions = localizedHeroOptions(HERO_ROLES, locale)
  const positionOptions = localizedHeroOptions(HERO_POSITIONS, locale)
  const query = useQuery(heroCatalogQuery(scope))
  const laneScroll = useDragScroll<HTMLDivElement>("horizontal")
  const roleScroll = useDragScroll<HTMLDivElement>("horizontal")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<HeroRole | null>(null)
  const [position, setPosition] = useState<HeroPosition | null>(null)
  const needle = normalizedHeroSearch(search)
  const heroes = (query.data?.items || []).filter(
    (hero) =>
      (!role || hero.roles.includes(role)) &&
      (!position || hero.positions?.includes(position)) &&
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
          <div className="wiki-hero-switch-title">
            <SheetTitle>{wikiText(locale, "Chọn tướng", "Choose a hero")}</SheetTitle>
            {query.isSuccess && (
              <small
                role="status"
                aria-label={`${filterLabel ? `${filterLabel}: ` : ""}${heroes.length} ${wikiText(locale, "tướng", heroes.length === 1 ? "hero" : "heroes")}`}
              >
                {heroes.length}
              </small>
            )}
          </div>
          <SheetDescription className="sr-only">
            {wikiText(
              locale,
              "Tìm và chuyển nhanh sang một tướng đã xuất bản.",
              "Find and switch to a published hero.",
            )}
          </SheetDescription>
          <SheetClose
            className="wiki-hero-switch-close"
            aria-label={wikiText(locale, "Đóng danh sách tướng", "Close hero picker")}
            title={t("Đóng", "Close")}
          >
            <WikiIcon name="close" />
          </SheetClose>
        </div>
        <label className="wiki-hero-search wiki-hero-switch-search">
          <WikiIcon name="search" size={18} />
          <span className="sr-only">{wikiText(locale, "Tìm tên hoặc mã tướng", "Search hero name or code")}</span>
          <input
            ref={searchRef}
            type="search"
            placeholder={wikiText(locale, "Tìm tên tướng…", "Search hero names…")}
            maxLength={120}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {/* One choice per group: picking the chosen chip again shows every lane or role. */}
        <div className="wiki-hero-switch-filters" ref={laneScroll.ref} {...laneScroll.handlers}>
          <HeroFilterChips
            label={wikiText(locale, "Vị trí", "Lane")}
            options={positionOptions}
            selected={position ? [position] : []}
            onToggle={(value) => setPosition((current) => (current === value ? null : value))}
          />
        </div>
        <div className="wiki-hero-switch-filters" ref={roleScroll.ref} {...roleScroll.handlers}>
          <HeroFilterChips
            label={wikiText(locale, "Vai trò", "Role")}
            options={roleOptions}
            selected={role ? [role] : []}
            onToggle={(value) => setRole((current) => (current === value ? null : value))}
          />
        </div>
      </div>
      <div className="wiki-hero-switch-scroll">
        {query.isPending ? (
          <div
            className="wiki-hero-switch-grid"
            aria-busy="true"
            aria-label={wikiText(locale, "Đang tải danh sách tướng", "Loading the hero list")}
          >
            {Array.from({ length: 18 }, (_, index) => (
              <HeroCardSkeleton key={index} />
            ))}
          </div>
        ) : query.isError && !query.data ? (
          <div className="wiki-hero-switch-state" role="status">
            <p>{wikiText(locale, "Chưa thể tải danh sách tướng.", "Could not load heroes.")}</p>
            <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
              {t("Thử lại", "Retry")}
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
              <HeroCard key={hero.id} hero={hero} from={returnTo} current={hero.id === currentHeroId} onPick={onPick} />
            ))}
          </div>
        )}
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
          <WikiIcon name="switch" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="wiki-hero-switch-panel ease-out data-[state=open]:duration-200 data-[state=closed]:duration-150 motion-reduce:animate-none"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          // A touch keyboard would cover the heroes, so only a mouse or a keyboard starts in the search field.
          if (window.matchMedia("(pointer: coarse)").matches) return
          event.preventDefault()
          searchRef.current?.focus({ preventScroll: true })
        }}
      >
        <HeroPicker
          currentHeroId={currentHeroId}
          returnTo={returnTo}
          searchRef={searchRef}
          onPick={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
