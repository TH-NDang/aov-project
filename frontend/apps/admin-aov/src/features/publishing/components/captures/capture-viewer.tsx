import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import {
  CAPTURE_ZOOM_STEP,
  captureBoxOnScreen,
  captureFit,
  clampCaptureZoom,
  zoomCaptureAt,
  type CaptureImage,
  type CaptureRegion,
  type CaptureZoom,
} from "../../model/captures/patch-capture-model"

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

/**
 * One source picture, zoomed with the wheel, a double click or the zoom bar and dragged while zoomed. The parts of a
 * game screen that lead to the page are outlined while the pointer is over the picture.
 */
export function CaptureViewer({
  image,
  url,
  failed,
  onExpired,
  title,
  frame,
  zoom,
  onZoom,
  onPrevious,
  onNext,
  regions,
  natural,
  onReady,
  onRegion,
}: {
  image: CaptureImage
  /** The presigned link; empty while it is on its way. */
  url: string | undefined
  /** No stored bytes were found for the picture. */
  failed: boolean
  /** Asks for a new link when the old one has expired; false when the link was fresh and the picture is broken. */
  onExpired: () => boolean
  title: string
  frame: RefObject<HTMLDivElement | null>
  zoom: CaptureZoom
  onZoom: (update: (zoom: CaptureZoom, width: number, height: number) => CaptureZoom) => void
  onPrevious?: () => void
  onNext?: () => void
  /** Parts of the picture that lead to the page. */
  regions: CaptureRegion[]
  natural: { width: number; height: number } | null
  onReady: (natural: { width: number; height: number }) => void
  onRegion: (region: CaptureRegion) => void
}) {
  const [loaded, setLoaded] = useState<"loading" | "ready" | "error">("loading")
  const status = failed ? "error" : loaded
  const [drag, setDrag] = useState<{ pointer: number; x: number; y: number } | null>(null)
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null)
  // Where a press started and on which region, so a press that did not move still picks the region while zoomed.
  const press = useRef<{ x: number; y: number; region: string | null } | null>(null)
  useEffect(() => {
    const element = frame.current
    if (!element) return
    const measure = () => {
      const bounds = element.getBoundingClientRect()
      setFrameSize(bounds.width && bounds.height ? { width: bounds.width, height: bounds.height } : null)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [frame])
  const point = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = frame.current!.getBoundingClientRect()
      return { x: clientX - bounds.left, y: clientY - bounds.top }
    },
    [frame],
  )
  // React's wheel listener is passive, and the page behind must not scroll while zooming.
  useEffect(() => {
    const element = frame.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY < 0 ? CAPTURE_ZOOM_STEP : 1 / CAPTURE_ZOOM_STEP
      const at = point(event.clientX, event.clientY)
      onZoom((current, width, height) => zoomCaptureAt(current, current.scale * factor, at, width, height))
    }
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  }, [frame, onZoom, point])
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const region = (event.target as Element).closest?.("[data-capture-region]")?.getAttribute("data-capture-region")
    press.current = { x: event.clientX, y: event.clientY, region: region ?? null }
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
        "group/frame relative aspect-[20/9] max-h-[calc(var(--capture-height)-8.5rem)] w-full shrink-0 touch-none overflow-hidden bg-muted/60 select-none @5xl/hero-split:max-h-[60dvh]",
        zoom.scale > 1 ? (drag ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        // While zoomed the frame holds the pointer, so the region button never sees the click: pick it here.
        const start = press.current
        press.current = null
        if (drag && start?.region && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) {
          const region = regions.find((item) => item.key === start.region)
          if (region) onRegion(region)
        }
        setDrag(null)
      }}
      onPointerCancel={() => setDrag(null)}
      onDoubleClick={(event) => {
        const at = point(event.clientX, event.clientY)
        onZoom((current, width, height) =>
          current.scale > 1 ? captureFit : zoomCaptureAt(current, 2.5, at, width, height),
        )
      }}
    >
      {url && (
        <img
          src={url}
          alt={title}
          draggable={false}
          className="size-full origin-top-left object-contain"
          style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}
          onLoad={(event) => {
            setLoaded("ready")
            onReady({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
          }}
          onError={() => {
            // A link past its ten minutes is renewed and the picture loads again under the new one.
            if (!onExpired()) setLoaded("error")
          }}
        />
      )}
      {image.box && status === "ready" && <CaptureCardMark box={image.box} zoom={zoom} />}
      {status === "ready" && natural && frameSize && regions.length > 0 && (
        // Outlined while the pointer is over the picture; each part names where it leads.
        <div className="pointer-events-none absolute inset-0">
          {regions.map((region) => {
            const place = captureBoxOnScreen(region.box, natural, frameSize, zoom)
            return (
              <button
                key={region.key}
                type="button"
                data-capture-region={region.key}
                aria-label={`Đi tới ${region.label}`}
                title={`Đi tới ${region.label}`}
                className="group/region pointer-events-auto absolute rounded-md border border-transparent outline-none transition-colors group-hover/frame:border-primary/35 hover:border-primary hover:bg-primary/10 focus-visible:border-primary focus-visible:bg-primary/10"
                style={{ left: place.left, top: place.top, width: place.width, height: place.height }}
                onDoubleClick={(event) => event.stopPropagation()}
                onClick={() => onRegion(region)}
              >
                <span className="type-meta pointer-events-none absolute top-0 left-0 max-w-[16rem] -translate-y-full truncate rounded-md bg-background/90 px-1.5 text-foreground opacity-0 shadow-sm transition-opacity group-hover/region:opacity-100 group-focus-visible/region:opacity-100">
                  Đi tới {region.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {status === "loading" && (
        <p role="status" className="type-meta absolute inset-0 flex items-center justify-center p-4 text-center">
          Đang mở ảnh gốc…
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
