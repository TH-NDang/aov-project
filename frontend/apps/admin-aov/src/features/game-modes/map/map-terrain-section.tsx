import { useState } from "react"
import { Copy, FlipHorizontal2, Trash2 } from "lucide-react"
import { centre, roundedPath, TERRAIN_KINDS, type MapTerrain, type TerrainKind } from "@aov/ui/lib/battle-map"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { RowMenu } from "../entry-controls"
import { FormBlock, Segmented } from "../auto-chess/guide-fields"
import { MasterDetail } from "../auto-chess/master-detail"
import { MapCanvas, TERRAIN_STYLE } from "./map-canvas"
import { emptyTerrain, mirrorTerrain, percent, TERRAIN_LABEL, terrainName } from "./map-edit-model"
import type { MapSectionProps } from "./map-objects-section"

/** Kinds in the order editors look for them: walls are the most and the most often fixed. */
const LISTED: readonly TerrainKind[] = ["WALL", "RIVER", "JUNGLE", "BUSH"]

const KINDS = LISTED.map((kind) => ({ value: kind, label: TERRAIN_LABEL[kind] }))

function Swatch({ kind }: { kind: TerrainKind }) {
  const style = TERRAIN_STYLE[kind]
  return (
    <span
      className="size-3 shrink-0 rounded-sm border"
      style={{ background: style.fill, opacity: Math.min(1, style.opacity + 0.4) }}
    />
  )
}

/** Every shape at a glance, drawn from the floor up; a tap picks the shape to edit. */
function TerrainOverview({
  terrain,
  selected,
  onSelect,
}: {
  terrain: MapTerrain[]
  selected: number
  onSelect: (index: number) => void
}) {
  const layered = TERRAIN_KINDS.flatMap((kind) =>
    terrain.map((shape, index) => ({ shape, index })).filter(({ shape }) => shape.kind === kind),
  )
  return (
    <div className="grid gap-1 border-t pt-2">
      <span className="type-label">Chọn trên bản đồ</span>
      <svg viewBox="0 0 100 100" className="aspect-square w-full rounded-md border bg-muted" aria-hidden="true">
        {layered.map(({ shape, index }) =>
          shape.outline.length < 3 ? null : (
            <path
              key={index}
              d={roundedPath(shape.outline, TERRAIN_STYLE[shape.kind].round)}
              fill={TERRAIN_STYLE[shape.kind].fill}
              fillOpacity={index === selected ? 0.85 : TERRAIN_STYLE[shape.kind].opacity + 0.15}
              stroke={index === selected ? "var(--aov-game-gold)" : "none"}
              strokeWidth="0.8"
              className="cursor-pointer"
              onClick={() => onSelect(index)}
            />
          ),
        )}
      </svg>
    </div>
  )
}

/**
 * The traced ground the Wiki draws under the markers: walls, the river, the jungle floor and bushes. Each shape is an
 * outline of points; the Wiki rounds its corners and raises walls off the floor.
 */
