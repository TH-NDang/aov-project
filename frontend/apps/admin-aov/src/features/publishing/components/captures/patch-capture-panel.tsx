import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react"
import { AlertTriangle, Images, PanelRightClose, PanelRightOpen, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { cn } from "@aov/ui/lib/utils"
import {
  CAPTURE_ZOOM_STEP,
  captureBoxZoom,
  captureCardZoom,
  captureFit,
  captureFocusBox,
  captureGroupTarget,
  captureRegions,
  captureSha256,
  zoomCaptureAt,
  type CaptureGroup,
  type CaptureImage,
  type CaptureRegion,
  type CaptureZoom,
} from "../../model/captures/patch-capture-model"
import { captureStateMessage } from "../../model/captures/capture-panel-model"
import type { PatchCaptureWorkspace } from "../../api/use-patch-captures"
import { useSourceUrls } from "../../../files/source-links"
import { CaptureDetails } from "./capture-details"
import { CaptureResizeHandle } from "./capture-resize-handle"
import { CaptureThumbnails } from "./capture-thumbnails"
import { CaptureViewer } from "./capture-viewer"
import { CaptureZoomBar } from "./capture-zoom-bar"
import { useCaptureSize } from "./use-capture-size"

/**
 * Sits beside the hero page rather than over it, so the entered data stays readable and editable while comparing. Arrow
 * and zoom keys only act with focus inside the panel, so typing in the editor never moves the picture.
 */
export function PatchCapturePanel({ captures }: { captures: PatchCaptureWorkspace }) {
  const { state, patchCode, viewedPatchCode, otherPatches, groups, activeKey, imageId, focusRequest } = captures
  const panel = useRef<HTMLElement>(null)
  const { size, wide, dragTo, keepSize, resetWidth, resetHeight, toggleWide } = useCaptureSize(panel)
  const [zoom, setZoom] = useState<CaptureZoom>(captureFit)
  const frame = useRef<HTMLDivElement>(null)
  const thumbnails = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusRequest) panel.current?.focus({ preventScroll: true })
  }, [focusRequest])
  // Without a patch set the item being viewed may have no group, and only the shop's are left to show.
  const group = groups.find((item) => item.key === activeKey) ?? (state.status === "ready" ? undefined : groups[0])
  const image = group?.images.find((item) => item.id === imageId) ?? group?.images[0]
  const imageKey = image?.id
  const imageBox = image?.box
  // The picture's own size, known once it has loaded; the parts of a game screen are measured against it.
  const [natural, setNatural] = useState<{ id: string; width: number; height: number } | null>(null)
  const picture = natural && natural.id === imageKey ? natural : null
  const focusBox = image && picture ? captureFocusBox(image, picture) : null
  const regions = image ? captureRegions(image, captures.skills, captures.locale, picture) : []
  const zoomToFocus = (box = focusBox, shape: { width: number; height: number } | null = picture) => {
    const bounds = frame.current?.getBoundingClientRect()
    if (box && shape && bounds) setZoom(captureBoxZoom(box, shape, bounds.width, bounds.height))
  }
  useEffect(() => {
    const bounds = frame.current?.getBoundingClientRect()
    setZoom(imageBox && bounds ? captureCardZoom(imageBox, bounds.width, bounds.height) : captureFit)
    thumbnails.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
  }, [imageKey, imageBox])
  // Opens the panel on a group, and the page on what that group is the source of.
  const open = (next: CaptureGroup, member?: CaptureImage) => {
    const target = captureGroupTarget(next, captures.skills, member ?? next.images[0])
    if (target) captures.go(target, member?.id)
    else captures.select(next.key, member?.id)
  }
  const pick = (region: CaptureRegion) =>
    // A part that belongs to the picture already open keeps it, so ratings on a skill screen do not swap the picture.
    captures.go(region.target, region.target.group === group?.key ? image?.id : undefined)
  const applyZoom = useCallback((update: (zoom: CaptureZoom, width: number, height: number) => CaptureZoom) => {
    const bounds = frame.current?.getBoundingClientRect()
    setZoom((current) => update(current, bounds?.width ?? 0, bounds?.height ?? 0))
  }, [])
  const stepZoom = (factor: number) =>
    applyZoom((current, width, height) =>
      zoomCaptureAt(current, current.scale * factor, { x: width / 2, y: height / 2 }, width, height),
    )
  const sequence = groups.flatMap((item) => item.images.map((member) => ({ group: item, image: member })))
  const position = image ? sequence.findIndex((item) => item.image.id === image.id) : -1
  const step = (offset: number) => {
    const target = position >= 0 ? sequence[position + offset] : offset > 0 ? sequence[0] : sequence.at(-1)
    if (!target) return
    // Moving into another group, or onto another skin, takes the page along; more pictures of one item do not.
    if (target.group.key !== group?.key || target.image.skinKey) open(target.group, target.image)
    else captures.select(target.group.key, target.image.id)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    const actions: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      "+": () => stepZoom(CAPTURE_ZOOM_STEP),
      "=": () => stepZoom(CAPTURE_ZOOM_STEP),
      "-": () => stepZoom(1 / CAPTURE_ZOOM_STEP),
      "0": () => setZoom(captureFit),
    }
    const action = actions[event.key]
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    action()
  }
  // The open group's pictures go out as one request, so moving through the strip never waits for a link.
  const urls = useSourceUrls(group?.images.map(captureSha256) ?? [])
  const url = image ? urls.url(captureSha256(image)) : undefined
  const message = group?.shop ? null : captureStateMessage(state, patchCode)
  return (
    <aside
      ref={panel}
      tabIndex={-1}
      aria-label="Ảnh gốc của tướng"
      onKeyDown={onKeyDown}
      style={{ "--capture-width": `${size.width}%`, "--capture-height": `${size.height}dvh` } as CSSProperties}
      className={cn(
        "relative flex h-(--capture-height) min-h-0 w-full min-w-0 shrink-0 flex-col border-t bg-background outline-none",
        "@5xl/hero-split:h-full @5xl/hero-split:w-(--capture-width) @5xl/hero-split:border-t-0 @5xl/hero-split:border-l",
      )}
    >
      <CaptureResizeHandle
        direction="width"
        value={size.width}
        min={30}
        max={75}
        className="hidden @5xl/hero-split:flex"
        onChange={dragTo}
        onCommit={keepSize}
        onReset={resetWidth}
      />
      <CaptureResizeHandle
        direction="height"
        value={size.height}
        min={25}
        max={80}
        className="@5xl/hero-split:hidden"
        onChange={dragTo}
        onCommit={keepSize}
        onReset={resetHeight}
      />
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <Images className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="type-label truncate">
            {group?.shop
              ? `Ảnh gốc · cửa hàng${image?.capturedOn ? ` ${formatCalendarDate(image.capturedOn)}` : ""}`
              : `Ảnh gốc · patch ${patchCode ?? "chưa rõ"}`}
          </h2>
          {groups.length > 0 && (
            <p className="type-meta truncate">
              {sequence.length ? `${position + 1 || "–"}/${sequence.length} ảnh của tướng` : "Tướng này không có ảnh"}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="@max-5xl/hero-split:hidden"
          aria-pressed={wide}
          aria-label={wide ? "Thu hẹp khung ảnh" : "Mở rộng khung ảnh"}
          title={wide ? "Thu hẹp khung ảnh" : "Mở rộng khung ảnh"}
          onClick={toggleWide}
        >
          {wide ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Đóng khung ảnh gốc"
          title="Đóng khung ảnh gốc"
          onClick={captures.close}
        >
          <X />
        </Button>
      </header>
      {message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="type-body m-3 rounded-lg border border-dashed p-4 text-center text-muted-foreground"
        >
          {message}
        </p>
      )}
      {otherPatches.length > 0 && (
        <div className="mx-3 mb-3 space-y-2 text-center">
          <p className="type-meta">Có thể mở bộ ảnh của patch khác, nhưng ảnh đó không phải nguồn của bản đang xem.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {otherPatches.map((patch) => (
              <Button key={patch} type="button" variant="outline" size="sm" onClick={() => captures.choosePatch(patch)}>
                <Images />
                Xem bộ ảnh patch {patch}
              </Button>
            ))}
          </div>
        </div>
      )}
      {state.status === "ready" && viewedPatchCode !== patchCode && !group?.shop && (
        <p role="note" className="flex shrink-0 gap-2 border-b bg-(--aov-warning-soft) px-3 py-2 text-xs leading-5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-(--aov-warning)" />
          Bản đang xem thuộc patch {viewedPatchCode ?? "chưa rõ"}; các ảnh này của patch {patchCode}.
        </p>
      )}
      {groups.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div role="group" aria-label="Chọn mục cần xem ảnh" className="flex flex-wrap gap-1 px-3 py-2">
            {groups.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={item.key === group?.key}
                title={`${item.title} · ${item.images.length} ảnh`}
                className={cn(
                  "inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.key === group?.key
                    ? "border-primary/40 bg-primary/8 font-medium"
                    : "border-transparent bg-muted/40 hover:bg-muted",
                  !item.images.length && item.key !== activeKey && "text-muted-foreground",
                )}
                onClick={() => open(item)}
              >
                {item.label}
                <span className="tabular-nums text-muted-foreground">{item.images.length}</span>
              </button>
            ))}
          </div>
          {group && image ? (
            <>
              <CaptureViewer
                key={image.id}
                image={image}
                url={url}
                failed={urls.failed(captureSha256(image))}
                onExpired={() => urls.retry(captureSha256(image))}
                title={`${group.title} · ${image.fileName}`}
                frame={frame}
                zoom={zoom}
                onZoom={applyZoom}
                onPrevious={position > 0 ? () => step(-1) : undefined}
                onNext={position < sequence.length - 1 ? () => step(1) : undefined}
                regions={regions}
                natural={picture}
                onReady={(loaded) => {
                  setNatural({ id: image.id, ...loaded })
                  // A game screen opens on the part worth reading; a shop card keeps its own framing.
                  if (!image.box) zoomToFocus(captureFocusBox(image, loaded), loaded)
                }}
                onRegion={pick}
              />
              <CaptureZoomBar
                zoom={zoom}
                onStep={stepZoom}
                onFocus={focusBox ? () => zoomToFocus() : undefined}
                onFit={() => setZoom(captureFit)}
              />
              {group.images.length > 1 && (
                <CaptureThumbnails
                  group={group}
                  image={image}
                  stripRef={thumbnails}
                  urlOf={(member) => urls.url(captureSha256(member))}
                  onPick={(member) => (member.skinKey ? open(group, member) : captures.select(group.key, member.id))}
                />
              )}
              <CaptureDetails group={group} image={image} url={url} />
            </>
          ) : (
            <p
              role="status"
              className="type-body mx-3 mb-3 rounded-lg border border-dashed p-6 text-center text-muted-foreground"
            >
              {group?.empty ?? "Không có ảnh gốc cho mục này."}
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
