import { useEffect, useEffectEvent, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CircleHelp, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Kbd } from "@aov/ui/components/kbd"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { cn } from "@aov/ui/lib/utils"
import type { LightboxImage } from "@/components/image-lightbox"
import { AdminEntityText } from "../../../terminology/catalog"
import { ImageCreditPanel } from "../../../media/components/library/image-credit-panel"
import { MediaCode } from "../../../media/components/library/media-code"
import { visibleSources } from "../../../media/model/media-source-gaps"
import { useSkinBadge } from "../../../media/components/badges/skin-badge-label"
import { HeroAsset } from "../editing/hero-asset"
import { heroContentAssetQuery } from "../../model/assets/hero-content-asset"
import { patchHeroLocation } from "../../model/hero-location"
import {
  readingVoucherPrice,
  SkinAcquisitionEditor,
  SkinAcquisitionSummary,
  skinAcquisitionDraft,
  skinIsUnknown,
  skinNeedsReview,
  useHeroShop,
  type SkinAcquisitionDraft,
  type SkinWorkFilter,
} from "./hero-shop"
import { translatedText, sectionTextFields, type TranslationTarget } from "../../model/hero-translation-model"
import { HeroTranslationNotice } from "../workspace/hero-translation-notice"
import { ImageCreditSummary } from "../assets/image-credit-summary"
import {
  captureGroupKeys,
  captureLinkLabels,
  captureSha256,
  type CaptureImage,
} from "../../model/captures/patch-capture-model"
import { CaptureCardThumbnail } from "../captures/capture-thumbnails"
import { PatchCaptureLink } from "../captures/patch-capture-buttons"
import type { SkinAcquisition } from "@/lib/api/publishing-api"
import type { Skin } from "@/lib/hero-types"
import { usePatchCaptureContext } from "../../api/use-patch-captures"
import { useSourceUrls } from "../../../files/source-links"
import { formatGameNumber } from "@aov/ui/lib/game-number"

/** Arrow keys belong to the form while the editor is in it. */
const insideForm = (target: EventTarget) => target instanceof HTMLElement && !!target.closest("form")

/**
 * Laid out like the public hero page: one large image and a rail of the other skins. Everything an editor does per skin
 * sits beside it, so the form stays in view while moving through skins. Narrower columns, as when the screenshot panel
 * is open, put the rail on top and the form under a smaller image for the same reason.
 */
