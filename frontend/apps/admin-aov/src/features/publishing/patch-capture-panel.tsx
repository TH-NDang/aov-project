import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Images,
  Maximize,
  PanelRightClose,
  PanelRightOpen,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Kbd } from "@aov/ui/components/kbd"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { cn } from "@aov/ui/lib/utils"
import { CopyButton } from "@/components/copy-button"
import {
  CAPTURE_MAX_SCALE,
  captureCardZoom,
  captureFit,
  captureImageTitle,
  captureImageUrl,
  captureLinkHints,
  captureLinkLabels,
  clampCaptureZoom,
  zoomCaptureAt,
  type CaptureGroup,
  type CaptureImage,
  type CaptureZoom,
} from "./patch-capture-model"
import { usePatchCaptureContext, type CaptureState, type PatchCaptureWorkspace } from "./use-patch-captures"

const ZOOM_STEP = 1.25
const SIZE_KEY = "aov-admin:hero-capture-size"
/** Width as a percentage of the split and height as dvh, so a saved size still fits another window. */
const defaultSize = { width: 50, height: 52 }
const clampWidth = (value: number) => Math.round(Math.min(75, Math.max(30, value)))
const clampHeight = (value: number) => Math.round(Math.min(80, Math.max(25, value)))

function readSize() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIZE_KEY) ?? "{}") as Partial<typeof defaultSize>
    return {
      width: clampWidth(typeof saved.width === "number" ? saved.width : defaultSize.width),
      height: clampHeight(typeof saved.height === "number" ? saved.height : defaultSize.height),
    }
  } catch {
    return defaultSize
  }
}

function saveSize(size: typeof defaultSize) {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify(size))
  } catch {
    /* The size still lasts for this page. */
  }
}

/** The edge the panel shares with the page. Beside the page it moves sideways; under it, up and down. */
function CaptureResizeHandle({
  direction,
  value,
  min,
  max,
  onChange,
  onCommit,
  onReset,
  className,
}: {
  direction: "width" | "height"
  value: number
  min: number
  max: number
  onChange: (point: { x: number; y: number }) => void
  onCommit: () => void
  onReset: () => void
  className: string
}) {
  const [dragging, setDragging] = useState(false)
  const label = direction === "width" ? "Kéo để đổi độ rộng khung ảnh" : "Kéo để đổi chiều cao khung ảnh"
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      title={`${label} · bấm đúp để về cỡ ban đầu`}
      aria-orientation={direction === "width" ? "vertical" : "horizontal"}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      data-dragging={dragging || undefined}
      className={cn(
        "group/handle absolute z-20 flex touch-none items-center justify-center outline-none select-none",
        direction === "width"
          ? "inset-y-0 -left-1.5 w-3 cursor-col-resize"
          : "inset-x-0 -top-1.5 h-3 cursor-row-resize",
        className,
      )}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (dragging) onChange({ x: event.clientX, y: event.clientY })
      }}
      onPointerUp={() => {
        setDragging(false)
        onCommit()
      }}
      onPointerCancel={() => {
        setDragging(false)
        onCommit()
      }}
      onDoubleClick={onReset}
    >
      <span
        aria-hidden="true"
        className={cn(
          "rounded-full bg-border transition-colors group-hover/handle:bg-primary group-focus-visible/handle:bg-primary group-data-dragging/handle:bg-primary",
          direction === "width" ? "h-10 w-1" : "h-1 w-10",
        )}
      />
    </div>
  )
}