export function MapTerrainSection({ content, setContent, image }: Omit<MapSectionProps, "upload" | "saved">) {
  const [selected, setSelected] = useState(0)
  const [corner, setCorner] = useState<number | null>(null)
  const shape = content.terrain[selected]
  const setTerrain = (terrain: MapTerrain[]) => setContent({ ...content, terrain })
  const update = (next: MapTerrain) =>
    setTerrain(content.terrain.map((row, index) => (index === selected ? next : row)))
  const select = (index: number) => {
    setSelected(index)
    setCorner(null)
  }
  const insertAfter = (next: MapTerrain) => {
    setTerrain([...content.terrain.slice(0, selected + 1), next, ...content.terrain.slice(selected + 1)])
    select(selected + 1)
  }
  const name = shape ? terrainName(content, selected) : ""

  return (
    <MasterDetail
      title="Địa hình"
      addLabel="Thêm hình"
      selected={selected}
      onSelect={select}
      onAdd={() => {
        setTerrain([...content.terrain, emptyTerrain("WALL")])
        select(content.terrain.length)
      }}
      groups={LISTED.map((kind) => ({
        key: kind,
        label: (
          <span className="flex items-center gap-1.5">
            <Swatch kind={kind} /> {TERRAIN_LABEL[kind]}
          </span>
        ),
        rows: content.terrain
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.kind === kind)
          .map(({ entry, index }) => {
            const middle = centre(entry.outline)
            return {
              key: String(index),
              index,
              title: terrainName(content, index),
              meta:
                entry.outline.length >= 3
                  ? `${entry.outline.length} điểm · quanh ${Math.round(middle.x)}, ${Math.round(middle.y)}`
                  : `${entry.outline.length} điểm`,
              warn: entry.outline.length < 3,
            }
          }),
      }))}
      footer={<TerrainOverview terrain={content.terrain} selected={selected} onSelect={select} />}
    >
      {shape ? (
        <>
          <header className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
            <Swatch kind={shape.kind} />
            <div className="grid min-w-0 flex-1">
              <h2 className="type-section-title truncate">{name}</h2>
              <span className="type-meta">{shape.outline.length} điểm</span>
            </div>
            <RowMenu
              size="icon"
              label="Tùy chọn khác"
              actions={[
                { label: "Nhân bản", icon: <Copy />, onSelect: () => insertAfter({ ...shape }) },
                {
                  label: "Xóa",
                  icon: <Trash2 />,
                  destructive: true,
                  apart: true,
                  onSelect: async () => {
                    if (
                      await confirmAction({
                        title: `Xóa ${name}?`,
                        description: "Hình này sẽ bị xóa khỏi bản nháp. Bạn vẫn có thể bỏ nháp để lấy lại.",
                        confirmLabel: "Xóa",
                      })
                    ) {
                      setTerrain(content.terrain.filter((_, index) => index !== selected))
                      select(Math.max(0, selected - 1))
                    }
                  },
                },
              ]}
            />
          </header>
          <FormBlock title="Loại">
            <Segmented
              label="Loại"
              value={shape.kind}
              options={KINDS}
              onChange={(kind) => update({ ...shape, kind })}
            />
          </FormBlock>
          <FormBlock
            title="Hình"
            hint="Chạm lần lượt quanh mép, ít nhất 3 điểm. Chọn một điểm rồi chạm để chèn điểm ngay sau nó. Wiki bo tròn các góc."
          >
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
              <MapCanvas
                label={`Hình của ${name}`}
                content={{ ...content, terrain: content.terrain.filter((other) => other !== shape) }}
                background={image(content.backgroundAssetId)}
                shape="outline"
                points={shape.outline.map((point, index) => ({
                  ...point,
                  id: String(index),
                  title: `Điểm ${index + 1}`,
                }))}
                selected={corner == null ? null : String(corner)}
                onSelect={(id) => setCorner(Number(id))}
                onMove={(id, point) =>
                  update({ ...shape, outline: shape.outline.map((row, index) => (index === Number(id) ? point : row)) })
                }
                onAdd={(point) => {
                  const at = corner == null ? shape.outline.length : corner + 1
                  update({ ...shape, outline: [...shape.outline.slice(0, at), point, ...shape.outline.slice(at)] })
                  setCorner(at)
                }}
              />
              <div className="grid content-start gap-2">
                <p className="type-body">
                  {shape.outline.length} điểm
                  {corner != null && shape.outline[corner] && (
                    <>
                      {" "}
                      · điểm {corner + 1} ở {percent(shape.outline[corner]!.x)}, {percent(shape.outline[corner]!.y)}
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
                      update({ ...shape, outline: shape.outline.filter((_, index) => index !== corner) })
                      setCorner(null)
                    }}
                  >
                    <Trash2 /> Xóa điểm đang chọn
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={shape.outline.length < 3}
                    onClick={() => insertAfter(mirrorTerrain(shape))}
                  >
                    <FlipHorizontal2 /> Tạo hình đối xứng ở phe kia
                  </Button>
                </div>
              </div>
            </div>
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">
          Chưa có địa hình. Thêm một hình rồi chạm quanh mép bức tường hay khúc sông trên bản đồ.
        </p>
      )}
    </MasterDetail>
  )
}
