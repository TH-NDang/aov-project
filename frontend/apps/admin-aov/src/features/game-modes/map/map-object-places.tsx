import { useState } from "react"
import { FlipHorizontal2, Trash2 } from "lucide-react"
import type { MapContent, MapObject, MapSpot, Side } from "@aov/ui/lib/battle-map"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { CopyButton } from "@/components/copy-button"
import { slugify } from "@/lib/text"
import { Segmented } from "../auto-chess/guide-fields"
import { MapCanvas } from "./map-canvas"
import { addSpot, mirrorSpotAt, renameSpot, SIDE_LABEL } from "./map-edit-model"

const SIDE_OPTIONS: { value: Side | "NONE"; label: string; color?: string }[] = [
  { value: "NONE", label: "Trung lập", color: "var(--aov-game-gold)" },
  { value: "BLUE", label: SIDE_LABEL.BLUE, color: "var(--aov-info)" },
  { value: "RED", label: SIDE_LABEL.RED, color: "var(--aov-danger)" },
]

/**
 * Where an object stands. Each place has a key that notes elsewhere name it by (`tru-ngoai.do-giua`); a key of the
 * saved draft is renamed only on purpose, and the timeline's callouts follow it.
 */
export function ObjectPlaces({
  content,
  object,
  background,
  onChange,
}: {
  content: MapContent
  object: MapObject
  background?: string
  /** Replaces the whole map, so a renamed key reaches the callouts too. */
  onChange: (content: MapContent) => void
}) {
  const [selected, setSelected] = useState(0)
  const at = content.objects.indexOf(object)
  const put = (next: MapObject, base: MapContent = content) =>
    onChange({ ...base, objects: base.objects.map((row, index) => (index === at ? next : row)) })
  const setSpot = (index: number, spot: MapSpot) =>
    put({ ...object, positions: object.positions.map((row, other) => (other === index ? spot : row)) })

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <MapCanvas
        label={`Vị trí của ${object.name || "đối tượng"}`}
        content={content}
        background={background}
        points={object.positions.map((spot, index) => ({
          ...spot,
          id: String(index),
          mark: String(index + 1),
          title: spot.label || spot.key || object.name,
        }))}
        selected={String(selected)}
        onSelect={(id) => setSelected(Number(id))}
        onMove={(id, point) => setSpot(Number(id), { ...object.positions[Number(id)]!, ...point })}
        onAdd={(point) => {
          put(addSpot(object, point))
          setSelected(object.positions.length)
        }}
      />
      <ol className="grid content-start gap-2">
        {object.positions.length === 0 && (
          <li className="type-body text-(--aov-warning)">Chưa có vị trí. Chạm vào bản đồ để đặt.</li>
        )}
        {object.positions.map((spot, index) => {
          const reference = spot.key ? `${object.code}.${spot.key}` : object.code
          return (
            <li
              key={index}
              className={`grid gap-2 rounded-md border p-2 ${index === selected ? "ring-1 ring-primary/50" : ""}`}
              onFocusCapture={() => setSelected(index)}
            >
              <div className="flex items-center gap-1.5">
                <span className="type-label grid size-6 shrink-0 place-items-center rounded-full bg-muted">
                  {index + 1}
                </span>
                <code className="type-meta min-w-0 truncate rounded bg-muted px-1.5 py-0.5" title="Tham chiếu">
                  {reference}
                </code>
                <CopyButton value={reference} label="Chép tham chiếu" />
                <span className="type-meta ml-auto shrink-0 tabular-nums">
                  {spot.x}, {spot.y}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  title="Thêm điểm đối xứng ở phe kia"
                  aria-label={`Thêm điểm đối xứng với vị trí ${index + 1}`}
                  onClick={() => {
                    put(mirrorSpotAt(object, index))
                    setSelected(index + 1)
                  }}
                >
                  <FlipHorizontal2 />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Xóa vị trí ${index + 1}`}
                  onClick={() => {
                    put({ ...object, positions: object.positions.filter((_, other) => other !== index) })
                    setSelected(0)
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <Segmented
                label={`Phe của vị trí ${index + 1}`}
                value={spot.side ?? "NONE"}
                options={SIDE_OPTIONS}
                onChange={(side) => setSpot(index, { ...spot, side: side === "NONE" ? null : side })}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="type-label">Khóa</span>
                  <Input
                    value={spot.key ?? ""}
                    placeholder={object.positions.length > 1 ? "vd. xanh-giua" : "không bắt buộc"}
                    onChange={(event) => {
                      const key = slugify(event.target.value) || null
                      const renamed = spot.key && key ? renameSpot(content, object.code, spot.key, key) : content
                      put(
                        {
                          ...object,
                          positions: object.positions.map((row, other) => (other === index ? { ...spot, key } : row)),
                        },
                        renamed,
                      )
                    }}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="type-label">Tên vị trí</span>
                  <Input
                    value={spot.label ?? ""}
                    maxLength={80}
                    placeholder="vd. Đường giữa"
                    onChange={(event) => setSpot(index, { ...spot, label: event.target.value || null })}
                  />
                </label>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
