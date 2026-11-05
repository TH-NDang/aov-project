import { FeedbackDialog } from "../../layout/feedback-dialog"
import { useMemo, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@aov/ui/components/public-overlay"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { WikiImage } from "../../components/wiki-image"
import { skinCatalogQuery, type SkinBadge, type SkinEntry, type SkinFilterOption } from "./skin-api"
import { SkinGridSkeleton } from "./skin-loading"
import { SkinCollectionHeading } from "./skin-collection-heading"
import { SkinIcon } from "./skin-icon"
import "./skin-directory.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiVersionPicker } from "../../components/wiki-version-picker"
import { useDragScroll } from "../hero/use-drag-scroll"
import { groupSkins, type HeroSort, type SkinSort } from "./skin-groups"
import { normalizedHeroSearch } from "../hero/hero-classifications"

function SkinBadgeImage({ badge }: { badge?: SkinBadge }) {
  const [failed, setFailed] = useState(false)
  const image = badge?.icon?.currentVersion?.url
  if (!badge || !image || failed) return null

  return (
    <WikiImage
      className="wiki-skin-badge"
      src={image}
      alt={badge.name}
      title={badge.name}
      width="72"
      height="36"
      onError={() => setFailed(true)}
    />
  )
}

function SkinArtwork({ skin, preview = false }: { skin: SkinEntry; preview?: boolean }) {
  const { locale } = useWikiContext()
  const [failed, setFailed] = useState<string[]>([])
  const portrait = { kind: "portrait", url: skin.portrait?.currentVersion?.url }
  const head = { kind: "head", url: skin.head?.currentVersion?.url }
  const art = { kind: "art", url: skin.art?.currentVersion?.url }
  const candidates = preview ? [art, portrait, head] : [portrait, head, art]
  const artwork = candidates.find(({ url }) => url && !failed.includes(url))

  return artwork?.url ? (
    <WikiImage
      className={
        preview
          ? `wiki-skin-preview-art wiki-skin-preview-art-${artwork.kind}`
          : `wiki-skin-art wiki-skin-art-${artwork.kind}`
      }
      src={artwork.url}
      media={
        preview ? (artwork.kind === "art" ? skin.art : artwork.kind === "head" ? skin.head : skin.portrait) : undefined
      }
      alt={preview ? `${skin.name} — ${skin.heroName}` : ""}
      width="278"
      height="436"
      loading={preview ? "eager" : "lazy"}
      onError={() => setFailed((current) => [...current, artwork.url!])}
    />
  ) : (
    <span
      className="wiki-skin-missing"
      aria-label={wikiText(locale, "Chưa có ảnh trang phục", "Skin artwork unavailable")}
    >
      <span aria-hidden="true">{skin.name.charAt(0)}</span>
      {preview && <span>{wikiText(locale, "Chưa có ảnh", "No artwork")}</span>}
    </span>
  )
}

function HeroHead({ skin }: { skin: SkinEntry }) {
  const [failedSource, setFailedSource] = useState<string>()
  const source = skin.heroHead?.currentVersion?.url
  if (!source || source === failedSource) return null

  return (
    <WikiImage
      className="wiki-skin-hero-head"
      src={source}
      alt=""
      width="20"
      height="20"
      onError={() => setFailedSource(source)}
    />
  )
}

function SkinCard({ skin, onOpen }: { skin: SkinEntry; onOpen: (skin: SkinEntry, button: HTMLButtonElement) => void }) {
  const { locale } = useWikiContext()
  return (
    <button
      type="button"
      className="wiki-skin-card"
      aria-label={`${wikiText(locale, "Xem", "View")} ${skin.name} — ${skin.heroName}`}
      onClick={(event) => onOpen(skin, event.currentTarget)}
    >
      <span className="wiki-skin-frame">
        <SkinArtwork skin={skin} />
        <span className="wiki-skin-frame-corner" aria-hidden="true" />
      </span>
      <SkinBadgeImage key={skin.badge?.icon?.currentVersion?.url} badge={skin.badge} />
      <span className="wiki-skin-card-caption">
        <span className="wiki-skin-card-name">{skin.name}</span>
        {skin.unscopedBaseline && <small>{wikiText(locale, "Chưa rõ mốc", "Undated baseline")}</small>}
      </span>
    </button>
  )
}

function HeroSkinRow({
  skins,
  onOpen,
}: {
  skins: SkinEntry[]
  onOpen: (skin: SkinEntry, button: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const scroll = useDragScroll("horizontal")
  const hero = skins[0]
  return (
    <section className="wiki-skin-group" aria-labelledby={`skins-${hero.heroId}`}>
      <div className="wiki-skin-group-heading">
        <HeroHead skin={hero} />
        <h2 id={`skins-${hero.heroId}`}>{hero.heroName}</h2>
        <span>
          {skins.length} {wikiText(locale, "trang phục", skins.length === 1 ? "skin" : "skins")}
        </span>
      </div>
      <div className="wiki-skin-row" ref={scroll.ref} {...scroll.handlers}>
        {skins.map((skin) => (
          <SkinCard key={skin.skinKey} skin={skin} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

function SkinPreview({
  skin,
  open,
  onClose,
  returnFocus,
}: {
  skin: SkinEntry | null
  open: boolean
  onClose: () => void
  returnFocus: RefObject<HTMLButtonElement | null>
}) {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="wiki-skin-preview"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          const trigger = returnFocus.current
          if (trigger?.isConnected) {
            event.preventDefault()
            trigger.focus()
          }
        }}
      >
        {skin && (
          <>
            <DialogClose
              className="wiki-skin-preview-close"
              aria-label={text("Đóng ảnh trang phục", "Close skin preview")}
            >
              <SkinIcon name="close" size={18} />
            </DialogClose>
            <div className="wiki-skin-preview-image">
              <SkinArtwork key={`${skin.heroId}:${skin.skinKey}`} skin={skin} preview />
            </div>
            <div className="wiki-skin-preview-info">
              <span className="wiki-skin-preview-eyebrow">{scope.t("skins").toLocaleUpperCase(scope.locale)}</span>
              <div className="wiki-edit-heading">
                <DialogTitle>{skin.name}</DialogTitle>
                <FeedbackDialog
                  target={`${skin.heroName} · ${skin.name}`}
                  identity={`${skin.heroCode}/${skin.skinKey}`}
                  fields={[
                    { label: text("Tên trang phục", "Skin name"), value: skin.name },
                    { label: text("Bậc trang phục", "Skin tier"), value: skin.badge?.name ?? "" },
                  ]}
                />
              </div>
              <DialogDescription>
                {text("Trang phục của", "Skin for")} {skin.heroName}
              </DialogDescription>
              {skin.badge && (
                <div className="wiki-skin-preview-badge">
                  <SkinBadgeImage key={skin.badge.icon?.currentVersion?.url} badge={skin.badge} />
                  <span>{skin.badge.name}</span>
                </div>
              )}
              <Link className="wiki-skin-preview-hero" to={scope.href(`/hero/${skin.heroCode}`)}>
                <HeroHead skin={skin} />
                <span>
                  {text("Xem tướng", "View hero")} {skin.heroName}
                </span>
                <SkinIcon name="open" size={14} />
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SkinFilterImage({ kind, image }: { kind: "hero" | "badge"; image?: string }) {
  const [failed, setFailed] = useState<string>()
  return (
    <span className={`wiki-skin-filter-art wiki-skin-filter-art-${kind}`} aria-hidden="true">
      {image && image !== failed ? (
        <WikiImage src={image} alt="" onError={() => setFailed(image)} />
      ) : (
        <SkinIcon name={kind} size={16} />
      )}
    </span>
  )
}

function FilterSelect({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string
  icon: "hero" | "badge"
  value: string
  options: (SkinFilterOption & { image?: string })[]
  onChange: (value: string) => void
}) {
  const { locale } = useWikiContext()
  const known = options.some((option) => option.code === value)
  const counts = new Map<string, number>()
  const occurrences = new Map<string, number>()
  options.forEach((option) => counts.set(option.name, (counts.get(option.name) || 0) + 1))
  const choices = options.map((option) => {
    const occurrence = (occurrences.get(option.name) || 0) + 1
    occurrences.set(option.name, occurrence)
    return { ...option, variant: counts.get(option.name)! > 1 ? occurrence : null }
  })
  return (
    <Select value={value || "__all"} onValueChange={(next) => onChange(next === "__all" ? "" : next)}>
      <SelectTrigger
        className="wiki-skin-select"
        data-active={!!value || undefined}
        aria-label={`${wikiText(locale, "Lọc", "Filter")} ${label.toLocaleLowerCase(locale)}`}
        size="sm"
      >
        {(!value || !known) && <SkinIcon name={icon} size={16} />}
        <SelectValue placeholder={label}>{value ? undefined : label}</SelectValue>
      </SelectTrigger>
      <SelectContent drawerTitle={label} className="wiki-skin-select-menu" position="popper" align="start">
        <SelectItem value="__all">
          {label}: {wikiText(locale, "Tất cả", "All")}
        </SelectItem>
        {!!value && !known && <SelectItem value={value}>{value}</SelectItem>}
        {choices.map((option) => (
          <SelectItem value={option.code} key={option.code} textValue={option.name}>
            <span className="wiki-skin-filter-choice">
              <SkinFilterImage kind={icon} image={option.image} />
              <span className="wiki-skin-filter-name">
                {option.name}
                {option.variant && (
                  <span className="wiki-skin-select-variant">
                    {wikiText(locale, "Mẫu", "Variant")} {option.variant}
                  </span>
                )}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SkinDirectory() {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const [parameters, setParameters] = useSearchParams()
  const search = (parameters.get("q") || "").slice(0, 120)
  const hero = parameters.get("hero") || ""
  const rarity = parameters.get("rarity") || ""
  const heroOrder = parameters.get("heroSort")
  const heroSort: HeroSort = heroOrder === "fewest" || heroOrder === "name" ? heroOrder : "most"
  const skinSort: SkinSort = parameters.get("skinSort") === "name" ? "name" : "tier"
  const query = useQuery(skinCatalogQuery(scope))
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const [selected, setSelected] = useState<SkinEntry | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const groups = useMemo(() => {
    const terms = normalizedHeroSearch(search).split(/\s+/).filter(Boolean)
    const matches = (query.data?.items ?? []).filter((skin) => {
      if ((hero && skin.heroCode !== hero) || (rarity && skin.rarityCode !== rarity)) return false
      if (!terms.length) return true
      const text = normalizedHeroSearch(`${skin.heroName} ${skin.heroCode} ${skin.name} ${skin.skinKey}`)
      return terms.every((term) => text.includes(term))
    })
    return groupSkins(matches, heroSort, skinSort, scope.locale)
  }, [query.data, search, hero, rarity, heroSort, skinSort, scope.locale])
  const hasFilters = !!search || !!hero || !!rarity

  function updateFilter(key: "q" | "hero" | "rarity" | "heroSort" | "skinSort", value: string) {
    const next = new URLSearchParams(parameters)
    if (value) next.set(key, value)
    else next.delete(key)
    setParameters(next, { replace: key === "q" })
  }

  function clearFilters() {
    const next = new URLSearchParams(parameters)
    for (const key of ["q", "hero", "rarity"]) next.delete(key)
    setParameters(next)
  }

  return (
    <div className="wiki-skin-directory" aria-busy={query.isPending}>
      <SkinCollectionHeading />
      <WikiVersionPicker />
      <section className="wiki-skin-toolbar" aria-label={text("Bộ lọc trang phục", "Skin filters")}>
        <label className="wiki-skin-search">
          <SkinIcon name="search" size={18} />
          <span className="sr-only">{text("Tìm trang phục hoặc tướng", "Search skins or heroes")}</span>
          <input
            type="search"
            enterKeyHint="search"
            placeholder={text("Tìm trang phục, tướng…", "Search skins, heroes…")}
            maxLength={120}
            value={search}
            onChange={(event) => updateFilter("q", event.target.value)}
          />
        </label>
        <div className="wiki-skin-filter-strip">
          <FilterSelect
            label={text("Tướng", "Hero")}
            icon="hero"
            value={hero}
            options={query.data?.heroes || []}
            onChange={(value) => updateFilter("hero", value)}
          />
          <FilterSelect
            label={text("Bậc", "Tier")}
            icon="badge"
            value={rarity}
            options={query.data?.rarities || []}
            onChange={(value) => updateFilter("rarity", value)}
          />
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="wiki-skin-sort" aria-label={text("Sắp xếp trang phục", "Sort skins")}>
                <SkinIcon name="sort" size={16} />
                {text("Sắp xếp", "Sort")}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              drawerTitle={text("Sắp xếp trang phục", "Sort skins")}
              className="wiki-skin-sort-menu"
            >
              <fieldset>
                <legend>{text("Thứ tự tướng", "Hero order")}</legend>
                {(
                  [
                    ["most", text("Nhiều trang phục nhất", "Most skins")],
                    ["fewest", text("Ít trang phục nhất", "Fewest skins")],
                    ["name", text("Tên tướng A–Z", "Hero name A–Z")],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="hero-sort"
                      checked={heroSort === value}
                      onChange={() => updateFilter("heroSort", value === "most" ? "" : value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>{text("Trang phục trong hàng", "Skins within each row")}</legend>
                {(
                  [
                    ["tier", text("Bậc cao nhất", "Highest tier")],
                    ["name", text("Tên trang phục A–Z", "Skin name A–Z")],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="skin-sort"
                      checked={skinSort === value}
                      onChange={() => updateFilter("skinSort", value === "tier" ? "" : value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </PopoverContent>
          </Popover>
          {hasFilters && (
            <button
              className="wiki-skin-clear"
              type="button"
              onClick={clearFilters}
              aria-label={text("Xóa bộ lọc", "Clear filters")}
            >
              <SkinIcon name="reset" size={16} />
            </button>
          )}
        </div>
      </section>

      {query.isError && !!query.data && (
        <div className="wiki-skin-refresh-error" role="status">
          {text("Chưa cập nhật được danh sách.", "The collection could not be refreshed.")}
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {scope.t("retry")}
          </button>
        </div>
      )}
      {query.isPending ? (
        <SkinGridSkeleton />
      ) : query.isError && !query.data ? (
        <div className="wiki-skin-state" role="status">
          <h2>{text("Chưa tải được trang phục", "Skins could not be loaded")}</h2>
          <p>{text("Vui lòng kiểm tra kết nối và thử lại.", "Check your connection and try again.")}</p>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {scope.t("retry")}
          </button>
        </div>
      ) : !groups.length ? (
        <div className="wiki-skin-state" role="status">
          <h2>
            {hasFilters
              ? text("Không tìm thấy trang phục phù hợp", "No matching skins")
              : text("Chưa có trang phục tại mốc này", "No skins for this scope")}
          </h2>
          <p>
            {hasFilters
              ? text("Thử tên khác hoặc bỏ bớt điều kiện lọc.", "Try another name or fewer filters.")
              : text("Các trang phục đã công bố sẽ xuất hiện tại đây.", "Published skins will appear here.")}
          </p>
          {hasFilters && (
            <button type="button" onClick={clearFilters}>
              {text("Xóa bộ lọc", "Clear filters")}
            </button>
          )}
        </div>
      ) : (
        <div className="wiki-skin-groups">
          {groups.map((skins) => (
            <HeroSkinRow
              key={`${skins[0].heroId}:${skinSort}`}
              skins={skins}
              onOpen={(entry, trigger) => {
                returnFocus.current = trigger
                setSelected(entry)
                setPreviewOpen(true)
              }}
            />
          ))}
        </div>
      )}
      <SkinPreview skin={selected} open={previewOpen} onClose={() => setPreviewOpen(false)} returnFocus={returnFocus} />
    </div>
  )
}
