import { useRef } from "react"
import { GripHorizontal } from "lucide-react"

type Props = {
  value: number
  onChange: (value: number) => void
  controls: string
}

export function PreviewDivider({ value, onChange, controls }: Props) {
  const drag = useRef<{ pointer: number; y: number; value: number; height: number } | null>(null)
  const update = (next: number) => onChange(Math.max(40, Math.min(75, next)))
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label="Điều chỉnh chiều cao ô nhập và xem trước"
      aria-orientation="horizontal"
      aria-controls={controls}
      aria-valuemin={40}
      aria-valuemax={75}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`Ô nhập ${Math.round(value)}%, xem trước ${100 - Math.round(value)}%`}
      title="Kéo để đổi chiều cao · Phím ↑ ↓ để điều chỉnh"
      className="flex h-7 touch-none cursor-row-resize items-center justify-center gap-2 rounded-md text-muted-foreground select-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return
        event.preventDefault()
        const height = (event.currentTarget.parentElement?.clientHeight ?? 0) - event.currentTarget.clientHeight
        if (height <= 0) return
        drag.current = { pointer: event.pointerId, y: event.clientY, value, height }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const start = drag.current
        if (start?.pointer === event.pointerId) update(start.value + ((event.clientY - start.y) / start.height) * 100)
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointer !== event.pointerId) return
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onLostPointerCapture={() => {
        drag.current = null
      }}
      onKeyDown={(event) => {
        const next = { ArrowUp: value - 5, ArrowDown: value + 5, Home: 40, End: 75 }[event.key]
        if (next === undefined) return
        event.preventDefault()
        update(next)
      }}
    >
      <span aria-hidden className="h-px w-8 bg-border" />
      <GripHorizontal aria-hidden className="size-4" />
      <span aria-hidden className="text-xs">
        Kéo để chia khung
      </span>
      <span aria-hidden className="h-px w-8 bg-border" />
    </div>
  )
}
