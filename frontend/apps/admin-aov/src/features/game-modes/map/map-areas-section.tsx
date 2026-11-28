import { useState } from "react"
import { FlipHorizontal2, Trash2 } from "lucide-react"
import { objectsIn, type MapArea, type Side } from "@aov/ui/lib/battle-map"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { CopyButton } from "@/components/copy-button"
import { named } from "../guide-codes"
import { duplicateAt } from "../auto-chess/guide-model"
import { FormBlock, Segmented } from "../auto-chess/guide-fields"
import { DetailHeader, MasterDetail } from "../auto-chess/master-detail"
import { MapCanvas } from "./map-canvas"
import { emptyArea, fixedMapCodes, mirrorArea, percent, SIDE_LABEL, takenCodes } from "./map-edit-model"
import type { MapSectionProps } from "./map-objects-section"

const SIDES: { value: Side | "NONE"; label: string; color: string }[] = [
  { value: "NONE", label: "Trung lập", color: "var(--aov-game-gold)" },
  { value: "BLUE", label: SIDE_LABEL.BLUE, color: "var(--aov-info)" },
  { value: "RED", label: SIDE_LABEL.RED, color: "var(--aov-danger)" },
]

/**
 * Named regions such as a pit, the river or one side's jungle, drawn as an outline on the map. Notes elsewhere name an
 * area by its code, and the Wiki lists the objects standing inside it.
 */
export function MapAreasSection({ content, saved, setContent, image }: Omit<MapSectionProps, "upload">) {
  const [selected, setSelected] = useState(0)
  const [corner, setCorner] = useState<number | null>(null)
  const fixed = fixedMapCodes(saved, content)
  const area = content.areas[selected]
  const update = (next: MapArea) =>
    setContent({ ...content, areas: content.areas.map((row, index) => (index === selected ? next : row)) })
  const inside = area && area.outline.length >= 3 ? objectsIn(content, area) : []

  return (
    <MasterDetail
      title="Khu vực"
      addLabel="Thêm khu vực"
      selected={selected}
      onSelect={(index) => {
        setSelected(index)
        setCorner(null)
      }}
      onAdd={() => {
        setContent({ ...content, areas: [...content.areas, emptyArea()] })
        setSelected(content.areas.length)
      }}
      groups={SIDES.map((side) => ({
        key: side.value,
        label: (
          <span className="flex items-center gap-1.5" style={{ color: side.color }}>
            <span className="size-2 rounded-full bg-current" /> {side.label}
          </span>
        ),
        rows: content.areas
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => (entry.side ?? "NONE") === side.value)
          .map(({ entry, index }) => ({
            key: `${entry.code}-${index}`,
            index,
            title: entry.name,
            meta: entry.code,
            warn: entry.outline.length < 3,
          })),
      }))}
    >
      {area ? (
        <>
          <DetailHeader
            icon={null}
            title={area.name || "Khu vực mới"}
            code={area.code}
            onRename={(code) => update({ ...area, code })}
            onDuplicate={() => {
              setContent({ ...content, areas: duplicateAt(content.areas, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa khu vực ${area.name}?`}
            onDelete={() => {
              setContent({ ...content, areas: content.areas.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin">
            <label className="grid gap-1">
              <span className="type-label">Tên</span>
              <Input
                value={area.name}
                placeholder="vd. Hang Rồng"
                onChange={(event) => update(named(area, event.target.value, fixed))}
              />
            </label>
            <div className="grid gap-1">
              <span className="type-label">Thuộc phe</span>
              <Segmented
                label="Thuộc phe"
                value={area.side ?? "NONE"}
                options={SIDES}
                onChange={(side) => update({ ...area, side: side === "NONE" ? null : side })}
              />
            </div>
            <label className="grid gap-1">
              <span className="type-label">Mô tả</span>
              <Textarea
                value={area.summary ?? ""}
                onChange={(event) => update({ ...area, summary: event.target.value || null })}
              />
            </label>
            <span className="type-meta flex items-center gap-1">
              Tham chiếu: <code className="rounded bg-muted px-1.5 py-0.5">{area.code || "(tự tạo từ tên)"}</code>
              {area.code && <CopyButton value={area.code} label="Chép tham chiếu" />}
            </span>
          </FormBlock>
          <FormBlock title="Khung" hint="Chạm lần lượt các góc của khu vực, ít nhất 3 góc. Kéo một góc để chỉnh.">
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
              <MapCanvas
                label={`Khung của ${area.name || "khu vực"}`}
                content={{ ...content, areas: content.areas.filter((other) => other !== area) }}
                background={image(content.backgroundAssetId)}
                shape="outline"
                points={area.outline.map((point, index) => ({
                  ...point,
                  id: String(index),
                  mark: String(index + 1),
                  side: area.side,
                  title: `Góc ${index + 1}`,
                }))}
                selected={corner == null ? null : String(corner)}
                onSelect={(id) => setCorner(Number(id))}
                onMove={(id, point) =>
                  update({ ...area, outline: area.outline.map((row, index) => (index === Number(id) ? point : row)) })
                }
                onAdd={(point) => {
                  // A corner added while another is chosen goes right after it, so a side can be split.
                  const at = corner == null ? area.outline.length : corner + 1
                  update({ ...area, outline: [...area.outline.slice(0, at), point, ...area.outline.slice(at)] })
                  setCorner(at)
                }}
              />
              <div className="grid content-start gap-2">
                <p className="type-body">
                  {area.outline.length} góc
                  {corner != null && area.outline[corner] && (
                    <>
                      {" "}
                      · góc {corner + 1} ở {percent(area.outline[corner]!.x)}, {percent(area.outline[corner]!.y)}
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={corner == null}
                    onClick={() => {
                      update({ ...area, outline: area.outline.filter((_, index) => index !== corner) })
                      setCorner(null)
                    }}
                  >
                    <Trash2 /> Xóa góc đang chọn
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={area.outline.length < 3 || !area.code}
                    onClick={() => {
                      setContent({ ...content, areas: [...content.areas, mirrorArea(area, takenCodes(content))] })
                      setSelected(content.areas.length)
                      setCorner(null)
                    }}
                  >
                    <FlipHorizontal2 /> Tạo khu đối xứng ở phe kia
                  </Button>
                </div>
                <div className="grid gap-1">
                  <span className="type-label">Đối tượng trong khu ({inside.length})</span>
                  <p className="type-meta">
                    {inside.length
                      ? inside.map((object) => object.name).join(", ")
                      : "Chưa có đối tượng nào bên trong."}
                  </p>
                </div>
              </div>
            </div>
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một khu vực, vd. hang Caesar hay sông.</p>
      )}
    </MasterDetail>
  )
}
