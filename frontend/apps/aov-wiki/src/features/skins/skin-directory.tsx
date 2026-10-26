import { useEffect, useRef, useState, type RefObject } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { WikiImage } from "../../components/wiki-image"
import { skinCatalogQuery, type SkinBadge, type SkinEntry, type SkinFilterOption } from "./skin-api"
import { SkinGridSkeleton } from "./skin-loading"
import { SkinCollectionHeading } from "./skin-collection-heading"
import { SkinIcon } from "./skin-icon"
import "./skin-directory.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiVersionPicker } from "../../components/wiki-version-picker"

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
        <span className="wiki-skin-card-bottom">
          <span className="wiki-skin-card-hero">
            <HeroHead skin={skin} />
            <span>{skin.heroName}</span>
          </span>
          <span className="wiki-skin-card-open" aria-hidden="true">
            <SkinIcon name="open" size={16} />
          </span>
        </span>
      </span>
    </button>
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
              <DialogTitle>{skin.name}</DialogTitle>
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
  options: SkinFilterOption[]
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
        <SkinIcon name={icon} size={16} />
        <SelectValue placeholder={label}>{value ? undefined : label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="wiki-skin-select-menu" position="popper" align="start">
        <SelectItem value="__all">
          {label}: {wikiText(locale, "Tất cả", "All")}
        </SelectItem>
        {!!value && !known && <SelectItem value={value}>{value}</SelectItem>}
        {choices.map((option) => (
          <SelectItem value={option.code} key={option.code}>
            {option.name}
            {option.variant && (
              <span className="wiki-skin-select-variant">
                {wikiText(locale, "Mẫu", "Variant")} {option.variant}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function useDebouncedSearch(value: string) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), 250)
    return () => window.clearTimeout(timer)
  }, [value])
  return debounced
}

export function SkinDirectory() {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const [parameters, setParameters] = useSearchParams()
  const search = (parameters.get("q") || "").slice(0, 120)
  const hero = parameters.get("hero") || ""
  const rarity = parameters.get("rarity") || ""
  const debouncedSearch = useDebouncedSearch(search)
  const query = useInfiniteQuery(skinCatalogQuery({ q: debouncedSearch.trim(), hero, rarity }, scope))
  const sentinel = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const [selected, setSelected] = useState<SkinEntry | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const first = query.data?.pages[0]
  const skins = query.data?.pages.flatMap((page) => page.page.items) || []
  const filtering = query.isPlaceholderData || search !== debouncedSearch
  const hasFilters = !!search || !!hero || !!rarity

  useEffect(() => {
    const target = sentinel.current
    if (!target || !query.hasNextPage || query.isFetching || query.isFetchNextPageError || filtering) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void query.fetchNextPage()
      },
      { rootMargin: "300px" },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [query.hasNextPage, query.isFetching, query.isFetchNextPageError, query.fetchNextPage, filtering])

  function updateFilter(key: "q" | "hero" | "rarity", value: string) {
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
    <div className="wiki-skin-directory" aria-busy={query.isPending || filtering}>
      <SkinCollectionHeading count={first?.page.totalElements} updating={filtering} />
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
            options={first?.heroes || []}
            onChange={(value) => updateFilter("hero", value)}
          />
          <FilterSelect
            label={text("Bậc", "Tier")}
            icon="badge"
            value={rarity}
            options={first?.rarities || []}
            onChange={(value) => updateFilter("rarity", value)}
          />
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

      {query.isError && !!query.data && !query.isFetchNextPageError && (
        <div className="wiki-skin-refresh-error" role="status">
          {text("Chưa cập nhật được danh sách.", "The collection could not be refreshed.")}
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {scope.t("retry")}
          </button>
        </div>
      )}
      {query.isPending || filtering ? (
        <SkinGridSkeleton />
      ) : query.isError && !query.data ? (
        <div className="wiki-skin-state" role="status">
          <h2>{text("Chưa tải được trang phục", "Skins could not be loaded")}</h2>
          <p>{text("Vui lòng kiểm tra kết nối và thử lại.", "Check your connection and try again.")}</p>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {scope.t("retry")}
          </button>
        </div>
      ) : !skins.length ? (
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
        <>
          <div className="wiki-skin-grid">
            {skins.map((skin) => (
              <SkinCard
                skin={skin}
                key={`${skin.heroId}:${skin.skinKey}`}
                onOpen={(entry, trigger) => {
                  returnFocus.current = trigger
                  setSelected(entry)
                  setPreviewOpen(true)
                }}
              />
            ))}
          </div>
          <div className="wiki-skin-load-more" ref={sentinel} aria-live="polite">
            {query.isFetchingNextPage ? (
              <span className="wiki-skin-loading-dot">{text("Đang tải thêm trang phục…", "Loading more skins…")}</span>
            ) : query.isFetchNextPageError ? (
              <>
                <span>{text("Chưa tải được phần tiếp theo.", "The next page could not be loaded.")}</span>
                <button type="button" onClick={() => void query.fetchNextPage()}>
                  {scope.t("retry")}
                </button>
              </>
            ) : null}
          </div>
        </>
      )}
      <SkinPreview skin={selected} open={previewOpen} onClose={() => setPreviewOpen(false)} returnFocus={returnFocus} />
    </div>
  )
}
