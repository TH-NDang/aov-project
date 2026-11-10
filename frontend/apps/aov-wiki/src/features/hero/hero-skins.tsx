import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { heroSkinsQuery, type SkinEntry } from "../skins/skin-api"
import { groupSkins } from "../skins/skin-groups"
import { previewSource, SkinArtwork, SkinBadgeImage, SkinPreview, skinId } from "../skins/skin-preview"
import type { HeroDetail } from "./hero-api"
import { useDragScroll } from "./use-drag-scroll"
import "./hero-skins.css"

const preload = (skin: SkinEntry) => {
  const source = previewSource(skin)
  if (source) new Image().src = source
}

function HeroSkinsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      <span className="wiki-hero-skin-stage wiki-skeleton" />
      <div className="wiki-hero-skin-rail" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span className="wiki-skin-thumb wiki-skeleton" key={index} />
        ))}
      </div>
    </div>
  )
}

/** The hero's skins on the hero page itself: one large image, the rest a tap away, and the full viewer on demand. */
export function HeroSkins({ hero, owner }: { hero: HeroDetail; owner?: string }) {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  // A form shows the skins every form shares and its own, not those of the other forms (ADR-024).
  const library = owner ?? hero.code
  const query = useQuery(heroSkinsQuery(scope, library))
  const skins = useMemo(
    () =>
      groupSkins(
        (query.data ?? []).filter((skin) => !owner || skin.heroCode === owner || skin.heroCode === hero.code),
        "most",
        "tier",
        scope.locale,
      )[0] ?? [],
    [query.data, scope.locale, owner, hero.code],
  )
  const groups = useMemo(() => [skins], [skins])
  const [selectedKey, setSelectedKey] = useState<string>()
  const [viewing, setViewing] = useState(false)
  const scroll = useDragScroll<HTMLDivElement>("horizontal")
  const activeThumb = useRef<HTMLButtonElement>(null)
  const focusThumb = useRef(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const index = Math.max(
    0,
    skins.findIndex((skin) => skin.skinKey === selectedKey),
  )
  const selected: SkinEntry | undefined = skins[index]
  const move = (delta: number) => setSelectedKey(skins[(index + delta + skins.length) % skins.length].skinKey)

  useEffect(() => {
    // Nothing is chosen until the reader starts browsing, so a page they only pass through stays light.
    if (!selectedKey) return
    const thumb = activeThumb.current
    thumb?.parentElement?.scrollTo({
      left: thumb.offsetLeft - (thumb.parentElement.clientWidth - thumb.offsetWidth) / 2,
    })
    if (focusThumb.current) thumb?.focus({ preventScroll: true })
    focusThumb.current = false
    if (skins.length < 2) return
    for (const delta of [1, -1]) preload(skins[(index + delta + skins.length) % skins.length])
  }, [selectedKey, index, skins])

  const head = (count?: number) => (
    <div className="wiki-hero-skins-head">
      <h2 id="wiki-hero-skins-title">
        {text("Trang phục", "Skins")}
        {!!count && <span>{count}</span>}
      </h2>
      <Link to={scope.href(`/skins?hero=${encodeURIComponent(library)}`)}>
        {text("Mở trong kho trang phục", "Open in the skin library")}
        <WikiIcon name="arrow" size={14} />
      </Link>
    </div>
  )

  if (!query.isPending && !query.isError && !skins.length) return null

  return (
    <section id="wiki-hero-skins" className="wiki-hero-skins" tabIndex={-1} aria-labelledby="wiki-hero-skins-title">
      {head(skins.length)}
      {query.isPending ? (
        <HeroSkinsSkeleton label={text("Đang tải trang phục…", "Loading skins…")} />
      ) : !selected ? (
        <p className="wiki-handbook-notice" role="status">
          {text("Chưa tải được trang phục.", "The skins could not be loaded.")}
          <button type="button" onClick={() => void query.refetch()}>
            {scope.t("retry")}
          </button>
        </p>
      ) : (
        <>
          <div
            className="wiki-hero-skin-stage"
            onPointerDown={(event) => {
              swiped.current = false
              swipe.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY }
            }}
            onPointerCancel={() => {
              swipe.current = null
            }}
            onPointerUp={(event) => {
              const start = swipe.current
              swipe.current = null
              if (!start || skins.length < 2) return
              const dx = event.clientX - start.x
              if (Math.abs(dx) <= 48 || Math.abs(dx) <= Math.abs(event.clientY - start.y) * 1.5) return
              swiped.current = true
              move(dx < 0 ? 1 : -1)
            }}
          >
            {previewSource(selected) && (
              <span
                className="wiki-skin-preview-backdrop"
                style={{ backgroundImage: `url("${previewSource(selected)}")` }}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              className="wiki-hero-skin-open"
              aria-label={`${text("Phóng to", "Enlarge")} ${selected.name}`}
              onClick={() => {
                if (!swiped.current) setViewing(true)
                swiped.current = false
              }}
            />
            <SkinArtwork key={skinId(selected)} skin={selected} preview eager={false} />
            <span className="wiki-hero-skin-expand" aria-hidden="true">
              <WikiIcon name="expand" size={16} />
            </span>
            <div className="wiki-hero-skin-caption">
              <div>
                <strong aria-live="polite">{selected.name}</strong>
                {selected.badge && (
                  <span className="wiki-hero-skin-tier">
                    <SkinBadgeImage key={selected.badge.icon?.currentVersion?.url} badge={selected.badge} />
                    {selected.badge.name}
                  </span>
                )}
              </div>
              {skins.length > 1 && (
                <span className="wiki-hero-skin-count">
                  {index + 1}/{skins.length}
                </span>
              )}
            </div>
            {skins.length > 1 && (
              <>
                <button
                  type="button"
                  className="wiki-hero-skin-step"
                  data-side="previous"
                  aria-label={text("Trang phục trước", "Previous skin")}
                  onClick={() => move(-1)}
                >
                  <WikiIcon name="chevronLeft" size={20} />
                </button>
                <button
                  type="button"
                  className="wiki-hero-skin-step"
                  data-side="next"
                  aria-label={text("Trang phục sau", "Next skin")}
                  onClick={() => move(1)}
                >
                  <WikiIcon name="chevronRight" size={20} />
                </button>
              </>
            )}
          </div>
          {skins.length > 1 && (
            <div
              className="wiki-hero-skin-rail"
              ref={scroll.ref}
              role="group"
              aria-label={text("Chọn trang phục", "Choose a skin")}
              {...scroll.handlers}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
                event.preventDefault()
                focusThumb.current = true
                move(event.key === "ArrowRight" ? 1 : -1)
              }}
            >
              {skins.map((skin) => {
                const active = skin.skinKey === selected.skinKey
                return (
                  <button
                    key={skin.skinKey}
                    ref={active ? activeThumb : undefined}
                    type="button"
                    className="wiki-skin-thumb"
                    data-skin-card={skinId(skin)}
                    aria-current={active || undefined}
                    aria-label={`${text("Xem", "View")} ${skin.name}`}
                    title={skin.name}
                    tabIndex={active ? 0 : -1}
                    onPointerEnter={() => preload(skin)}
                    onClick={() => setSelectedKey(skin.skinKey)}
                  >
                    <SkinArtwork skin={skin} />
                  </button>
                )
              })}
            </div>
          )}
          <SkinPreview
            skin={selected}
            groups={groups}
            open={viewing}
            onClose={() => setViewing(false)}
            onMove={(skin) => setSelectedKey(skin.skinKey)}
            heroLink={false}
          />
        </>
      )}
    </section>
  )
}
