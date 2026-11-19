import { useState } from "react"
import { cn } from "@aov/ui/lib/utils"

/** The edge the panel shares with the page. Beside the page it moves sideways; under it, up and down. */
export function CaptureResizeHandle({
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
