import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/public-overlay"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { FeedbackDialog } from "../../layout/feedback-dialog"
import { SkinVideoList, useSkinVideos } from "../videos/subject-videos"
import { VideoPlayer } from "../videos/video-player"
import { SkinAcquisitionText } from "../hero/hero-shop"
import type { SkinBadge, SkinEntry } from "./skin-api"
import { SkinIcon } from "./skin-icon"
import "./skin-directory.css"

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

export function SkinArtwork({
  skin,
  preview = false,
  eager = preview,
}: {
  skin: SkinEntry
  preview?: boolean
  eager?: boolean
}) {
  const { locale } = useWikiContext()
  const [failed, setFailed] = useState<string[]>([])
  const portrait = { kind: "portrait", url: skin.portrait?.currentVersion?.url }
  const head = { kind: "head", url: skin.head?.currentVersion?.url }
  const art = { kind: "art", url: skin.art?.currentVersion?.url }
  const candidates = preview ? [art, portrait, head] : [portrait, head, art]
  const artwork = candidates.find(({ url }) => url && !failed.includes(url))
  const shown = artwork?.kind === "art" ? skin.art : artwork?.kind === "head" ? skin.head : skin.portrait

  return artwork?.url ? (
    <WikiImage
      className={
        preview
          ? `wiki-skin-preview-art wiki-skin-preview-art-${artwork.kind}`
          : `wiki-skin-art wiki-skin-art-${artwork.kind}`
      }
      src={artwork.url}
      focus={shown?.currentVersion?.focalPoint}
      media={
        preview ? (artwork.kind === "art" ? skin.art : artwork.kind === "head" ? skin.head : skin.portrait) : undefined
      }
      alt={preview ? `${skin.name} — ${skin.heroName}` : ""}
      width="278"
      height="436"
      loading={eager ? "eager" : "lazy"}
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

/** The image the viewer opens first; fetched ahead of time so stepping through skins does not flash. */
export function previewSource(skin: SkinEntry) {
  return skin.art?.currentVersion?.url ?? skin.portrait?.currentVersion?.url ?? skin.head?.currentVersion?.url
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
  groups: SkinEntry[][]
  open: boolean
  onClose: () => void
  onMove: (skin: SkinEntry) => void
  /** Off on the hero's own page, where the link would lead back to where the reader already is. */
  heroLink?: boolean
}) {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const queue = useMemo(() => groups.flat(), [groups])
  const index = skin ? queue.findIndex((entry) => skinId(entry) === skinId(skin)) : -1
  const canStep = index >= 0 && queue.length > 1
  const heroIndex = skin ? groups.findIndex((group) => group[0].heroId === skin.heroId) : -1
  const heroSkins = groups[heroIndex] ?? []
  const previousHero = heroIndex >= 0 && groups.length > 1 ? groups.at(heroIndex - 1)?.[0] : undefined
  const nextHero = heroIndex >= 0 && groups.length > 1 ? groups[(heroIndex + 1) % groups.length][0] : undefined
  const activeThumb = useRef<HTMLButtonElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const skinVideos = useSkinVideos(skin)

  function step(delta: number) {
    if (canStep) onMove(queue[(index + delta + queue.length) % queue.length])
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
      onMove(queue[(index + (event.key === "ArrowRight" ? 1 : -1) + queue.length) % queue.length])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, canStep, index, queue, onMove])

  useEffect(() => {
    if (!open || !canStep) return
    for (const delta of [1, -1, 2]) {
      const source = previewSource(queue[(index + delta + queue.length) % queue.length])
      if (source) new Image().src = source
    }
  }, [open, canStep, index, queue])

  useEffect(() => {
    activeThumb.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [skin])

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
          // Return to the skin last viewed, which may be several heroes away from the card that opened the viewer.
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
              {previewSource(skin) && (
                <span
                  className="wiki-skin-preview-backdrop"
                  style={{ backgroundImage: `url("${previewSource(skin)}")` }}
                  aria-hidden="true"
                />
              )}
              {skinVideos.playing ? (
                <VideoPlayer key={skinVideos.playing.id} video={skinVideos.playing} onEnded={skinVideos.onEnded} />
              ) : (
                <SkinArtwork key={skinId(skin)} skin={skin} preview />
              )}
              {canStep && !skinVideos.playing && (
                <>
                  <button
                    type="button"
                    className="wiki-skin-preview-step"
                    data-side="previous"
                    aria-label={text("Trang phục trước", "Previous skin")}
                    onClick={() => step(-1)}
                  >
                    <span>
                      <WikiIcon name="chevronLeft" size={22} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="wiki-skin-preview-step"
                    data-side="next"
                    aria-label={text("Trang phục sau", "Next skin")}
                    onClick={() => step(1)}
                  >
                    <span>
                      <WikiIcon name="chevronRight" size={22} />
                    </span>
                  </button>
                </>
              )}
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
              <SkinAcquisitionText
                heroId={skin.heroId}
                skinKey={skin.skinKey}
                className="wiki-skin-preview-acquisition"
              />
              {skin.badge && (
                <div className="wiki-skin-preview-badge">
                  <SkinBadgeImage key={skin.badge.icon?.currentVersion?.url} badge={skin.badge} />
                  <span>{skin.badge.name}</span>
                </div>
              )}
              {heroLink && (
                <Link className="wiki-skin-preview-hero" to={scope.href(`/hero/${skin.heroCode}`)}>
                  <HeroHead skin={skin} />
                  <span>
                    {text("Xem tướng", "View hero")} {skin.heroName}
                  </span>
                  <SkinIcon name="open" size={14} />
                </Link>
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
              {heroSkins.length > 1 && (
                <section className="wiki-skin-preview-set" aria-label={text("Các trang phục khác", "Other skins")}>
                  <h3>
                    {text("Cùng tướng", "Same hero")}
                    <span aria-live="polite">
                      {heroSkins.findIndex((entry) => skinId(entry) === skinId(skin)) + 1}/{heroSkins.length}
                    </span>
                  </h3>
                  <ul>
                    {heroSkins.map((entry) => {
                      const active = skinId(entry) === skinId(skin)
                      return (
                        <li key={skinId(entry)}>
                          <button
                            ref={active ? activeThumb : undefined}
                            type="button"
                            className="wiki-skin-thumb"
                            aria-current={active || undefined}
                            aria-label={`${text("Xem", "View")} ${entry.name}`}
                            title={entry.name}
                            onClick={() => onMove(entry)}
                          >
                            <SkinArtwork skin={entry} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
              {previousHero && nextHero && (
                <nav className="wiki-skin-preview-heroes" aria-label={text("Chuyển tướng", "Switch hero")}>
                  <button type="button" onClick={() => onMove(previousHero)}>
                    <WikiIcon name="chevronLeft" size={16} />
                    <HeroHead skin={previousHero} />
                    <span>{previousHero.heroName}</span>
                  </button>
                  <button type="button" onClick={() => onMove(nextHero)}>
                    <span>{nextHero.heroName}</span>
                    <HeroHead skin={nextHero} />
                    <WikiIcon name="chevronRight" size={16} />
                  </button>
                </nav>
              )}
              {canStep && (
                <p className="wiki-skin-preview-hint">
                  {text("Dùng phím ← → để xem tiếp", "Use the ← → keys to keep browsing")}
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