export function HeroSkinsView({
  skins,
  locale,
  heroId,
  canWrite,
  busy,
  onTranslate,
  onEditSkin,
  editSkinLabel,
}: {
  /** Opens the skin editor on one skin; absent when nobody may edit here. */
  onEditSkin?: (skinKey: string) => void
  /** Why the pencil waits, when it does. */
  editSkinLabel?: (name: string) => string
  skins: readonly Skin[]
  locale: string
  heroId?: string
  canWrite: boolean
  busy: boolean
  onTranslate?: (target: TranslationTarget) => void
}) {
  const client = useQueryClient()
  const shop = useHeroShop(heroId)
  const captures = usePatchCaptureContext()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<SkinWorkFilter>("all")
  const [drafts, setDrafts] = useState<Record<string, SkinAcquisitionDraft>>({})
  // The acquisition form opens on request and stays open while stepping through skins with "save and next".
  const [editingPrice, setEditingPrice] = useState(false)
  const rail = useRef<HTMLDivElement>(null)
  const activeThumb = useRef<HTMLButtonElement>(null)
  const refocusThumb = useRef(false)

  const ordered = useMemo(() => [...skins].sort((a, b) => a.displayOrder - b.displayOrder), [skins])
  const rows = shop.data?.skins ?? []
  const rowOf = (key: string) => rows.find((row) => row.skinKey === key)
  const matching = ordered.filter((skin) => {
    const row = rowOf(skin.skinKey)
    return filter === "all" || (filter === "review" ? skinNeedsReview(row) : skinIsUnknown(row))
  })
  // Finishing the last skin of a filter returns to all of them rather than to an empty tab.
  const list = matching.length ? matching : ordered
  const shownFilter = matching.length ? filter : "all"
  const requested = params.get("skin")
  const index = Math.max(
    0,
    list.findIndex((skin) => skin.skinKey === requested),
  )
  const selected = list[index]
  const select = (key: string) =>
    setParams((current) => patchHeroLocation(current, { skin: key }), { replace: true, preventScrollReset: true })
  const move = (delta: number) => select(list[(index + delta + list.length) % list.length].skinKey)
  const selectedKey = selected?.skinKey
  const previous = list[(index - 1 + list.length) % list.length]
  const next = list[index + 1]

  const ownCaptures = selectedKey
    ? (captures?.groups
        .find((group) => group.key === captureGroupKeys.skins)
        ?.images.filter((image) => image.skinKey === selectedKey) ?? [])
    : []
  const firstCapture = ownCaptures[0]?.id
  const panelOpen = !!captures?.open
  // An open panel follows the skin, without taking the keyboard from the form. Only a new skin or a newly opened panel
  // moves the picture; choosing another card by hand must stick.
  const showCapture = useEffectEvent((imageId: string) => captures?.select(captureGroupKeys.skins, imageId))
  useEffect(() => {
    if (panelOpen && firstCapture) showCapture(firstCapture)
  }, [panelOpen, firstCapture])

  useEffect(() => {
    const thumb = activeThumb.current
    if (!thumb?.parentElement) return
    thumb.parentElement.scrollTo?.({
      left: thumb.offsetLeft - (thumb.parentElement.clientWidth - thumb.offsetWidth) / 2,
    })
    if (refocusThumb.current) thumb.focus({ preventScroll: true })
    refocusThumb.current = false
  }, [selectedKey, shownFilter])

  // Stepping through skins should not flash an empty stage, so the neighbours' pictures are fetched ahead.
  const nextImage = (next ?? list[0])?.artAssetId
  const previousImage = previous?.artAssetId
  useEffect(() => {
    for (const id of [nextImage, previousImage]) {
      if (!id) continue
      void client
        .fetchQuery(heroContentAssetQuery(id))
        .then((asset) => {
          if (asset.currentUrl) new Image().src = asset.currentUrl
        })
        .catch(() => {})
    }
  }, [client, nextImage, previousImage])

  if (!selected) return null

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key !== "ArrowLeft" && event.key !== "ArrowRight") || insideForm(event.target) || list.length < 2) return
    event.preventDefault()
    refocusThumb.current = rail.current?.contains(event.target as Node) ?? false
    move(event.key === "ArrowRight" ? 1 : -1)
  }
  const text = (skin: Skin) => translatedText(skin.translations, locale, sectionTextFields.SKINS)
  const selectedText = text(selected)
  const selectedName = selectedText?.name || selected.skinKey
  const value = rowOf(selected.skinKey)
  const changeDraft = (draft: SkinAcquisitionDraft | null) =>
    setDrafts(({ [selected.skinKey]: _dropped, ...others }) =>
      draft ? { ...others, [selected.skinKey]: draft } : others,
    )
  const missing = [!selected.artAssetId && "ảnh nền", !selected.portraitAssetId && "chân dung"].filter(Boolean)

  return (
    <div className="@container/skin-tab min-w-0 space-y-3" onKeyDown={onKeyDown}>
      {heroId && (
        <SkinAcquisitionSummary rows={rows} total={ordered.length} filter={shownFilter} onFilter={setFilter} />
      )}
      <div
        className={cn(
          "grid min-w-0 gap-3 [grid-template-areas:'stage'_'rail'_'identity'_'compare'_'editor']",
          "@min-[480px]/skin-tab:grid-cols-2 @min-[480px]/skin-tab:grid-rows-[auto_auto_1fr_auto] @min-[480px]/skin-tab:[grid-template-areas:'rail_rail'_'stage_identity'_'stage_compare'_'editor_editor']",
          "@min-[900px]/skin-tab:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @min-[900px]/skin-tab:grid-rows-none @min-[900px]/skin-tab:gap-5 @min-[900px]/skin-tab:[grid-template-areas:none]",
        )}
      >
        <div className="contents @min-[900px]/skin-tab:block @min-[900px]/skin-tab:min-w-0 @min-[900px]/skin-tab:space-y-3">
          <SkinStage
            skin={selected}
            name={selectedName}
            locale={locale}
            position={list.length > 1 ? `${index + 1}/${list.length}` : null}
            onPrevious={list.length > 1 ? () => move(-1) : undefined}
            onNext={list.length > 1 ? () => move(1) : undefined}
          />
          <div className="min-w-0 [grid-area:rail]">
            {list.length > 1 && (
              <div
                ref={rail}
                role="group"
                aria-label="Chọn trang phục"
                className="relative flex gap-2 overflow-x-auto p-0.5 [scrollbar-width:thin]"
              >
                {list.map((skin) => {
                  const active = skin.skinKey === selected.skinKey
                  const name = text(skin)?.name || skin.skinKey
                  const row = rowOf(skin.skinKey)
                  const review = skinNeedsReview(row)
                  const unknown = !!heroId && skinIsUnknown(row)
                  const unsaved = !!drafts[skin.skinKey]
                  const states = [unsaved && "chưa lưu", review && "cần xem lại", unknown && "chưa rõ cách nhận"]
                    .filter(Boolean)
                    .join(", ")
                  return (
                    <button
                      key={skin.skinKey}
                      ref={active ? activeThumb : undefined}
                      type="button"
                      aria-current={active || undefined}
                      aria-label={`Xem ${name}${states ? ` (${states})` : ""}`}
                      title={states ? `${name} · ${states}` : name}
                      tabIndex={active ? 0 : -1}
                      className={cn(
                        "relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-md bg-muted/40 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring @min-[480px]/skin-tab:w-11 @min-[900px]/skin-tab:w-[60px]",
                        // No frame around the pictures: the chosen one is marked by a ring, the others are dimmed.
                        active ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
                      )}
                      onClick={() => select(skin.skinKey)}
                    >
                      <HeroAsset
                        id={skin.portraitAssetId ?? skin.artAssetId}
                        className="size-full rounded-none border-0"
                      />
                      <SkinThumbMark unsaved={unsaved} review={review} unknown={unknown} />
                    </button>
                  )
                })}
              </div>
            )}
            {list.length > 1 && (
              <p className="type-meta mt-1 hidden @min-[900px]/skin-tab:block">
                <Kbd>←</Kbd> <Kbd>→</Kbd> chuyển trang phục khi không gõ trong ô nhập
              </p>
            )}
          </div>
        </div>
        <div className="contents @min-[900px]/skin-tab:block @min-[900px]/skin-tab:min-w-0 @min-[900px]/skin-tab:space-y-4">
          <div className="min-w-0 space-y-1 [grid-area:identity]">
            <div className="flex items-start gap-2">
              <h4 className="type-section-title min-w-0 flex-1 break-words">{selectedName}</h4>
              <HeroTranslationNotice
                rows={selected.translations}
                locale={locale}
                fields={sectionTextFields.SKINS}
                section="SKINS"
                entryKey={selected.skinKey}
                onTranslate={onTranslate}
                disabled={busy}
              />
              <PatchCaptureLink groupKey={captureGroupKeys.skins} skinKey={selected.skinKey} name={selectedName} />
              {onEditSkin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={editSkinLabel?.(selectedName) ?? `Chỉnh sửa trang phục ${selectedName}`}
                  title={editSkinLabel?.(selectedName) ?? `Chỉnh sửa trang phục ${selectedName}`}
                  disabled={busy}
                  onClick={() => onEditSkin(selected.skinKey)}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </div>
            <MediaCode value={selected.skinKey} label="Mã trang phục" plain />
            {/* The stage is too small for its caption beside the panel, so the tier moves here. */}
            <SkinTier
              code={selected.rarityCode}
              locale={locale}
              className="type-meta hidden @min-[480px]/skin-tab:flex @min-[900px]/skin-tab:hidden"
            />
            {missing.length > 0 && (
              <p className="type-meta flex items-center gap-1 text-(--aov-warning)">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                Thiếu {missing.join(" và ")}
                {/* The only place an editor learns the old head is still public. */}
                {!selected.portraitAssetId && selected.headAssetId && ", Wiki đang dùng ảnh head cũ thay chỗ này"}
              </p>
            )}
            {selectedText?.description && (
              <p className="type-meta line-clamp-3 break-words" title={selectedText.description}>
                <AdminEntityText text={selectedText.description} />
              </p>
            )}
            {selectedText?.acquisitionNote && (
              <p className="type-meta break-words">
                <AdminEntityText text={selectedText.acquisitionNote} />
              </p>
            )}
          </div>
          {heroId && captures && captures.groups.length > 0 && (
            <SkinCaptureCompare
              images={ownCaptures}
              value={value}
              draft={drafts[selected.skinKey]}
              canWrite={canWrite}
              onOpen={(imageId) => captures.reveal(captureGroupKeys.skins, imageId)}
              onFill={(price, capturedOn) => {
                setEditingPrice(true)
                changeDraft({
                  ...(drafts[selected.skinKey] ?? skinAcquisitionDraft(value)),
                  method: "VOUCHER",
                  voucherPrice: price.toString(),
                  ...(capturedOn ? { capturedOn } : {}),
                })
              }}
            />
          )}
          {heroId && (
            <div className="@container/skin-work min-w-0 rounded-xl border bg-card p-3 [grid-area:editor]">
              <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
                <h5 className="type-label">Cách nhận và giá</h5>
                {canWrite && !editingPrice && !drafts[selected.skinKey] && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="Chỉnh sửa cách nhận và giá"
                    title="Chỉnh sửa cách nhận và giá"
                    disabled={busy}
                    onClick={() => setEditingPrice(true)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </div>
              <SkinAcquisitionEditor
                key={selected.skinKey}
                heroId={heroId}
                skinKey={selected.skinKey}
                value={value}
                history={shop.data?.skinHistory.filter((row) => row.skinKey === selected.skinKey)}
                canWrite={canWrite}
                draft={drafts[selected.skinKey]}
                onDraftChange={changeDraft}
                nextName={next ? text(next)?.name || next.skinKey : undefined}
                onNext={next ? () => select(next.skinKey) : undefined}
                editing={editingPrice}
                onEditingChange={setEditingPrice}
              />
            </div>
          )}
        </div>
      </div>
      <ImageCreditSummary
        label="ảnh trang phục"
        assetIds={ordered.flatMap((skin) => [skin.artAssetId, skin.portraitAssetId])}
      />
    </div>
  )
}

function SkinThumbMark({ unsaved, review, unknown }: { unsaved: boolean; review: boolean; unknown: boolean }) {
  const Icon = unsaved ? Pencil : review ? AlertTriangle : unknown ? CircleHelp : null
  if (!Icon) return null
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full shadow-sm",
        unsaved
          ? "bg-primary text-primary-foreground"
          : review
            ? "bg-(--aov-warning) text-white"
            : "bg-background text-muted-foreground",
      )}
    >
      <Icon className="size-2.5" />
    </span>
  )
}

