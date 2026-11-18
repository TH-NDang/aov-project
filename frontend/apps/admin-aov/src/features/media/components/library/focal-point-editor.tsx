import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { focalPosition, type FocalPoint } from "@aov/ui/lib/focal-point"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { invalidateMediaAsset, mediaKeys } from "../../api/media-cache"

interface VersionPoint {
  id: string
  url: string
  width: number
  height: number
  current: boolean
  focalPoint?: FocalPoint | null
}

/** Pictures that are shown cropped to a fixed shape somewhere. Icons are always shown whole. */
export const croppedImageTypes = new Set(["HERO_SPLASH", "HERO_PORTRAIT", "HERO_SKIN_ART", "PATCH_ART"])

/** The shapes these pictures are cut to on the public pages, to judge the choice by. */
const SHAPES = [
  { label: "Ảnh bìa rộng", ratio: "21 / 9" },
  { label: "Băng rôn", ratio: "16 / 9" },
  { label: "Thẻ dọc", ratio: "4 / 5" },
  { label: "Vuông", ratio: "1 / 1" },
]

const clamp = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000

/**
 * Choosing the point of a picture, usually the main face, that must stay in view wherever the picture is cropped.
 * The picture itself is not changed.
 */
export function FocalPointEditor({ assetId, writable }: { assetId: string; writable: boolean }) {
  const client = useQueryClient()
  const details = useQuery({
    queryKey: mediaKeys.assetView(assetId, "managed"),
    queryFn: () => backendRequest<{ versions?: VersionPoint[] }>(`/admin/media/assets/${assetId}`),
  })
  const version = details.data?.versions?.find((candidate) => candidate.current)
  const saved = version?.focalPoint ?? null
  const [point, setPoint] = useState<FocalPoint | null>(saved)
  const [busy, setBusy] = useState(false)
  const dragging = useRef(false)

  // A saved point arriving from the server replaces whatever was being tried on the previous picture.
  useEffect(() => setPoint(saved), [saved, version?.id])

  if (!version) return null
  const changed = point?.x !== saved?.x || point?.y !== saved?.y

  function pointFrom(event: PointerEvent<HTMLButtonElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    setPoint({ x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) })
  }
  function nudge(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 0.05 : 0.01
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const from = point ?? { x: 0.5, y: 0.5 }
    setPoint({ x: clamp(from.x + move[0]), y: clamp(from.y + move[1]) })
  }
  async function save(next: FocalPoint | null) {
    if (!version) return
    setBusy(true)
    try {
      await backendRequest(`/admin/media/assets/${assetId}/versions/${version.id}/focal-point`, {
        method: next ? "PUT" : "DELETE",
        ...(next ? { body: JSON.stringify(next) } : {}),
      })
      await invalidateMediaAsset(client, assetId)
      toast.success(next ? "Đã lưu điểm chính của ảnh." : "Đã bỏ điểm chính của ảnh.")
    } catch (cause) {
      toast.error(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border p-3" aria-label="Điểm chính của ảnh">
      <div>
        <h3 className="type-label">Điểm chính của ảnh</h3>
        <p className="type-meta">
          {writable
            ? "Bấm vào khuôn mặt. Khi ảnh bị cắt theo khung cố định, điểm này luôn nằm trong khung."
            : "Khi ảnh bị cắt theo khung cố định, điểm này luôn nằm trong khung."}
        </p>
      </div>
      <button
        type="button"
        disabled={!writable || busy}
        className="relative block w-full cursor-crosshair touch-none overflow-hidden rounded-lg disabled:cursor-default"
        style={{ aspectRatio: `${version.width} / ${version.height}` }}
        aria-label="Chọn điểm chính bằng chuột, hoặc dùng các phím mũi tên"
        aria-description={
          point ? `Đang ở ${Math.round(point.x * 100)}% ngang, ${Math.round(point.y * 100)}% dọc` : "Chưa chọn"
        }
        onPointerDown={(event) => {
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          pointFrom(event)
        }}
        onPointerMove={(event) => {
          if (dragging.current) pointFrom(event)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onKeyDown={nudge}
      >
        <img src={version.url} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
        {point && (
          <span
            aria-hidden="true"
            className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(0_0_0/55%)]"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          />
        )}
      </button>
      <div className="grid grid-cols-4 items-start gap-2" aria-label="Xem thử khi ảnh bị cắt">
        {SHAPES.map((shape) => (
          <figure key={shape.ratio} className="min-w-0 space-y-1">
            <div className="overflow-hidden rounded-md border" style={{ aspectRatio: shape.ratio }}>
              <img
                src={version.url}
                alt=""
                className="size-full object-cover"
                style={{ objectPosition: focalPosition(point) }}
                draggable={false}
              />
            </div>
            <figcaption className="type-meta truncate">{shape.label}</figcaption>
          </figure>
        ))}
      </div>
      {writable && (
        <div className="flex items-center justify-end gap-2">
          {saved && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void save(null)}>
              Bỏ điểm
            </Button>
          )}
          <Button type="button" size="sm" disabled={busy || !point || !changed} onClick={() => void save(point)}>
            Lưu điểm
          </Button>
        </div>
      )}
    </section>
  )
}
