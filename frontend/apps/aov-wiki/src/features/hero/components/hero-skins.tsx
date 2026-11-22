import { preloadPicture, resizedImageUrl } from "../../../lib/sized-image"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, useWikiText, wikiText } from "../../../context/wiki-context"
import { heroSkinsQuery, type SkinEntry } from "../../../lib/skin-api"
import { groupSkins } from "../../../lib/skin-groups"
import { previewSource, SkinArtwork, SkinBadgeImage, SkinPreview, skinId } from "../../../components/skin-preview"
import type { HeroDetail } from "../../../lib/hero-api"
import { currentScope } from "../../../lib/hero-forms"
import { useSkinAcquisition } from "../../../components/hero-shop"
import { useDragScroll } from "../../../lib/use-drag-scroll"
import "./hero-skins.css"

const preload = (skin: SkinEntry) => {
  const source = previewSource(skin)
  if (source) preloadPicture(source, 800)
}

/*
 * Measured in widths of the rail beside the picture: the rail is 1/1.7 of the picture's width and the picture has the
 * game's 1386:852 shape, which gives the picture's height; a gap is about 2% of the rail. A thumbnail is 3:4.
 */
const PICTURE_HEIGHT = (1.7 * 852) / 1386
const RAIL_GAP = 0.022

/**
 * How many thumbnails share a row beside the picture: the largest thumbnails whose rows still end with the picture, and
 * never a single one alone in the last row.
 */
function railColumns(count: number) {
  for (let columns = 3; columns < 8; columns++) {
    if (count > columns && count % columns === 1) continue
    const rows = Math.ceil(count / columns)
    const thumb = ((1 - RAIL_GAP * (columns - 1)) / columns) * (4 / 3)
    if (rows * thumb + RAIL_GAP * (rows - 1) <= PICTURE_HEIGHT) return columns
  }
  return 8
}

const railStyle = (count: number) => ({ "--skin-columns": railColumns(count) }) as CSSProperties

function HeroSkinsSkeleton({ label }: { label: string }) {
  return (
    <div className="wiki-hero-skin-viewer" role="status" aria-label={label} aria-busy="true">
      <span className="wiki-hero-skin-stage wiki-skeleton" />
      <span className="wiki-hero-skin-caption wiki-hero-skin-caption-skeleton wiki-skeleton" aria-hidden="true" />
      <div className="wiki-hero-skin-rail" style={railStyle(6)} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span className="wiki-hero-skin-thumb wiki-skeleton" key={index} />
        ))}
      </div>
    </div>
  )
}

/**
 * The chosen skin in words: its name, then its tier and how it is obtained on one line. It stands under the picture,
 * so a long name never pushes the other skins away from under the pointer.
 */
function SkinCaption({ skin, position, total }: { skin: SkinEntry; position: number; total: number }) {
  const acquisition = useSkinAcquisition(skin.heroId, skin.skinKey)
  return (
    <div className="wiki-hero-skin-caption">
      <strong aria-live="polite">{skin.name}</strong>
      {total > 1 && (
        <span className="wiki-hero-skin-count">
          {position}/{total}
        </span>
      )}
      {(skin.badge || acquisition) && (
        <p className="wiki-hero-skin-facts">
          {skin.badge && (
            <span className="wiki-hero-skin-tier">
              <SkinBadgeImage key={skin.badge.icon?.currentVersion?.url} badge={skin.badge} />
              {skin.badge.name}
            </span>
          )}
          {acquisition && <span>{acquisition}</span>}
        </p>
      )}
    </div>
  )
}

/**
 * The hero's skins on the hero page itself: one picture in its own proportions, its caption, and every other skin a
 * tap away. The full viewer opens on demand.
 */
export function HeroSkins({ hero, owner }: { hero: HeroDetail; owner?: string }) {
  const scope = useWikiContext()
  const text = useWikiText()
  // A form shows the skins every form shares and its own, not those of the other forms (ADR-024).
  const library = owner ?? hero.code
  const query = useQuery(heroSkinsQuery(currentScope(scope), library))
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

  if (!query.isPending && !query.isError && !skins.length) return null

  return (
    <section id="wiki-hero-skins" className="wiki-hero-skins" tabIndex={-1} aria-labelledby="wiki-hero-skins-title">
      <header className="wiki-hero-section-head">
        <h2 id="wiki-hero-skins-title">
          {text("Trang phục", "Skins")}
          {skins.length > 0 && <small>{skins.length}</small>}
        </h2>
        <Link className="wiki-hero-section-more" to={scope.href(`/skins?hero=${encodeURIComponent(library)}`)}>
          {text("Kho trang phục", "Skin library")}
          <WikiIcon name="arrow" size={14} />
        </Link>
      </header>
      {query.isPending ? (
        <HeroSkinsSkeleton label={text("Đang tải trang phục…", "Loading skins…")} />
      ) : !selected ? (
        <p className="wiki-handbook-notice" role="status">
          {text("Chưa tải được trang phục.", "The skins could not be loaded.")}{" "}
          <button type="button" onClick={() => void query.refetch()}>
            {wikiText(scope.locale, "Thử lại", "Retry")}
          </button>
        </p>
      ) : (
        <div className="wiki-hero-skin-viewer" data-single={skins.length < 2 || undefined}>
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
            {/* Only a skin without wide artwork leaves room around its picture, which the blurred copy fills. */}
            {!selected.art?.currentVersion?.url && previewSource(selected) && (
              <span
                className="wiki-skin-preview-backdrop"
                style={{ backgroundImage: `url("${resizedImageUrl(previewSource(selected)!, 384)}")` }}
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
          <SkinCaption skin={selected} position={index + 1} total={skins.length} />
          {skins.length > 1 && (
            <div
              className="wiki-hero-skin-rail"
              style={railStyle(skins.length)}
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
                    className="wiki-hero-skin-thumb"
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
        </div>
      )}
    </section>
  )
}
