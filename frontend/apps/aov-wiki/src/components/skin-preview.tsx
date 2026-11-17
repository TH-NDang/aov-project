import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/public-overlay"
import { WikiImage } from "./wiki-image"
import { WikiImageCredit } from "./wiki-image-credit"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { FeedbackDialog } from "./feedback-dialog"
import type { HeroMedia } from "../lib/hero-api"
import { SkinAcquisitionText } from "./hero-shop"
import { SkinVideoList, useSkinVideos } from "./videos/subject-videos"
import { VideoPlayer } from "./videos/video-player"
import type { SkinBadge, SkinEntry } from "../lib/skin-api"
import { SkinIcon } from "./skin-icon"
import "./skin-preview.css"

export const skinId = (skin: SkinEntry) => `${skin.heroId}:${skin.skinKey}`

export function SkinBadgeImage({ badge }: { badge?: SkinBadge }) {
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

export function HeroHead({ skin }: { skin: SkinEntry }) {
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

export function SkinArtwork({
  skin,
  preview = false,
  card = false,
  eager = preview,
  credit = preview,
  onShown,
}: {
  skin: SkinEntry
  preview?: boolean
  /** A card is too large for the small head picture, so a skin without a portrait shows a part of its artwork. */
  card?: boolean
  eager?: boolean
  /** Whether the picture carries its own source button; off where the source is written out beside it. */
  credit?: boolean
  /** Reports which picture is on screen, as a later one takes over when the first cannot load. */
  onShown?: (media: HeroMedia | undefined) => void
}) {
  const { locale } = useWikiContext()
  const [failed, setFailed] = useState<string[]>([])
  const portrait = { kind: "portrait", media: skin.portrait }
  const head = { kind: "head", media: skin.head }
  const art = { kind: "art", media: skin.art }
  const candidates = preview ? [art, portrait, head] : card ? [portrait, art, head] : [portrait, head, art]
  const artwork = candidates.find(({ media }) => {
    const url = media?.currentVersion?.url
    return url && !failed.includes(url)
  })
  const shown = artwork?.media
  const source = shown?.currentVersion?.url
  useEffect(() => onShown?.(shown), [onShown, shown])

  if (artwork && source)
    return (
      <WikiImage
        className={
          preview
            ? `wiki-skin-preview-art wiki-skin-preview-art-${artwork.kind}`
            : `wiki-skin-art wiki-skin-art-${artwork.kind}`
        }
        src={source}
        focus={shown?.currentVersion?.focalPoint}
        media={credit ? shown : undefined}
        alt={preview ? `${skin.name} — ${skin.heroName}` : ""}
        width="278"
        height="436"
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed((current) => [...current, source])}
      />
    )

  // No picture is recorded: the hero's own face, dimmed, keeps the tile from reading as broken.
  return (
    <span className="wiki-skin-missing" data-preview={preview || undefined} aria-hidden={!preview || undefined}>
      {skin.heroHead?.currentVersion?.url ? (
        <HeroHead skin={skin} />
      ) : (
        <span className="wiki-skin-missing-initial" aria-hidden="true">
          {skin.name.charAt(0)}
        </span>
      )}
      {preview && <span>{wikiText(locale, "Chưa có ảnh của trang phục này", "No picture of this skin yet")}</span>}
    </span>
  )
}

/** The picture the viewer opens on. */
function previewMedia(skin: SkinEntry) {
  return [skin.art, skin.portrait, skin.head].find((media) => media?.currentVersion?.url)
}

/** The image the viewer opens first; fetched ahead of time so stepping through skins does not flash. */
export function previewSource(skin: SkinEntry) {
  return previewMedia(skin)?.currentVersion?.url
}

export function SkinPreview({
  skin,
  groups,
  open,
  onClose,
  onMove,
  heroLink = true,
}: {
  skin: SkinEntry | null
  /** The lists a reader can step through; stepping stays inside the list that holds the open skin. */
  groups: SkinEntry[][]
  open: boolean
  onClose: () => void
  onMove: (skin: SkinEntry) => void
  /** Off on the hero's own page, where the link would lead back to where the reader already is. */
  heroLink?: boolean
}) {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const current = skin ? skinId(skin) : ""
  const list = useMemo(
    () => groups.find((group) => group.some((entry) => skinId(entry) === current)) ?? [],
    [groups, current],
  )
  const index = list.findIndex((entry) => skinId(entry) === current)
  const canStep = index >= 0 && list.length > 1
  const oneHero = list.every((entry) => entry.heroId === skin?.heroId)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const skinVideos = useSkinVideos(skin)
  const [shown, setShown] = useState<{ skin: string; media?: HeroMedia }>()
  const reportShown = useCallback((media: HeroMedia | undefined) => setShown({ skin: current, media }), [current])
  const media = (shown?.skin === current ? shown.media : undefined) ?? (skin ? previewMedia(skin) : undefined)
  const sources = media?.currentVersion?.sources ?? []
  const owner = sources.map((source) => source.ownerName?.trim() || source.label.trim()).find(Boolean)

  function step(delta: number) {
    if (canStep) onMove(list[(index + delta + list.length) % list.length])
  }

  useEffect(() => {
    if (!open || !canStep) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      const target = event.target as HTMLElement
      // A nested feedback dialog keeps its own focus, and its text fields need the arrow keys.
      if (target !== document.body && !target.closest(".wiki-skin-preview")) return
      if (target.closest("input, textarea, select, [contenteditable='true']")) return
      event.preventDefault()
      onMove(list[(index + (event.key === "ArrowRight" ? 1 : -1) + list.length) % list.length])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, canStep, index, list, onMove])

  useEffect(() => {
    if (!open || !canStep) return
    for (const delta of [1, -1, 2]) {
      const source = previewSource(list[(index + delta + list.length) % list.length])
      if (source) new Image().src = source
    }
  }, [open, canStep, index, list])

  /**
   * Runs when the small picture of the skin on show enters the page or takes over from another one. The viewer's
   * content mounts a moment after it opens, which an effect on the open skin would miss.
   */
  const followThumb = useCallback((thumb: HTMLButtonElement | null) => {
    const rail = thumb?.parentElement
    if (!thumb || !rail) return
    // Only the rail moves, so choosing a skin never scrolls the viewer itself.
    rail.scrollTo({ left: thumb.offsetLeft - (rail.clientWidth - thumb.offsetWidth) / 2 })
    // The rail is one stop for the Tab key; while the focus is in it, the focus follows the skin on show.
    if (rail.contains(document.activeElement)) thumb.focus({ preventScroll: true })
  }, [])

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
          // Return to the skin last viewed, which may be several cards away from the one that opened the viewer.
          const card = skin && document.querySelector<HTMLElement>(`[data-skin-card="${CSS.escape(skinId(skin))}"]`)
          if (card?.isConnected) {
            event.preventDefault()
            card.focus()
            card.scrollIntoView({ block: "nearest", inline: "center" })
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
            <div
              className="wiki-skin-preview-image"
              onPointerDown={(event) => {
                swipe.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY }
              }}
              onPointerCancel={() => {
                swipe.current = null
              }}
              onPointerUp={(event) => {
                const start = swipe.current
                swipe.current = null
                if (!start) return
                const dx = event.clientX - start.x
                if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.5) step(dx < 0 ? 1 : -1)
              }}
            >
              {/* A skin with only a tall portrait leaves the stage's sides empty; a blurred copy fills them. */}
              {!skin.art?.currentVersion?.url && !skinVideos.playing && previewSource(skin) && (
                <span
                  className="wiki-skin-preview-backdrop"
                  style={{ backgroundImage: `url("${previewSource(skin)}")` }}
                  aria-hidden="true"
                />
              )}
              {skinVideos.playing ? (
                <VideoPlayer key={skinVideos.playing.id} video={skinVideos.playing} onEnded={skinVideos.onEnded} />
              ) : (
                <SkinArtwork key={current} skin={skin} preview credit={false} onShown={reportShown} />
              )}
              {canStep && !skinVideos.playing && (
                <>
                  <button
                    type="button"
                    className="wiki-skin-preview-step"
                    data-side="previous"
                    aria-label={text("Trang phục trước", "Previous skin")}
                    title={text("Trang phục trước (←)", "Previous skin (←)")}
                    onClick={() => step(-1)}
                  >
                    <span>
                      <SkinIcon name="chevronLeft" size={22} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="wiki-skin-preview-step"
                    data-side="next"
                    aria-label={text("Trang phục sau", "Next skin")}
                    title={text("Trang phục sau (→)", "Next skin (→)")}
                    onClick={() => step(1)}
                  >
                    <span>
                      <SkinIcon name="chevronRight" size={22} />
                    </span>
                  </button>
                  <span className="wiki-skin-preview-count" aria-live="polite">
                    <span className="sr-only">{skin.name} </span>
                    {index + 1}/{list.length}
                  </span>
                </>
              )}
            </div>
            {list.length > 1 && (
              <div
                className="wiki-skin-preview-set"
                role="group"
                aria-label={
                  oneHero
                    ? text(`Trang phục khác của ${skin.heroName}`, `Other skins of ${skin.heroName}`)
                    : text("Trang phục trong kết quả", "Skins in the results")
                }
              >
                {list.map((entry) => {
                  const active = skinId(entry) === current
                  const name = oneHero ? entry.name : `${entry.name} — ${entry.heroName}`
                  return (
                    <button
                      key={skinId(entry)}
                      ref={active ? followThumb : undefined}
                      type="button"
                      className="wiki-skin-thumb"
                      aria-current={active || undefined}
                      aria-label={`${text("Xem", "View")} ${name}`}
                      title={name}
                      tabIndex={active ? 0 : -1}
                      onClick={() => onMove(entry)}
                    >
                      <SkinArtwork skin={entry} />
                    </button>
                  )
                })}
              </div>
            )}
            <div className="wiki-skin-preview-info">
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
              <DialogDescription className="sr-only">
                {text("Trang phục của", "Skin for")} {skin.heroName}
              </DialogDescription>
              <dl className="wiki-skin-preview-facts">
                <div>
                  <dt>{text("Tướng", "Hero")}</dt>
                  <dd>
                    {heroLink ? (
                      <Link className="wiki-skin-preview-hero" to={scope.href(`/hero/${skin.heroCode}`)}>
                        <HeroHead skin={skin} />
                        {skin.heroName}
                        <SkinIcon name="arrow" size={14} />
                      </Link>
                    ) : (
                      <span className="wiki-skin-preview-hero">
                        <HeroHead skin={skin} />
                        {skin.heroName}
                      </span>
                    )}
                  </dd>
                </div>
                {skin.badge && (
                  <div>
                    <dt>{text("Bậc", "Tier")}</dt>
                    <dd>
                      <SkinBadgeImage key={skin.badge.icon?.currentVersion?.url} badge={skin.badge} />
                      <span>{skin.badge.name}</span>
                    </dd>
                  </div>
                )}
                {/* The row hides itself while no way to obtain the skin is recorded. */}
                <div>
                  <dt>{text("Cách sở hữu", "How to get it")}</dt>
                  <dd>
                    <SkinAcquisitionText
                      heroId={skin.heroId}
                      skinKey={skin.skinKey}
                      className="wiki-skin-preview-acquisition"
                    />
                  </dd>
                </div>
              </dl>
              {media?.currentVersion && (
                <p className="wiki-skin-preview-credit">
                  <span>
                    {text("Nguồn ảnh", "Picture source")}: {owner ?? text("chưa xác minh", "not verified yet")}
                  </span>
                  <WikiImageCredit
                    sources={sources}
                    contactHref={`/contact?assetId=${encodeURIComponent(media.assetId)}&versionId=${encodeURIComponent(media.currentVersion.versionId)}`}
                  />
                </p>
              )}
              <SkinVideoList
                videos={skinVideos.videos}
                playing={skinVideos.playing}
                onPlay={(video) => {
                  skinVideos.play(video)
                  // On a phone the list scrolls the player out of view, so bring it back.
                  document.querySelector(".wiki-skin-preview-image")?.scrollIntoView({ block: "nearest" })
                }}
                onStop={skinVideos.stop}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
