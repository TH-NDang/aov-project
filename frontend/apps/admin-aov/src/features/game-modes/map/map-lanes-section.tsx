import { useState } from "react"
import { Trash2, X } from "lucide-react"
import type { MapLane, MapPoint } from "@aov/ui/lib/battle-map"
import { LaneMark } from "@aov/ui/components/battle-map-glyph"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { usePublicHeroes } from "@/lib/public-heroes"
import { named } from "../guide-codes"
import { duplicateAt } from "../auto-chess/guide-model"
import { FormBlock, Segmented } from "../auto-chess/guide-fields"
import { DetailHeader, MasterDetail } from "../auto-chess/master-detail"
import { HeroCodePicker } from "../entry-controls"
import { MapCanvas } from "./map-canvas"
import { emptyLane, fixedMapCodes, LANE_GLYPH_LABEL, LANE_GLYPHS } from "./map-edit-model"
import type { MapSectionProps } from "./map-objects-section"

type Layer = "positions" | "path"

const LAYERS: { value: Layer; label: string }[] = [
  { value: "positions", label: "Biểu tượng vai trò" },
  { value: "path", label: "Đường đi" },
]

/** Heroes the editors suggest for a role, each linking to its Wiki page. */
function LaneHeroes({ codes, onChange }: { codes: string[]; onChange: (codes: string[]) => void }) {
  const heroes = usePublicHeroes()
  const byCode = new Map((heroes.data ?? []).map((hero) => [hero.code, hero]))
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {codes.map((code) => {
          const hero = byCode.get(code)
          return (
            <span
              key={code}
              className="type-meta inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-0.5"
            >
              {hero?.head ? (
                <img src={hero.head} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <span className="size-6 rounded-full bg-muted" />
              )}
              {hero?.name ?? code}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Bỏ ${hero?.name ?? code}`}
                onClick={() => onChange(codes.filter((other) => other !== code))}
              >
                <X />
              </Button>
            </span>
          )
        })}
        {codes.length === 0 && <span className="type-meta">Chưa gợi ý tướng nào.</span>}
      </div>
      <div className="max-w-80">
        <HeroCodePicker
          value={null}
          unitName=""
          onChange={(code) => code && !codes.includes(code) && onChange([...codes, code])}
        />
      </div>
    </div>
  )
}

/** The lanes and roles of the game's lanes tab: the role's mark, its route on the reader's side and its heroes. */
export function MapLanesSection({ content, saved, setContent, image }: Omit<MapSectionProps, "upload">) {
  const [selected, setSelected] = useState(0)
  const [layer, setLayer] = useState<Layer>("positions")
  const [point, setPoint] = useState<number | null>(null)
  const fixed = fixedMapCodes(saved, content)
  const lane = content.lanes[selected]
  const update = (next: MapLane) =>
    setContent({ ...content, lanes: content.lanes.map((row, index) => (index === selected ? next : row)) })
  const points: MapPoint[] = lane ? lane[layer] : []
  const setPoints = (next: MapPoint[]) => lane && update({ ...lane, [layer]: next })

  return (
    <MasterDetail
      title="Đường và vai trò"
      addLabel="Thêm vai trò"
      selected={selected}
      onSelect={(index) => {
        setSelected(index)
        setPoint(null)
      }}
      onAdd={() => {
        setContent({ ...content, lanes: [...content.lanes, emptyLane()] })
        setSelected(content.lanes.length)
      }}
      groups={[
        {
          key: "lanes",
          label: "Theo thứ tự trong game",
          rows: content.lanes.map((entry, index) => ({
            key: `${entry.code}-${index}`,
            index,
            title: entry.name,
            icon: (
              <span className="grid size-8 place-items-center rounded-md border text-(--aov-game-gold)">
                <LaneMark glyph={entry.glyph} size={18} />
              </span>
            ),
            meta: `${entry.heroCodes.length} tướng gợi ý`,
            warn: entry.positions.length === 0,
          })),
        },
      ]}
    >
      {lane ? (
        <>
          <DetailHeader
            icon={
              <span className="grid size-16 place-items-center rounded-lg border text-(--aov-game-gold)">
                <LaneMark glyph={lane.glyph} size={34} />
              </span>
            }
            title={lane.name || "Vai trò mới"}
            code={lane.code}
            onRename={(code) => update({ ...lane, code })}
            onDuplicate={() => {
              setContent({ ...content, lanes: duplicateAt(content.lanes, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa ${lane.name}?`}
            onDelete={() => {
              setContent({ ...content, lanes: content.lanes.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin">
            <label className="grid gap-1">
              <span className="type-label">Tên</span>
              <Input
                value={lane.name}
                placeholder="vd. Đường Caesar"
                onChange={(event) => update(named(lane, event.target.value, fixed))}
              />
            </label>
            <div className="grid gap-1">
              <span className="type-label">Ký hiệu</span>
              <Segmented
                label="Ký hiệu"
                value={lane.glyph ?? "LANE"}
                onChange={(glyph) => update({ ...lane, glyph })}
                options={LANE_GLYPHS.map((glyph) => ({
                  value: glyph,
                  label: LANE_GLYPH_LABEL[glyph],
                  icon: <LaneMark glyph={glyph} size={16} />,
                }))}
              />
            </div>
            <label className="grid gap-1">
              <span className="type-label">Giới thiệu</span>
              <Textarea
                value={lane.body ?? ""}
                placeholder="Dòng bắt đầu bằng “- ” là một gạch đầu dòng."
                onChange={(event) => update({ ...lane, body: event.target.value || null })}
              />
            </label>
          </FormBlock>
          <FormBlock title="Tướng gợi ý">
            <LaneHeroes codes={lane.heroCodes} onChange={(heroCodes) => update({ ...lane, heroCodes })} />
          </FormBlock>
          <FormBlock
            title="Trên bản đồ"
            hint="Vẽ cho phe xanh (góc dưới bên trái). Đường đi nối các điểm theo thứ tự chạm; vai trò đi khắp nơi thì bỏ trống."
          >
            <Segmented
              label="Đang sửa"
              value={layer}
              options={LAYERS}
              onChange={(next) => {
                setLayer(next)
                setPoint(null)
              }}
            />
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
              <MapCanvas
                label={`${layer === "path" ? "Đường đi" : "Biểu tượng"} của ${lane.name || "vai trò"}`}
                content={{ ...content, lanes: content.lanes.filter((other) => other !== lane) }}
                background={image(content.backgroundAssetId)}
                shape={layer === "path" ? "route" : "points"}
                points={points.map((row, index) => ({ ...row, id: String(index), mark: String(index + 1) }))}
                selected={point == null ? null : String(point)}
                onSelect={(id) => setPoint(Number(id))}
                onMove={(id, next) => setPoints(points.map((row, index) => (index === Number(id) ? next : row)))}
                onAdd={(next) => {
                  setPoints([...points, next])
                  setPoint(points.length)
                }}
              />
              <div className="grid content-start gap-2">
                <p className="type-body">
                  {points.length} điểm {layer === "path" ? "trên đường đi" : "đặt biểu tượng"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={point == null}
                    onClick={() => {
                      setPoints(points.filter((_, index) => index !== point))
                      setPoint(null)
                    }}
                  >
                    <Trash2 /> Xóa điểm đang chọn
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!points.length}
                    onClick={() => {
                      setPoints([])
                      setPoint(null)
                    }}
                  >
                    Xóa hết
                  </Button>
                </div>
              </div>
            </div>
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một đường hay vai trò.</p>
      )}
    </MasterDetail>
  )
}
