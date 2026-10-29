import { useState } from "react"
import type { Catalog, EquipmentEvent, EquipmentSnapshot, Participant } from "@aov/community-contracts"
import { ArrowDownUp, Camera, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { CatalogPicker } from "./catalog-picker"
import { emptySnapshot, minuteLabel, parseGameTime } from "./tournament-model"

const EVENT_LABELS = { BUY: "Mua", SELL: "Bán", UPGRADE: "Ghép / nâng cấp", SWAP: "Đổi ô" } as const

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
            <select
              aria-label={`Trạng thái ô ${slot.slot}`}
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
            </select>
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
      <textarea
        aria-label={`Ghi chú mốc ${minuteLabel(value.atSeconds)}`}
        placeholder="Ghi chú mốc quan sát…"
        value={value.note ?? ""}
        onChange={(event) => onChange({ ...value, note: event.target.value })}
        maxLength={1000}
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
  return (
    <div className="tournament-equipment-event">
      <strong>{minuteLabel(value.atSeconds)}</strong>
      <select
        aria-label="Loại biến động trang bị"
        value={value.type}
        onChange={(event) => onChange({ ...value, type: event.target.value as EquipmentEvent["type"] })}
      >
        {Object.entries(EVENT_LABELS).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
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
        <select
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
        </select>
      </label>
      <label>
        Ô đến
        <select
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
        </select>
      </label>
      <input
        aria-label="Ghi chú biến động trang bị"
        placeholder="Nguồn / ghi chú…"
        value={value.note ?? ""}
        onChange={(event) => onChange({ ...value, note: event.target.value })}
        maxLength={1000}
      />
      <button type="button" className="tournament-icon-button" aria-label="Xóa biến động trang bị" onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function EquipmentEditor({
  participant,
  catalog,
  onChange,
}: {
  participant: Participant
  catalog: Catalog
  onChange: (participant: Participant) => void
}) {
  const [time, setTime] = useState("00:00")
  const [error, setError] = useState("")
  function add(type: "snapshot" | "event") {
    const seconds = parseGameTime(time)
    if (seconds === null) {
      setError("Nhập thời gian trong ván theo phút:giây, ví dụ 05:30.")
      return
    }
    if (type === "snapshot" && participant.equipmentSnapshots.some((snapshot) => snapshot.atSeconds === seconds)) {
      setError("Mốc này đã có. Hãy sửa mốc hiện tại hoặc chọn thời điểm khác.")
      return
    }
    setError("")
    if (type === "snapshot")
      onChange({
        ...participant,
        equipmentSnapshots: [...participant.equipmentSnapshots, emptySnapshot(seconds)].sort(
          (a, b) => a.atSeconds - b.atSeconds,
        ),
      })
    else
      onChange({
        ...participant,
        equipmentEvents: [...participant.equipmentEvents, { atSeconds: seconds, type: "BUY" as const }].sort(
          (a, b) => a.atSeconds - b.atSeconds,
        ),
      })
  }
  return (
    <div className="tournament-equipment-editor">
      <p className="tournament-muted">
        Mỗi mốc ghi 6 ô đã nhìn thấy. “Trống” khác “Không rõ”. Chỉ ghi mua/bán khi nguồn xác nhận; không suy ra giao
        dịch từ hai ảnh.
      </p>
      <div className="tournament-equipment-add">
        <label>
          Thời gian trong ván
          <input
            value={time}
            onChange={(event) => setTime(event.target.value)}
            aria-label="Thời điểm trang bị trong ván"
            placeholder="00:00"
            inputMode="numeric"
          />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => add("snapshot")}>
          <Camera size={14} />
          Thêm mốc 6 ô
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("event")}>
          <ArrowDownUp size={14} />
          Ghi mua / bán
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
          onRemove={() =>
            onChange({
              ...participant,
              equipmentSnapshots: participant.equipmentSnapshots.filter((_, position) => position !== index),
            })
          }
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
          onRemove={() =>
            onChange({
              ...participant,
              equipmentEvents: participant.equipmentEvents.filter((_, position) => position !== index),
            })
          }
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
        <p className="tournament-empty-inline">Chưa có mốc trang bị. Không được coi là tuyển thủ không mua đồ.</p>
      )}
    </div>
  )
}
