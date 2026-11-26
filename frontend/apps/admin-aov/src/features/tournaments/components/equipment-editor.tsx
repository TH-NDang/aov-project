import { useState, type ChangeEvent } from "react"
import type { Catalog, EquipmentEvent, EquipmentSnapshot, Participant } from "@aov/community-contracts"
import { Camera, ChevronRight, Clock3, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { CatalogPicker } from "./catalog-picker"
import { emptySnapshot, minuteLabel, parseGameTime } from "../model/tournament-model"
import { NativeSelect } from "@/components/native-select"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"

const EVENT_LABELS = { BUY: "Mua", SELL: "Bán", UPGRADE: "Ghép/nâng cấp", SWAP: "Đổi ô" } as const

/** A note that is kept when its field is left, since every change is a request. */
function useNote(note: string | undefined, commit: (note: string) => void) {
  const [text, setText] = useState(note ?? "")
  const [shown, setShown] = useState(note ?? "")
  // A note that was taken back, or changed elsewhere, replaces what the field shows.
  if (shown !== (note ?? "")) {
    setShown(note ?? "")
    setText(note ?? "")
  }
  return {
    value: text,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(event.target.value),
    onBlur: () => {
      if (text !== (note ?? "")) commit(text)
    },
    maxLength: 1000,
  }
}

function SnapshotEditor({
  value,
  catalog,
  onChange,
  onRemove,
}: {
  value: EquipmentSnapshot
  catalog: Catalog
  onChange: (value: EquipmentSnapshot) => void
  onRemove: () => void
}) {
  const note = useNote(value.note, (note) => onChange({ ...value, note }))
  return (
    <section className="tournament-inventory">
      <header>
        <h4>
          <Camera size={14} />
          {minuteLabel(value.atSeconds)}
        </h4>
        <button
          type="button"
          className="tournament-icon-button"
          aria-label={`Xóa mốc ${minuteLabel(value.atSeconds)}`}
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </button>
      </header>
      <div className="tournament-inventory-slots">
        {value.slots.map((slot, index) => (
          <div key={slot.slot} className="tournament-inventory-slot">
            <span>Ô {slot.slot}</span>
            <NativeSelect
              aria-label={`Trạng thái ô ${slot.slot}`}
              className="px-2"
              value={!slot.known ? "unknown" : slot.item ? "item" : "empty"}
              onChange={(event) =>
                onChange({
                  ...value,
                  slots: value.slots.map((current, position) =>
                    position === index
                      ? {
                          ...current,
                          known: event.target.value !== "unknown",
                          item: event.target.value === "item" ? {} : null,
                        }
                      : current,
                  ),
                })
              }
            >
              <option value="unknown">Không rõ</option>
              <option value="empty">Trống</option>
              <option value="item">Có trang bị</option>
            </NativeSelect>
            {slot.known && slot.item && (
              <CatalogPicker
                compact
                label={`Trang bị ô ${slot.slot}`}
                value={slot.item}
                options={catalog.items}
                onChange={(item) =>
                  onChange({
                    ...value,
                    slots: value.slots.map((current, position) =>
                      position === index ? { ...current, item } : current,
                    ),
                  })
                }
              />
            )}
          </div>
        ))}
      </div>
      <Textarea
        aria-label={`Ghi chú mốc ${minuteLabel(value.atSeconds)}`}
        placeholder="Ghi chú mốc quan sát…"
        className="min-h-9"
        {...note}
      />
    </section>
  )
}

function EventEditor({
  value,
  catalog,
  onChange,
  onRemove,
}: {
  value: EquipmentEvent
  catalog: Catalog
  onChange: (value: EquipmentEvent) => void
  onRemove: () => void
}) {
  const note = useNote(value.note, (note) => onChange({ ...value, note }))
  return (
    <div className="tournament-equipment-event">
      <strong>{minuteLabel(value.atSeconds)}</strong>
      <NativeSelect
        aria-label="Loại biến động trang bị"
        value={value.type}
        onChange={(event) => onChange({ ...value, type: event.target.value as EquipmentEvent["type"] })}
      >
        {Object.entries(EVENT_LABELS).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <CatalogPicker
        label="Trang bị biến động"
        value={value.item}
        options={catalog.items}
        onChange={(item) => onChange({ ...value, item })}
      />
      {value.type === "UPGRADE" && (
        <CatalogPicker
          label="Trang bị được thay thế"
          value={value.replacedItem}
          options={catalog.items}
          onChange={(replacedItem) => onChange({ ...value, replacedItem })}
        />
      )}
      <label>
        Ô đi
        <NativeSelect
          aria-label="Ô trang bị trước biến động"
          value={value.fromSlot ?? ""}
          onChange={(event) =>
            onChange({ ...value, fromSlot: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <option value="">Không rõ</option>
          {[1, 2, 3, 4, 5, 6].map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label>
        Ô đến
        <NativeSelect
          aria-label="Ô trang bị sau biến động"
          value={value.toSlot ?? ""}
          onChange={(event) =>
            onChange({ ...value, toSlot: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <option value="">Không rõ</option>
          {[1, 2, 3, 4, 5, 6].map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Input aria-label="Ghi chú biến động trang bị" placeholder="Nguồn, ghi chú…" {...note} />
      <button type="button" className="tournament-icon-button" aria-label="Xóa biến động trang bị" onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/** How much is recorded, so the folded part says whether opening it is worth it. */
function recorded({ equipmentSnapshots, equipmentEvents }: Participant) {
  const parts = [
    equipmentSnapshots.length && `${equipmentSnapshots.length} mốc`,
    equipmentEvents.length && `${equipmentEvents.length} lần mua bán`,
  ].filter(Boolean)
  return parts.join(", ") || "chưa có"
}

/**
 * What the source showed of the six slots at a moment of the game, and what it showed being bought and sold. Folded: the
 * list of what a player built is recorded without it, and reads the last moment while nobody wrote one. A purchase or a
 * sale is recorded in the form of a moment, which knows the item and the slot the service asks for; here the recorded
 * ones are read and corrected.
 */
export function EquipmentEditor({
  participant,
  catalog,
  nowGame,
  onChange,
}: {
  participant: Participant
  catalog: Catalog
  /** The game second the video is at, when a synced video plays beside the editor. */
  nowGame?: number | null
  onChange: (participant: Participant) => void
}) {
  // Recording follows the video, so a new mark starts at the moment on screen instead of 00:00.
  const [time, setTime] = useState(() => minuteLabel(nowGame ?? 0))
  const [error, setError] = useState("")
  function addSnapshot() {
    const seconds = parseGameTime(time)
    if (seconds === null) {
      setError("Nhập thời gian trong ván theo phút:giây, ví dụ 05:30.")
      return
    }
    if (participant.equipmentSnapshots.some((snapshot) => snapshot.atSeconds === seconds)) {
      setError("Mốc này đã có. Hãy sửa mốc hiện tại hoặc chọn thời điểm khác.")
      return
    }
    setError("")
    onChange({
      ...participant,
      equipmentSnapshots: [...participant.equipmentSnapshots, emptySnapshot(seconds)].sort(
        (a, b) => a.atSeconds - b.atSeconds,
      ),
    })
  }
  // An empty mark goes at once; one that holds something is named first, because it has no other copy.
  async function removeSnapshot(snapshot: EquipmentSnapshot) {
    const known = snapshot.slots.filter((slot) => slot.known).length
    const confirmed =
      (!known && !snapshot.note?.trim()) ||
      (await confirmAction({
        title: `Xóa mốc ${minuteLabel(snapshot.atSeconds)}?`,
        description: `${known} ô đã ghi${snapshot.note?.trim() ? " và ghi chú" : ""} → không còn mốc này.`,
        confirmLabel: "Xóa mốc",
      }))
    if (confirmed)
      onChange({
        ...participant,
        equipmentSnapshots: participant.equipmentSnapshots.filter((entry) => entry !== snapshot),
      })
  }
  async function removeEvent(event: EquipmentEvent) {
    const item = [event.item, event.replacedItem].map((entry) => entry?.name?.trim()).filter(Boolean)
    const confirmed =
      (!item.length && !event.note?.trim()) ||
      (await confirmAction({
        title: "Xóa biến động trang bị?",
        description: `${[minuteLabel(event.atSeconds), EVENT_LABELS[event.type], ...item].join(", ")} → không còn.`,
        confirmLabel: "Xóa biến động",
      }))
    if (confirmed)
      onChange({ ...participant, equipmentEvents: participant.equipmentEvents.filter((entry) => entry !== event) })
  }
  return (
    <details className="group/marks border-t pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={15}
          className="shrink-0 text-muted-foreground transition-transform group-open/marks:rotate-90"
          aria-hidden="true"
        />
        <span className="text-sm font-semibold">Mốc trang bị theo thời gian</span>
        <span className="type-meta">{recorded(participant)}</span>
      </summary>
      <div className="tournament-equipment-editor pt-3">
        <p className="tournament-muted">
          Mỗi mốc ghi 6 ô đã nhìn thấy. “Trống” khác “Không rõ”. Chỉ ghi mua/bán khi nguồn xác nhận; không suy ra giao
          dịch từ hai ảnh.
        </p>
        <div className="tournament-equipment-add">
          <label>
            Thời gian trong ván
            <Input
              value={time}
              onChange={(event) => setTime(event.target.value)}
              aria-label="Thời điểm trang bị trong ván"
              placeholder="00:00"
              inputMode="numeric"
            />
          </label>
          {nowGame != null && minuteLabel(nowGame) !== time && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setTime(minuteLabel(nowGame))}>
              <Clock3 size={14} />
              Lấy lúc video {minuteLabel(nowGame)}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addSnapshot}>
            <Camera size={14} />
            Thêm mốc 6 ô
          </Button>
        </div>
        {error && (
          <p className="tournament-error" role="alert">
            {error}
          </p>
        )}
        {participant.equipmentSnapshots.map((snapshot, index) => (
          <SnapshotEditor
            key={`${snapshot.atSeconds}-${index}`}
            value={snapshot}
            catalog={catalog}
            onRemove={() => void removeSnapshot(snapshot)}
            onChange={(value) =>
              onChange({
                ...participant,
                equipmentSnapshots: participant.equipmentSnapshots.map((current, position) =>
                  position === index ? value : current,
                ),
              })
            }
          />
        ))}
        {!!participant.equipmentEvents.length && (
          <h4 className="tournament-section-title">
            <Plus size={14} />
            Biến động được xác nhận
          </h4>
        )}
        {participant.equipmentEvents.map((event, index) => (
          <EventEditor
            key={index}
            value={event}
            catalog={catalog}
            onRemove={() => void removeEvent(event)}
            onChange={(value) =>
              onChange({
                ...participant,
                equipmentEvents: participant.equipmentEvents.map((current, position) =>
                  position === index ? value : current,
                ),
              })
            }
          />
        ))}
        {!participant.equipmentSnapshots.length && !participant.equipmentEvents.length && (
          <p className="tournament-empty-inline">
            Chưa có mốc trang bị. Không được coi là tuyển thủ không mua trang bị.
          </p>
        )}
      </div>
    </details>
  )
}