function SkinTier({ code, locale, className }: { code: string | null; locale: string; className?: string }) {
  const { result, badge } = useSkinBadge(code, locale)
  const icon = useQuery({ ...heroContentAssetQuery(badge?.iconAssetId ?? ""), enabled: !!badge?.iconAssetId }).data
    ?.currentUrl
  const name = badge?.displayName && badge.displayName !== badge.code ? badge.displayName : null
  const tier = name ?? (code && !result.isPending ? code : null)
  if (!tier) return null
  return (
    <span className={cn("items-center gap-1.5", className)}>
      {icon && <img src={icon} alt="" className="h-5 w-auto object-contain" />}
      <span className="truncate">{tier}</span>
    </span>
  )
}

/** The cover over a blurred copy of itself, so pictures of any shape fill the same stage without moving the page. */
function SkinStage({
  skin,
  name,
  locale,
  position,
  onPrevious,
  onNext,
}: {
  skin: Skin
  name: string
  locale: string
  position: string | null
  onPrevious?: () => void
  onNext?: () => void
}) {
  const roles = [
    ["art", skin.artAssetId, "Ảnh nền"],
    ["portrait", skin.portraitAssetId, "Chân dung"],
  ] as const
  const assets = useQueries({
    queries: roles.map(([, id]) => ({ ...heroContentAssetQuery(id ?? ""), enabled: !!id })),
  })
  // The arrows of the large view move between the skin's own images.
  const images: LightboxImage[] = []
  roles.forEach(([, , label], order) => {
    const asset = assets[order].data
    if (!asset?.currentUrl) return
    const sources = visibleSources(currentMediaSources(asset.provenance ?? [], asset.currentVersionId))
    images.push({
      path: asset.currentUrl,
      title: `${name} · ${label}`,
      meta: <ImageCreditPanel sources={sources} assetId={asset.id} />,
    })
  })
  // A cover is close to the frame and fills it, cropping a sliver; the large view still shows all of it. A portrait
  // standing in for a missing cover is far narrower, so it stays whole over a blurred copy of itself.
  const cover = !!skin.artAssetId
  const backdrop = cover ? undefined : assets[1].data?.currentUrl

  return (
    <div className="relative isolate aspect-video min-w-0 overflow-hidden rounded-xl bg-muted self-start [grid-area:stage]">
      {/* The blurred copy reaches past the frame, so the blur never fades to an empty edge. */}
      {backdrop && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={backdrop}
            alt=""
            className="absolute -top-12 -left-12 h-[calc(100%+6rem)] w-[calc(100%+6rem)] max-w-none object-cover blur-2xl saturate-150"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}
      <HeroAsset
        id={skin.artAssetId ?? skin.portraitAssetId}
        alt={`${name} · Ảnh nền`}
        className="absolute inset-0 size-full rounded-none border-0 bg-transparent"
        frameAspectRatio={cover ? undefined : 16 / 9}
        preview
        gallery={images.length ? { images, index: 0 } : undefined}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end gap-3 bg-gradient-to-t from-black/85 to-transparent px-3 pt-8 pb-2 text-white @min-[480px]/skin-tab:hidden @min-[900px]/skin-tab:flex @min-[900px]/skin-tab:px-4 @min-[900px]/skin-tab:pb-3">
        <div className="grid min-w-0 gap-0.5 pr-8">
          <strong className="type-section-title truncate">{name}</strong>
          <SkinTier code={skin.rarityCode} locale={locale} className="type-meta flex text-white/85" />
        </div>
      </div>
      {position && (
        <span className="type-meta pointer-events-none absolute top-2 left-2 z-10 rounded-md bg-black/60 px-1.5 text-white tabular-nums">
          {position}
        </span>
      )}
      {onPrevious && onNext && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-1/2 left-2 z-20 size-8 -translate-y-1/2 rounded-full"
            aria-label="Trang phục trước"
            onClick={onPrevious}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-1/2 right-2 z-20 size-8 -translate-y-1/2 rounded-full"
            aria-label="Trang phục sau"
            onClick={onNext}
          >
            <ChevronRight />
          </Button>
        </>
      )}
    </div>
  )
}

