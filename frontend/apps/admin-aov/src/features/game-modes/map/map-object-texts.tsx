import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { clock, type MapObject, type MapSection, type MapTiming } from "@aov/ui/lib/battle-map"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { moveAt } from "../auto-chess/guide-model"
import { readClock } from "./map-edit-model"

/** A time as m:ss; what does not read as a time stays in the field and is not saved until it does. */
export function ClockInput({
  seconds,
  onChange,
  label,
  placeholder = "m:ss",
}: {
  seconds?: number | null
  onChange: (seconds: number | null) => void
  label: string
  placeholder?: string
}) {
  const shown = seconds == null ? "" : clock(seconds)
  const [text, setText] = useState(shown)
  const [last, setLast] = useState(shown)
  if (shown !== last) {
    setLast(shown)
    setText(shown)
  }
  const invalid = text.trim() !== "" && readClock(text) == null
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      aria-invalid={invalid || undefined}
      className="tabular-nums"
      onChange={(event) => {
        const raw = event.target.value
        setText(raw)
        if (!raw.trim()) onChange(null)
        else {
          const value = readClock(raw)
          if (value != null) onChange(value)
        }
      }}
    />
  )
}

function TimingFields({
  title,
  timing,
  onChange,
}: {
  title: string
  timing?: MapTiming | null
  onChange: (timing: MapTiming | null) => void
}) {
  const set = (next: MapTiming) => onChange(next.seconds == null && !next.note ? null : next)
  return (
    <div className="grid gap-1">
      <span className="type-label">{title}</span>
      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
        <ClockInput
          label={`${title}: thời điểm`}
          seconds={timing?.seconds}
          onChange={(seconds) => set({ ...timing, seconds })}
        />
        <Input
          aria-label={`${title}: lời trong game`}
          placeholder="Lời trong game, vd. Phút thứ 2"
          value={timing?.note ?? ""}
          onChange={(event) => set({ ...timing, note: event.target.value || null })}
        />
      </div>
    </div>
  )
}

/** When the object appears and comes back, as a time the clock can use and the game's own words. */
export function ObjectTimings({ object, onChange }: { object: MapObject; onChange: (object: MapObject) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TimingFields
        title="Xuất hiện"
        timing={object.firstSpawn}
        onChange={(firstSpawn) => onChange({ ...object, firstSpawn })}
      />
      <TimingFields title="Làm mới" timing={object.respawn} onChange={(respawn) => onChange({ ...object, respawn })} />
    </div>
  )
}

function SectionFields({
  section,
  onChange,
  name,
}: {
  section: MapSection
  onChange: (section: MapSection) => void
  name: string
}) {
  return (
    <div className="grid gap-2">
      <Input
        aria-label={`${name}: tiêu đề`}
        placeholder="Tiêu đề, vd. Lợi ích hạ"
        value={section.title}
        onChange={(event) => onChange({ ...section, title: event.target.value })}
      />
      <Textarea
        aria-label={`${name}: nội dung`}
        placeholder="Nội dung. Dòng bắt đầu bằng “- ” là một gạch đầu dòng."
        value={section.body}
        onChange={(event) => onChange({ ...section, body: event.target.value })}
      />
    </div>
  )
}

/** The texts of the game's introduction tab, in order. */
export function ObjectSections({ object, onChange }: { object: MapObject; onChange: (object: MapObject) => void }) {
  const set = (sections: MapSection[]) => onChange({ ...object, sections })
  return (
    <div className="grid gap-2">
      {object.sections.map((section, index) => (
        <div key={index} className="grid gap-2 rounded-md border p-2">
          <div className="flex items-center gap-1">
            <span className="type-label flex-1">Đoạn {index + 1}</span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Đưa đoạn ${index + 1} lên`}
              disabled={index === 0}
              onClick={() => set(moveAt(object.sections, index, -1))}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Đưa đoạn ${index + 1} xuống`}
              disabled={index === object.sections.length - 1}
              onClick={() => set(moveAt(object.sections, index, 1))}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Xóa đoạn ${index + 1}`}
              onClick={() => set(object.sections.filter((_, other) => other !== index))}
            >
              <Trash2 />
            </Button>
          </div>
          <SectionFields
            name={`Đoạn ${index + 1}`}
            section={section}
            onChange={(next) => set(object.sections.map((row, other) => (other === index ? next : row)))}
          />
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="justify-self-start"
        onClick={() => set([...object.sections, { title: "", body: "" }])}
      >
        <Plus /> Thêm đoạn
      </Button>
    </div>
  )
}

/** The game's latest change note, shown on the Wiki under its changes switch; empty means none. */
export function ObjectChange({ object, onChange }: { object: MapObject; onChange: (object: MapObject) => void }) {
  const change = object.change ?? { title: "", body: "" }
  return (
    <SectionFields
      name="Thay đổi"
      section={change}
      onChange={(next) => onChange({ ...object, change: next.title || next.body ? next : null })}
    />
  )
}
