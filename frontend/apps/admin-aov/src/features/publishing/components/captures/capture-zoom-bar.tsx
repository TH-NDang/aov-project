import { Focus, Maximize, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Kbd } from "@aov/ui/components/kbd"
import { CAPTURE_MAX_SCALE, CAPTURE_ZOOM_STEP, type CaptureZoom } from "../../model/captures/patch-capture-model"

/** The zoom of the open picture: one step out or in, the part worth reading when there is one, and back to fit. */
export function CaptureZoomBar({
  zoom,
  onStep,
  onFocus,
  onFit,
}: {
  zoom: CaptureZoom
  /** Zooms by `factor` around the middle of the frame. */
  onStep: (factor: number) => void
  /** Set when the picture has a part worth reading. */
  onFocus?: () => void
  onFit: () => void
}) {
  return (
    <div className="flex items-center gap-1 border-b px-3 py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Thu nhỏ ảnh"
        title="Thu nhỏ ảnh"
        disabled={zoom.scale <= 1}
        onClick={() => onStep(1 / CAPTURE_ZOOM_STEP)}
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
        onClick={() => onStep(CAPTURE_ZOOM_STEP)}
      >
        <ZoomIn />
      </Button>
      {onFocus && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Phóng vào phần cần đọc"
          title="Phóng vào phần cần đọc"
          onClick={() => onFocus()}
        >
          <Focus />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Vừa khung"
        title="Vừa khung"
        disabled={zoom.scale === 1}
        onClick={onFit}
      >
        <Maximize />
      </Button>
      <span className="type-meta ml-auto hidden @5xl/hero-split:inline">
        <Kbd>←</Kbd> <Kbd>→</Kbd> chuyển ảnh · lăn chuột phóng to, kéo để di chuyển
      </span>
    </div>
  )
}