/** Header toggle for the whole panel; hidden where the capture endpoint does not exist. */
export function PatchCaptureToggle() {
  const captures = usePatchCaptureContext()
  if (!captures || captures.state.status === "idle" || captures.state.status === "unavailable") return null
  const count = captures.groups.length ? captures.groups.flatMap((group) => group.images).length : null
  const label = captures.open ? "Đóng khung ảnh gốc" : "Mở khung ảnh gốc của tướng"
  return (
    <Button
      type="button"
      variant={captures.open ? "secondary" : "outline"}
      size="sm"
      className="shrink-0"
      aria-pressed={captures.open}
      aria-label={label}
      title={label}
      onClick={captures.toggle}
    >
      <Images className="size-4" />
      <span className="@max-5xl:sr-only">Ảnh gốc</span>
      {count !== null && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </Button>
  )
}

/** Sits beside one item so its own screenshots are a single click away; says so plainly when there are none. */
export function PatchCaptureLink({ groupKey, name, skinKey }: { groupKey: string; name: string; skinKey?: string }) {
  const captures = usePatchCaptureContext()
  const group = captures?.groups.find((item) => item.key === groupKey)
  if (!captures || !group) return null
  const own = skinKey ? group.images.filter((image) => image.skinKey === skinKey) : group.images
  const count = own.length
  const label = count ? `Xem ${count} ảnh gốc của ${name}` : `${name} không có ảnh gốc`
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="shrink-0 text-muted-foreground"
      aria-label={label}
      title={label}
      onClick={() => captures.reveal(groupKey, own[0]?.id)}
    >
      <Images />
      {count ? <span className="tabular-nums">{count}</span> : "Không có ảnh"}
    </Button>
  )
}

function stateMessage(state: CaptureState, patchCode: string | undefined) {
  switch (state.status) {
    case "loading":
      return "Đang tìm ảnh gốc của tướng…"
    case "no-patch":
      return patchCode
        ? `Patch ${patchCode} chưa có bộ ảnh gốc.`
        : "Bản đang xem chưa gắn patch, nên không xác định được bộ ảnh gốc."
    case "no-hero":
      return state.heroCode
        ? `Bộ ảnh patch ${patchCode} không có tướng “${state.heroCode}”.`
        : "Không xác định được mã của tướng này nên không nối được với bộ ảnh."
    case "error":
      return state.message
    default:
      return null
  }
}

/** Dims everything but the card, in the picture's own coordinates so it fits and zooms exactly as the picture does. */
function CaptureCardMark({ box, zoom }: { box: NonNullable<CaptureImage["box"]>; zoom: CaptureZoom }) {
  const { x, y, width, height, imageWidth, imageHeight } = box
  return (
    <svg
      data-testid="capture-card-mark"
      aria-hidden="true"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      className="pointer-events-none absolute inset-0 size-full origin-top-left"
      style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}
    >
      <path
        fill="rgb(0 0 0 / 0.5)"
        fillRule="evenodd"
        d={`M0 0H${imageWidth}V${imageHeight}H0Z M${x} ${y}H${x + width}V${y + height}H${x}Z`}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Shows only the card, since a row of whole shop screens would all look the same at this size. */
export function CaptureCardThumbnail({
  url,
  box,
  className = "w-16",
}: {
  url: string
  box: NonNullable<CaptureImage["box"]>
  className?: string
}) {
  return (
    <span
      className={cn("relative block overflow-hidden bg-muted", className)}
      style={{ aspectRatio: box.width / box.height }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute max-w-none"
        style={{
          width: `${(box.imageWidth / box.width) * 100}%`,
          height: `${(box.imageHeight / box.height) * 100}%`,
          left: `${(-box.x / box.width) * 100}%`,
          top: `${(-box.y / box.height) * 100}%`,
        }}
      />
    </span>
  )
}

function CaptureViewer({
  image,
  url,
  title,
  frame,
  zoom,
  onZoom,
  onPrevious,
  onNext,
}: {
  image: CaptureImage
  url: string
  title: string
  frame: RefObject<HTMLDivElement | null>
  zoom: CaptureZoom
  onZoom: (update: (zoom: CaptureZoom, width: number, height: number) => CaptureZoom) => void
  onPrevious?: () => void
  onNext?: () => void
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [drag, setDrag] = useState<{ pointer: number; x: number; y: number } | null>(null)
  const point = (clientX: number, clientY: number) => {
    const bounds = frame.current!.getBoundingClientRect()
    return { x: clientX - bounds.left, y: clientY - bounds.top }
  }
  // React's wheel listener is passive, and the page behind must not scroll while zooming.
  useEffect(() => {
    const element = frame.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      const at = point(event.clientX, event.clientY)
      onZoom((current, width, height) => zoomCaptureAt(current, current.scale * factor, at, width, height))
    }
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  }, [frame, onZoom])
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (zoom.scale === 1 || event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ pointer: event.pointerId, x: event.clientX - zoom.x, y: event.clientY - zoom.y })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointer !== event.pointerId) return
    onZoom((current, width, height) =>
      clampCaptureZoom({ ...current, x: event.clientX - drag.x, y: event.clientY - drag.y }, width, height),
    )
  }
  return (
    <div
      ref={frame}
      data-testid="capture-frame"
      className={cn(
        "relative aspect-[20/9] max-h-[calc(var(--capture-height)-8.5rem)] w-full shrink-0 touch-none overflow-hidden bg-muted/60 select-none @5xl/hero-split:max-h-[60dvh]",
        zoom.scale > 1 ? (drag ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onDoubleClick={(event) => {
        const at = point(event.clientX, event.clientY)
        onZoom((current, width, height) =>
          current.scale > 1 ? captureFit : zoomCaptureAt(current, 2.5, at, width, height),
        )
      }}
    >
      <img
        src={url}
        alt={title}
        draggable={false}
        className="size-full origin-top-left object-contain"
        style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
      {image.box && status === "ready" && <CaptureCardMark box={image.box} zoom={zoom} />}
      {status === "loading" && (
        <p role="status" className="type-meta absolute inset-0 flex items-center justify-center p-4 text-center">
          {image.url ? "Đang mở ảnh gốc…" : "Đang mở ảnh gốc từ ZIP… Lần đầu mở mỗi bộ ZIP mất vài giây."}
        </p>
      )}
      {status === "error" && (
        <p
          role="alert"
          className="type-body absolute inset-0 flex items-center justify-center bg-muted p-4 text-center text-destructive"
        >
          Không đọc được ảnh gốc {image.fileName}.
        </p>
      )}
      {onPrevious && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full"
          aria-label="Ảnh trước"
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={onPrevious}
        >
          <ChevronLeft />
        </Button>
      )}
      {onNext && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
          aria-label="Ảnh sau"
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
      )}
    </div>
  )
}

