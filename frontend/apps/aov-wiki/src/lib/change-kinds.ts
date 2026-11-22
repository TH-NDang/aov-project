import { wikiText } from "../context/wiki-context"

/** What each kind of published change is called. */
const labels: Record<string, [string, string]> = {
  ADDED: ["Mới", "New"],
  REMOVED: ["Đã gỡ", "Removed"],
  BUFF: ["Tăng sức mạnh", "Buff"],
  NERF: ["Giảm sức mạnh", "Nerf"],
  REWORK: ["Làm lại", "Rework"],
  FIX: ["Sửa lỗi", "Fix"],
  RELEASE: ["Ra mắt", "New hero"],
  ADJUSTMENT: ["Điều chỉnh", "Adjustment"],
  BALANCE: ["Cân bằng", "Balance"],
  UPDATED: ["Cập nhật", "Updated"],
}

/** The order readers look for: what is new, what was remade, what got stronger, what got weaker, then the rest. */
export const KIND_ORDER = [
  "RELEASE",
  "ADDED",
  "REWORK",
  "BUFF",
  "NERF",
  "ADJUSTMENT",
  "BALANCE",
  "FIX",
  "UPDATED",
  "REMOVED",
]

/** The colour a kind of change is read by; every other kind reads as an adjustment. */
const TONES: Record<string, string> = { RELEASE: "new", ADDED: "new", REWORK: "rework", BUFF: "up", NERF: "down" }

export function patchChangeTone(kind: string) {
  return TONES[kind] ?? "adjust"
}

export function patchChangeLabel(kind: string, locale: string) {
  return wikiText(locale, ...(labels[kind] ?? labels.UPDATED!))
}
