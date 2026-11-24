import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { localeText } from "@aov/ui/lib/locale-text"
import { Fragment, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { WikiIcon } from "../../../components/wiki-icon"
import { WikiImage } from "../../../components/wiki-image"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { heroCatalogQuery } from "../../../lib/hero-api"
import { HeroSwitchLetterTile, HeroSwitchTile, HeroSwitchTileSkeleton } from "./hero-switch-tile"
import { heroRuns } from "../model/hero-order"
import { readRecentHeroes } from "../../../lib/recent-heroes"
import { usePublishedChanges } from "../../../lib/wiki-patch-changes"
import { PatchName } from "../../../components/hero-patch-name"
import { useNavigate } from "react-router"
import {
  HERO_POSITIONS,
  HERO_ROLES,
  localizedHeroOptions,
  normalizedHeroSearch,
  type HeroPosition,
  type HeroRole,
} from "../../../lib/hero-classifications"
import { HeroFilterChips } from "./hero-filter-chips"
import { useDragScroll } from "../../../lib/use-drag-scroll"
import "./hero-quick-switch.css"

/** Two rows of recent heroes on a phone, one on a wide panel. */
const RECENT_SHOWN = 8

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
  const wide = usePageLayout() === "wide"
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
  const navigate = useNavigate()
  // Read once as the list opens: the heroes this reader opened last, without the one being read.
  const [recentCodes] = useState(readRecentHeroes)
  const needle = normalizedHeroSearch(search)
  const all = query.data?.items || []
  const recent = recentCodes
    .flatMap((code) => all.filter((hero) => hero.code === code && hero.id !== currentHeroId))
    .slice(0, RECENT_SHOWN)
  // What the update being read did to each hero; a change can be recorded on a form of the hero (ADR-024).
  const changes = usePublishedChanges("HERO")
  const update = changes.patches.length === 1 ? changes.patches[0]?.variant : undefined
  const kindById = new Map([...changes.subjects.values()].map((subject) => [subject.id, subject.kind]))
  const kindOf = (hero: (typeof all)[number]) =>
    kindById.get(hero.id) ?? hero.forms?.map((form) => kindById.get(form.id)).find(Boolean)
  const changed = all.filter((hero) => kindOf(hero))
  // Unfiltered, every hero is listed by the name the reader sees, each letter opened by its index tile as in the library.
  const runs = heroRuns(all, "name", {
    standings: new Map(),
    difficultyMaximum: 10,
    bandLabel: (band) => band,
    unplaced: "",
    locale,
  })
  const heroes = all.filter(
    (hero) =>
      (!role || hero.roles.includes(role)) &&
      (!position || hero.positions?.includes(position)) &&
      (!needle || normalizedHeroSearch(`${hero.name} ${hero.code}`).includes(needle)),
  )
  const hasFilters = !!search || !!role || !!position
  const roleLabel = roleOptions.find((option) => option.value === role)?.label
  const positionLabel = positionOptions.find((option) => option.value === position)?.label
  const filterLabel = [positionLabel, roleLabel].filter(Boolean).join(" · ")

  const laneChips = (layout: "sheet" | "icons") => (
    <HeroFilterChips
      label={wikiText(locale, "Vị trí", "Lane")}
      options={positionOptions}
      selected={position ? [position] : []}
      onToggle={(value) => setPosition((current) => (current === value ? null : value))}
      layout={layout}
    />
  )
  const roleChips = (layout: "sheet" | "icons") => (
    <HeroFilterChips
      label={wikiText(locale, "Vai trò", "Role")}
      options={roleOptions}
      selected={role ? [role] : []}
      onToggle={(value) => setRole((current) => (current === value ? null : value))}
      layout={layout}
    />
  )

  const tile = (hero: (typeof all)[number]) => (
    <HeroSwitchTile
      key={hero.id}
      hero={hero}
      from={returnTo}
      current={hero.id === currentHeroId}
      kind={kindOf(hero)}
      onPick={onPick}
    />
  )

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
          {/* On a phone the sheet rises from the bottom and closes by a tap above it or a pull down: no X. */}
          {wide && (
            <SheetClose
              className="wiki-hero-switch-close"
              aria-label={wikiText(locale, "Đóng danh sách tướng", "Close hero picker")}
              title={t("Đóng", "Close")}
            >
              <WikiIcon name="close" />
            </SheetClose>
          )}
        </div>
        <label className="wiki-hero-search wiki-hero-switch-search">
          <WikiIcon name="search" size={18} />
          <span className="sr-only">{wikiText(locale, "Tìm tên hoặc mã tướng", "Search hero name or code")}</span>
          <input
            ref={searchRef}
            type="search"
            enterKeyHint="go"
            onKeyDown={(event) => {
              // Enter opens the first hero found, so typing part of a name and Enter is a whole switch.
              const first = heroes[0]
              if (event.key !== "Enter" || !first || !needle) return
              event.preventDefault()
              onPick()
              if (first.id !== currentHeroId)
                void navigate(scope.href(`/hero/${first.code}`), { state: { from: returnTo } })
            }}
            placeholder={wikiText(locale, "Tìm tên tướng…", "Search hero names…")}
            maxLength={120}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {/* One choice per group: picking the chosen chip again shows every lane or role. On a phone each group is a
            row of marks, each named by a tip, so the list keeps the screen. */}
        <div className="wiki-hero-switch-filters" ref={laneScroll.ref} {...laneScroll.handlers}>
          {laneChips(wide ? "sheet" : "icons")}
        </div>
        <div className="wiki-hero-switch-filters" ref={roleScroll.ref} {...roleScroll.handlers}>
          {roleChips(wide ? "sheet" : "icons")}
        </div>
      </div>
      <div className="wiki-hero-switch-scroll">
        {query.isPending ? (
          <div
            className="wiki-hero-switch-grid"
            aria-busy="true"
            aria-label={wikiText(locale, "Đang tải danh sách tướng", "Loading the hero list")}
          >
            {Array.from({ length: 24 }, (_, index) => (
              <HeroSwitchTileSkeleton key={index} />
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
          <>
            {!hasFilters && recent.length > 0 && (
              <section className="wiki-hero-switch-group" aria-labelledby="wiki-hero-switch-recent">
                <h3 id="wiki-hero-switch-recent">{wikiText(locale, "Xem gần đây", "Recently viewed")}</h3>
                <div className="wiki-hero-switch-grid">
                  {recent.map((hero) => (
                    <HeroSwitchTile
                      key={hero.id}
                      hero={hero}
                      from={returnTo}
                      current={false}
                      kind={kindOf(hero)}
                      onPick={onPick}
                    />
                  ))}
                </div>
              </section>
            )}
            {!hasFilters && changed.length > 0 && (
              <section className="wiki-hero-switch-group" aria-labelledby="wiki-hero-switch-changed">
                <h3 id="wiki-hero-switch-changed">
                  {update ? (
                    <>
                      {wikiText(locale, "Đổi ở bản ", "Changed in ")}
                      <PatchName patch={update} />
                    </>
                  ) : (
                    wikiText(locale, "Đổi ở bản này", "Changed in this update")
                  )}
                  <small>{changed.length}</small>
                </h3>
                <div className="wiki-hero-switch-grid">
                  {changed.map((hero) => (
                    <HeroSwitchTile
                      key={hero.id}
                      hero={hero}
                      from={returnTo}
                      current={hero.id === currentHeroId}
                      kind={kindOf(hero)}
                      onPick={onPick}
                    />
                  ))}
                </div>
              </section>
            )}
            <section className="wiki-hero-switch-group" aria-labelledby="wiki-hero-switch-all">
              <h3 id="wiki-hero-switch-all">
                {hasFilters ? wikiText(locale, "Kết quả", "Results") : wikiText(locale, "Tất cả tướng", "All heroes")}
              </h3>
              <div className="wiki-hero-switch-grid">
                {hasFilters
                  ? heroes.map(tile)
                  : runs.map((run) => (
                      <Fragment key={run.key}>
                        {run.label !== null && <HeroSwitchLetterTile letter={run.label} count={run.heroes.length} />}
                        {run.heroes.map(tile)}
                      </Fragment>
                    ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}

/**
 * Opens the hero list to switch to another hero. Beside the name it is a round mark; where the name is not on screen
 * (the phone header after scrolling, the side column) it carries the hero's picture and name, so the reader sees whose
 * page this is and what the button changes.
 */
export function HeroQuickSwitch({
  currentHeroId,
  returnTo,
  named,
}: {
  currentHeroId: string
  returnTo: string
  named?: { name: string; head?: string }
}) {
  const { locale } = useWikiContext()
  const [open, setOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const label = wikiText(locale, "Đổi tướng nhanh", "Switch hero")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {named ? (
          <button type="button" className="wiki-hero-switch-named" aria-label={`${named.name}. ${label}`} title={label}>
            <span className="wiki-hero-switch-named-head" aria-hidden="true">
              {named.head ? (
                <WikiImage src={named.head} frameWidth={64} alt="" width="28" height="28" decoding="async" />
              ) : (
                named.name.charAt(0)
              )}
            </span>
            <span className="wiki-hero-switch-named-name">{named.name}</span>
            <WikiIcon name="switch" size={16} />
          </button>
        ) : (
          <button type="button" className="wiki-hero-switch-trigger" aria-label={label} title={label}>
            <WikiIcon name="switch" />
          </button>
        )}
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
