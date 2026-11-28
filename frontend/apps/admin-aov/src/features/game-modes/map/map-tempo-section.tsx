import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { clock, type MapCallout, type TempoMoment } from "@aov/ui/lib/battle-map"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { confirmAction } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { FormBlock } from "../auto-chess/guide-fields"
import { MasterDetail } from "../auto-chess/master-detail"
import { MapCanvas } from "./map-canvas"
import { placeOptions } from "./map-edit-model"
import { ClockInput } from "./map-object-texts"
import type { MapSectionProps } from "./map-objects-section"

const emptyMoment = (seconds: number): TempoMoment => ({ seconds, phase: null, callouts: [], steps: [] })

/** The game's match timeline: what happens at each mark, and where on the map. Marks are saved in time order. */
export function MapTempoSection({
  content,
  setContent,
  image,
}: Pick<MapSectionProps, "content" | "setContent" | "image">) {
  const [selected, setSelected] = useState(0)
  const [callout, setCallout] = useState<number | null>(null)
  const moment = content.tempo[selected]
  const places = placeOptions(content)
  const update = (next: TempoMoment) =>
    setContent({ ...content, tempo: content.tempo.map((row, index) => (index === selected ? next : row)) })
  const setCallouts = (callouts: MapCallout[]) => moment && update({ ...moment, callouts })
  const order = content.tempo
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.seconds - b.entry.seconds)

  return (
    <MasterDetail
      title="Nhịp điệu"
      addLabel="Thêm mốc"
      selected={selected}
      onSelect={(index) => {
        setSelected(index)
        setCallout(null)
      }}
      onAdd={() => {
        const last = Math.max(-60, ...content.tempo.map((row) => row.seconds))
        setContent({ ...content, tempo: [...content.tempo, emptyMoment(last + 60)] })
        setSelected(content.tempo.length)
      }}
      groups={[
        {
          key: "tempo",
          label: "Theo thời gian",
          rows: order.map(({ entry, index }) => ({
            key: `${entry.seconds}-${index}`,
            index,
            title: `${clock(entry.seconds)}${entry.phase ? ` · ${entry.phase}` : ""}`,
            meta: entry.callouts.map((row) => row.label).join(" · ") || undefined,
            warn: entry.steps.length === 0,
          })),
        },
      ]}
    >
      {moment ? (
        <>
          <FormBlock title="Mốc">
            <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-end">
              <label className="grid gap-1">
                <span className="type-label">Thời điểm</span>
                <ClockInput
                  label="Thời điểm"
                  seconds={moment.seconds}
                  onChange={(seconds) => seconds != null && update({ ...moment, seconds })}
                />
              </label>
              <label className="grid gap-1">
                <span className="type-label">Giai đoạn bắt đầu từ mốc này</span>
                <Input
                  value={moment.phase ?? ""}
                  placeholder="vd. Giữa trận; để trống nếu vẫn giai đoạn cũ"
                  onChange={(event) => update({ ...moment, phase: event.target.value || null })}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (
                    await confirmAction({
                      title: `Xóa mốc ${clock(moment.seconds)}?`,
                      description: "Mốc sẽ bị xóa khỏi bản nháp. Bạn vẫn có thể bỏ nháp để lấy lại.",
                      confirmLabel: "Xóa",
                    })
                  ) {
                    setContent({ ...content, tempo: content.tempo.filter((_, index) => index !== selected) })
                    setSelected(0)
                  }
                }}
              >
                <Trash2 /> Xóa mốc
              </Button>
            </div>
          </FormBlock>
          <FormBlock title="Ghi chú" hint="Mỗi ô là một mục đánh số như trong game; xuống dòng giữ nguyên.">
            {moment.steps.map((step, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="type-label mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-muted">
                  {index + 1}
                </span>
                <Textarea
                  aria-label={`Ghi chú ${index + 1}`}
                  value={step}
                  onChange={(event) =>
                    update({
                      ...moment,
                      steps: moment.steps.map((row, other) => (other === index ? event.target.value : row)),
                    })
                  }
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Xóa ghi chú ${index + 1}`}
                  onClick={() => update({ ...moment, steps: moment.steps.filter((_, other) => other !== index) })}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => update({ ...moment, steps: [...moment.steps, ""] })}
            >
              <Plus /> Thêm ghi chú
            </Button>
          </FormBlock>
          <FormBlock
            title="Trên bản đồ"
            hint="Nhãn hiện trên bản đồ khi tới mốc. Gắn với một đối tượng để nhãn theo vị trí của nó; kéo nhãn thì bỏ gắn."
          >
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
              <MapCanvas
                label={`Nhãn của mốc ${clock(moment.seconds)}`}
                content={content}
                background={image(content.backgroundAssetId)}
                points={moment.callouts.map((row, index) => ({
                  x: row.x,
                  y: row.y,
                  id: String(index),
                  mark: String(index + 1),
                  title: row.label,
                }))}
                selected={callout == null ? null : String(callout)}
                onSelect={(id) => setCallout(Number(id))}
                onMove={(id, point) =>
                  setCallouts(
                    moment.callouts.map((row, index) =>
                      index === Number(id) ? { ...row, ...point, objectCode: null, spotKey: null } : row,
                    ),
                  )
                }
                onAdd={(point) => {
                  setCallouts([...moment.callouts, { label: "", objectCode: null, spotKey: null, ...point }])
                  setCallout(moment.callouts.length)
                }}
              />
              <ol className="grid content-start gap-2">
                {moment.callouts.map((row, index) => {
                  const linked = row.objectCode
                    ? row.spotKey
                      ? `${row.objectCode}.${row.spotKey}`
                      : row.objectCode
                    : ""
                  const setRow = (next: MapCallout) =>
                    setCallouts(moment.callouts.map((other, at) => (at === index ? next : other)))
                  return (
                    <li
                      key={index}
                      className={`grid gap-2 rounded-md border p-2 ${index === callout ? "ring-1 ring-primary/50" : ""}`}
                      onFocusCapture={() => setCallout(index)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="type-label grid size-6 shrink-0 place-items-center rounded-full bg-muted">
                          {index + 1}
                        </span>
                        <Input
                          aria-label={`Nhãn ${index + 1}`}
                          placeholder="vd. Caesar xuất hiện"
                          value={row.label}
                          onChange={(event) => setRow({ ...row, label: event.target.value })}
                        />
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Xóa nhãn ${index + 1}`}
                          onClick={() => {
                            setCallouts(moment.callouts.filter((_, at) => at !== index))
                            setCallout(null)
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <NativeSelect
                        aria-label={`Gắn nhãn ${index + 1} với`}
                        value={linked}
                        onChange={(event) => {
                          const place = places.find((option) => option.value === event.target.value)
                          setRow(
                            place
                              ? {
                                  ...row,
                                  objectCode: place.objectCode,
                                  spotKey: place.spotKey,
                                  x: place.point.x,
                                  y: place.point.y,
                                }
                              : { ...row, objectCode: null, spotKey: null },
                          )
                        }}
                      >
                        <option value="">
                          Vị trí tự chọn ({row.x}, {row.y})
                        </option>
                        {places.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </li>
                  )
                })}
                {moment.callouts.length === 0 && <li className="type-meta">Chưa có nhãn. Chạm vào bản đồ để thêm.</li>}
              </ol>
            </div>
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một mốc thời gian.</p>
      )}
    </MasterDetail>
  )
}