/**
 * The shop card next to the form, so a price can be checked without opening the panel. Only prices compare by machine;
 * an event name or a locked card is left to the editor's eye.
 */
function SkinCaptureCompare({
  images,
  value,
  draft,
  canWrite,
  onOpen,
  onFill,
}: {
  images: CaptureImage[]
  value?: SkinAcquisition
  draft?: SkinAcquisitionDraft
  canWrite: boolean
  onOpen: (imageId: string) => void
  onFill: (price: number, capturedOn: string | undefined) => void
}) {
  const urls = useSourceUrls(images.map(captureSha256))
  if (!images.length)
    return (
      <p className="type-meta rounded-lg bg-muted/40 px-3 py-2 [grid-area:compare]">
        Ảnh cửa hàng chưa có trang phục này để đối chiếu.
      </p>
    )
  const saved =
    (draft ?? value)?.method === "VOUCHER"
      ? draft
        ? Number(draft.voucherPrice || Number.NaN)
        : (value?.voucherPrice ?? Number.NaN)
      : Number.NaN
  return (
    <ul className="grid min-w-0 gap-1 [grid-area:compare]" aria-label="Đối chiếu với ảnh cửa hàng">
      {images.map((image) => {
        const read = readingVoucherPrice(image.reading)
        const same = read !== null && read === saved
        return (
          <li key={image.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/40 p-2">
            <button
              type="button"
              className="shrink-0 overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Mở ảnh gốc ${image.entryName ?? image.fileName}`}
              title="Mở trong khung Ảnh gốc"
              onClick={() => onOpen(image.id)}
            >
              {image.box ? (
                <CaptureCardThumbnail
                  url={urls.url(captureSha256(image))}
                  box={image.box}
                  className="w-8 @min-[900px]/skin-tab:w-12"
                />
              ) : (
                <span className="type-meta block w-12 p-1 text-center">Mở ảnh</span>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="type-meta truncate" title={captureLinkLabels[image.link]}>
                Cửa hàng{image.capturedOn ? ` ${formatCalendarDate(image.capturedOn)}` : ""}
              </p>
              <p className="type-section-title truncate" title={image.reading}>
                {image.reading || "Không đọc được nội dung"}
              </p>
            </div>
            {read !== null &&
              (same ? (
                <span className="type-meta inline-flex shrink-0 items-center gap-1 text-(--aov-success)">
                  <Check className="size-3.5" aria-hidden="true" />
                  Khớp
                </span>
              ) : (
                canWrite && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="shrink-0"
                    title={`Điền ${formatGameNumber(read)} quân huy vào ô giá`}
                    onClick={() => onFill(read, image.capturedOn)}
                  >
                    Điền theo ảnh
                  </Button>
                )
              ))}
          </li>
        )
      })}
    </ul>
  )
}
