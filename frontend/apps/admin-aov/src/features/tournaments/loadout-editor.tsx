import type {
  ArcanaAllocation,
  Catalog,
  EnchantmentAllocation,
  Loadout,
  ObservationStatus,
  Participant,
} from "@aov/community-contracts"
import type { ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { CatalogPicker } from "./catalog-picker"
import { arcanaTotal, OBSERVATION_LABELS } from "./tournament-model"

/** Renders the control that records when the source showed a loadout; omitted where no clock is available. */
export type ObservedAtControl = (
  value: number | null | undefined,
  onChange: (second: number | null) => void,
  label: string,
) => ReactNode

const observed = (status: ObservationStatus) => status === "KNOWN" || status === "PARTIAL"

function ObservationSelect({
  value,
  onChange,
  label,
}: {
  value: ObservationStatus
  onChange: (value: ObservationStatus) => void
  label: string
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as ObservationStatus)}>
      {Object.entries(OBSERVATION_LABELS).map(([code, label]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  )
}

function ArcanaEditor({
  value,
  catalog,
  observedAt,
  onChange,
}: {
  value: Loadout<ArcanaAllocation>
  catalog: Catalog
  observedAt?: ObservedAtControl
  onChange: (value: Loadout<ArcanaAllocation>) => void
}) {
  const update = (index: number, entry: ArcanaAllocation) =>
    onChange({ ...value, entries: value.entries.map((current, position) => (position === index ? entry : current)) })
  return (
    <section className="tournament-loadout-section">
      <header>
        <h4>Bảng ngọc</h4>
        <ObservationSelect
          label="Mức độ quan sát bảng ngọc"
          value={value.status}
          onChange={(status) => onChange({ ...value, status, entries: observed(status) ? value.entries : [] })}
        />
        {observedAt?.(
          value.observedAtSeconds,
          (observedAtSeconds) => onChange({ ...value, observedAtSeconds }),
          "bảng ngọc",
        )}
      </header>
      {observed(value.status) ? (
        <>
          {value.status === "PARTIAL" && (
            <p className="tournament-muted">
              Ghi phần đã thấy. Khi video chỉ hiện chỉ số, để trống tên ngọc, chọn màu và số lượng rồi ghi chỉ số vào
              ghi chú.
            </p>
          )}
          <div className="tournament-arcana-totals">
            {["RED", "PURPLE", "GREEN"].map((color) => (
              <span key={color} data-color={color}>
                {{ RED: "Đỏ", PURPLE: "Tím", GREEN: "Xanh" }[color]}{" "}
                <b>
                  {value.entries.filter((entry) => entry.color === color).reduce((sum, entry) => sum + entry.count, 0)}
                  /10
                </b>
              </span>
            ))}
            <strong>
              {arcanaTotal(value.entries)}/30{value.status === "PARTIAL" ? " · một phần" : ""}
            </strong>
          </div>
          {value.entries.map((entry, index) => (
            <div className="tournament-loadout-row" key={index}>
              <CatalogPicker
                value={entry.selection}
                options={catalog.arcana}
                label={`Ngọc ${index + 1}`}
                onChange={(selection) => {
                  const ref = catalog.arcana.find((ref) => ref.id === selection.id)
                  update(index, {
                    ...entry,
                    selection,
                    color: (["RED", "PURPLE", "GREEN"].includes(ref?.color ?? "")
                      ? ref?.color
                      : entry.color) as ArcanaAllocation["color"],
                  })
                }}
              />
              <select
                aria-label={`Màu ngọc ${index + 1}`}
                value={entry.color ?? ""}
                onChange={(event) =>
                  update(index, { ...entry, color: event.target.value as ArcanaAllocation["color"] })
                }
              >
                <option value="">Màu</option>
                <option value="RED">Đỏ</option>
                <option value="PURPLE">Tím</option>
                <option value="GREEN">Xanh</option>
              </select>
              <input
                type="number"
                min={1}
                max={10}
                value={entry.count}
                aria-label={`Số lượng ngọc ${index + 1}`}
                onChange={(event) => update(index, { ...entry, count: Number(event.target.value) })}
              />
              <button
                type="button"
                className="tournament-icon-button"
                aria-label={`Xóa ngọc ${index + 1}`}
                onClick={() =>
                  onChange({ ...value, entries: value.entries.filter((_, position) => position !== index) })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={value.entries.length >= 30}
            onClick={() =>
              onChange({ ...value, entries: [...value.entries, { selection: {}, count: 1, color: "RED" }] })
            }
          >
            <Plus size={14} />
            Thêm loại ngọc
          </Button>
        </>
      ) : (
        <p className="tournament-muted">
          {value.status === "NOT_SHOWN"
            ? "Video / khu vực không hiển thị bảng ngọc; không xem đây là bảng trống."
            : "Chưa thu thập bảng ngọc của tuyển thủ."}
        </p>
      )}
      <textarea
        aria-label="Ghi chú bảng ngọc"
        placeholder="Ghi chú nguồn hoặc thông tin còn thiếu…"
        value={value.note ?? ""}
        maxLength={1000}
        onChange={(event) => onChange({ ...value, note: event.target.value })}
      />
    </section>
  )
}

function EnchantmentsEditor({
  value,
  catalog,
  observedAt,
  onChange,
}: {
  value: Loadout<EnchantmentAllocation>
  catalog: Catalog
  observedAt?: ObservedAtControl
  onChange: (value: Loadout<EnchantmentAllocation>) => void
}) {
  const update = (index: number, entry: EnchantmentAllocation) =>
    onChange({ ...value, entries: value.entries.map((current, position) => (position === index ? entry : current)) })
  const branches = [...new Set(catalog.enchantments.map((ref) => ref.branchCode).filter(Boolean))]
  return (
    <section className="tournament-loadout-section">
      <header>
        <h4>Phù hiệu</h4>
        <ObservationSelect
          label="Mức độ quan sát phù hiệu"
          value={value.status}
          onChange={(status) => onChange({ ...value, status, entries: observed(status) ? value.entries : [] })}
        />
        {observedAt?.(
          value.observedAtSeconds,
          (observedAtSeconds) => onChange({ ...value, observedAtSeconds }),
          "phù hiệu",
        )}
      </header>
      {observed(value.status) ? (
        <>
          <p className="tournament-muted">
            Nhánh chính: cấp I, II, III. Hai ô phụ: cấp I hoặc II, thuộc nhánh khác.
            {value.status === "PARTIAL" ? " Đang ghi một phần: chỉ nhập các phù hiệu đã thấy." : ""}
          </p>
          {value.entries.map((entry, index) => (
            <div className="tournament-loadout-row tournament-enchantment-row" key={index}>
              <CatalogPicker
                value={entry.selection}
                options={catalog.enchantments}
                label={`Phù hiệu ${index + 1}`}
                onChange={(selection) => {
                  const ref = catalog.enchantments.find((ref) => ref.id === selection.id)
                  update(index, {
                    ...entry,
                    selection,
                    tier: ref?.tier ?? entry.tier,
                    branchCode: ref?.branchCode ?? entry.branchCode,
                  })
                }}
              />
              <select
                aria-label={`Nhánh của phù hiệu ${index + 1}`}
                value={entry.primary ? "primary" : "secondary"}
                onChange={(event) => update(index, { ...entry, primary: event.target.value === "primary" })}
              >
                <option value="primary">Chính</option>
                <option value="secondary">Phụ</option>
              </select>
              <select
                aria-label={`Cấp phù hiệu ${index + 1}`}
                value={entry.tier}
                onChange={(event) => update(index, { ...entry, tier: Number(event.target.value) })}
              >
                {[1, 2, 3].map((tier) => (
                  <option key={tier} value={tier}>
                    {["I", "II", "III"][tier - 1]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="tournament-icon-button"
                aria-label={`Xóa phù hiệu ${index + 1}`}
                onClick={() =>
                  onChange({ ...value, entries: value.entries.filter((_, position) => position !== index) })
                }
              >
                <Trash2 size={14} />
              </button>
              <input
                list="tournament-enchantment-branches"
                aria-label={`Hệ phù hiệu ${index + 1}`}
                value={entry.branchCode ?? ""}
                placeholder="Mã hệ (khi nhập thủ công)"
                onChange={(event) => update(index, { ...entry, branchCode: event.target.value })}
              />
            </div>
          ))}
          <datalist id="tournament-enchantment-branches">
            {branches.map((branch) => (
              <option key={branch} value={branch ?? ""} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={value.entries.length >= 5}
            onClick={() =>
              onChange({
                ...value,
                entries: [
                  ...value.entries,
                  { selection: {}, primary: value.entries.filter((entry) => entry.primary).length < 3, tier: 1 },
                ],
              })
            }
          >
            <Plus size={14} />
            Thêm phù hiệu
          </Button>
        </>
      ) : (
        <p className="tournament-muted">
          {value.status === "NOT_SHOWN"
            ? "Nguồn không hiển thị phù hiệu; giữ nguyên trạng thái chưa quan sát."
            : "Chưa thu thập phù hiệu của tuyển thủ."}
        </p>
      )}
      <textarea
        aria-label="Ghi chú phù hiệu"
        placeholder="Ghi chú nguồn hoặc thông tin còn thiếu…"
        value={value.note ?? ""}
        maxLength={1000}
        onChange={(event) => onChange({ ...value, note: event.target.value })}
      />
    </section>
  )
}

export function LoadoutEditor({
  participant,
  catalog,
  observedAt,
  onChange,
}: {
  participant: Participant
  catalog: Catalog
  observedAt?: ObservedAtControl
  onChange: (participant: Participant) => void
}) {
  return (
    <div className="tournament-loadout-editor">
      <ArcanaEditor
        value={participant.arcana}
        catalog={catalog}
        observedAt={observedAt}
        onChange={(arcana) => onChange({ ...participant, arcana })}
      />
      <EnchantmentsEditor
        value={participant.enchantments}
        catalog={catalog}
        observedAt={observedAt}
        onChange={(enchantments) => onChange({ ...participant, enchantments })}
      />
    </div>
  )
}