function CaptureDetails({ group, image, url }: { group: CaptureGroup; image: CaptureImage; url: string }) {
  return (
    <div className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="type-label min-w-0 break-words">{captureImageTitle(group, image)}</h3>
        <Badge
          variant={image.link === "REVIEWED" ? "secondary" : "outline"}
          title={captureLinkHints[image.link]}
          className={cn(image.link !== "REVIEWED" && "border-amber-500/40 text-amber-700 dark:text-amber-400")}
        >
          {captureLinkLabels[image.link]}
        </Badge>
      </div>
      {image.reading && (
        <p className="type-body">
          {image.card ? `Đọc từ thẻ số ${image.card}: ` : "Đọc được: "}
          <span className="font-semibold">{image.reading}</span>
        </p>
      )}
      <p className="type-meta">{captureLinkHints[image.link]}</p>
      {image.notes.length > 0 && (
        <div
          aria-label="Ghi chú rà soát"
          className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 [overflow-wrap:anywhere]"
        >
          {image.notes.map((note) => (
            <p key={note} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
              {note}
            </p>
          ))}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
        <code className="min-w-0 flex-1 truncate font-mono" title={`${image.archive} › ${image.member}`}>
          {image.fileName}
        </code>
        <CopyButton
          value={`${image.archive}/${image.member}`}
          label={image.url ? "Sao chép đường dẫn ảnh" : "Sao chép đường dẫn trong ZIP"}
        />
        <Button variant="ghost" size="icon-xs" asChild>
          <a href={url} target="_blank" rel="noreferrer" aria-label="Mở ảnh gốc trong thẻ mới">
            <ExternalLink />
          </a>
        </Button>
      </div>
    </div>
  )
}

/**
 * Sits beside the hero page rather than over it, so the entered data stays readable and editable while comparing. Arrow
 * and zoom keys only act with focus inside the panel, so typing in the editor never moves the picture.
 */
export function PatchCapturePanel({ captures }: { captures: PatchCaptureWorkspace }) {
  const { state, patchCode, viewedPatchCode, otherPatches, groups, activeKey, imageId, focusRequest } = captures
  const panel = useRef<HTMLElement>(null)
  const [size, setSize] = useState(readSize)
  const wide = size.width >= 60
  const latestSize = useRef(size)
  latestSize.current = size
  const changeSize = (next: Partial<typeof defaultSize>) => setSize((current) => ({ ...current, ...next }))
  const keepSize = () => saveSize(latestSize.current)
  const dragTo = ({ x, y }: { x: number; y: number }) => {
    const split = panel.current?.parentElement?.getBoundingClientRect()
    if (!split) return
    if (panel.current && getComputedStyle(panel.current.parentElement!).flexDirection === "row")
      changeSize({ width: clampWidth(((split.right - x) / split.width) * 100) })
    else changeSize({ height: clampHeight(((split.bottom - y) / window.innerHeight) * 100) })
  }
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
  useEffect(() => {
    const bounds = frame.current?.getBoundingClientRect()
    setZoom(imageBox && bounds ? captureCardZoom(imageBox, bounds.width, bounds.height) : captureFit)
    thumbnails.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
  }, [imageKey, imageBox])
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
    if (target) captures.select(target.group.key, target.image.id)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    const actions: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      "+": () => stepZoom(ZOOM_STEP),
      "=": () => stepZoom(ZOOM_STEP),
      "-": () => stepZoom(1 / ZOOM_STEP),
      "0": () => setZoom(captureFit),
    }
    const action = actions[event.key]
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    action()
  }
  const url = image ? captureImageUrl(patchCode ?? "", image) : ""
  const message = group?.shop ? null : stateMessage(state, patchCode)
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
        onReset={() => {
          changeSize({ width: defaultSize.width })
          saveSize({ ...size, width: defaultSize.width })
        }}
      />
      <CaptureResizeHandle
        direction="height"
        value={size.height}
        min={25}
        max={80}
        className="@5xl/hero-split:hidden"
        onChange={dragTo}
        onCommit={keepSize}
        onReset={() => {
          changeSize({ height: defaultSize.height })
          saveSize({ ...size, height: defaultSize.height })
        }}
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
          onClick={() => {
            const next = { ...size, width: wide ? defaultSize.width : 68 }
            setSize(next)
            saveSize(next)
          }}
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
        <p role="note" className="flex shrink-0 gap-2 border-b bg-amber-500/5 px-3 py-2 text-xs leading-5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
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
                onClick={() => captures.select(item.key)}
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
                title={`${group.title} · ${image.fileName}`}
                frame={frame}
                zoom={zoom}
                onZoom={applyZoom}
                onPrevious={position > 0 ? () => step(-1) : undefined}
                onNext={position < sequence.length - 1 ? () => step(1) : undefined}
              />
              <div className="flex items-center gap-1 border-b px-3 py-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Thu nhỏ ảnh"
                  title="Thu nhỏ ảnh"
                  disabled={zoom.scale <= 1}
                  onClick={() => stepZoom(1 / ZOOM_STEP)}
                >
                  <ZoomOut />
                </Button>
                <span className="type-meta w-12 text-center tabular-nums" aria-live="polite">
                  {Math.round(zoom.scale * 100)}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Phóng to ảnh"
                  title="Phóng to ảnh"
                  disabled={zoom.scale >= CAPTURE_MAX_SCALE}
                  onClick={() => stepZoom(ZOOM_STEP)}
                >
                  <ZoomIn />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Vừa khung"
                  title="Vừa khung"
                  disabled={zoom.scale === 1}
                  onClick={() => setZoom(captureFit)}
                >
                  <Maximize />
                </Button>
                <span className="type-meta ml-auto hidden @5xl/hero-split:inline">
                  <Kbd>←</Kbd> <Kbd>→</Kbd> chuyển ảnh · lăn chuột phóng to, kéo để di chuyển
                </span>
              </div>
              {group.images.length > 1 && (
                <div
                  ref={thumbnails}
                  role="group"
                  aria-label={`Các ảnh của ${group.title}`}
                  className="flex items-start gap-2 overflow-x-auto p-3"
                >
                  {group.images.map((member, index) => (
                    <button
                      key={member.id}
                      type="button"
                      aria-current={member.id === image.id}
                      aria-label={`Ảnh ${index + 1}: ${member.entryName ?? member.fileName}`}
                      title={member.entryName ?? member.fileName}
                      className={cn(
                        "shrink-0 overflow-hidden rounded-md border-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        !member.box && "w-28",
                        member.id === image.id ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
                      )}
                      onClick={() => captures.select(group.key, member.id)}
                    >
                      {member.box ? (
                        <CaptureCardThumbnail url={captureImageUrl(patchCode ?? "", member)} box={member.box} />
                      ) : (
                        <img
                          src={captureImageUrl(patchCode ?? "", member)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="aspect-[20/9] w-full bg-muted object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
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
