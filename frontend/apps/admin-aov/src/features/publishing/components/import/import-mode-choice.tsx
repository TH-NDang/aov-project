import { Database, GitCompareArrows, PencilLine } from "lucide-react"
import type { HeroImportInput } from "../../model/import/hero-import-types"

type Mode = HeroImportInput["mode"]

const modes = [
  {
    key: "BASELINE",
    title: "Dữ liệu ban đầu",
    icon: Database,
    description: "Ghi nhận trạng thái tại patch này. Phù hợp khi chưa có lịch sử hoặc bổ sung một mốc quá khứ.",
  },
  {
    key: "PATCH_UPDATE",
    title: "Cập nhật theo patch",
    icon: GitCompareArrows,
    description: "Đối chiếu mốc đã biết trước đó. Chưa có mốc so sánh sẽ được đánh dấu để bạn xử lý.",
  },
  {
    key: "CORRECTION",
    title: "Bổ sung / sửa dữ liệu",
    icon: PencilLine,
    description: "Sửa thông tin của mốc đã có tại patch này. Không tính là thay đổi của game.",
  },
] as const

/** The name of an import purpose, as the mapping and review steps repeat it. */
export const importModeTitle = (mode: Mode) => modes.find((item) => item.key === mode)?.title

/** What the import is for, which decides how the server compares each row with what it already holds. */
export function ImportModeChoice({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}
      role="radiogroup"
      aria-label="Mục đích nhập dữ liệu"
    >
      {modes.map((m) => (
        <label
          key={m.key}
          className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-colors ${mode === m.key ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/40"}`}
        >
          <span className="flex items-center justify-between">
            <m.icon className={`size-5 ${mode === m.key ? "text-primary" : "text-muted-foreground"}`} />
            <input
              type="radio"
              name="import-mode"
              value={m.key}
              checked={mode === m.key}
              onChange={() => onChange(m.key)}
            />
          </span>
          <span className="text-sm font-semibold">{m.title}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{m.description}</span>
        </label>
      ))}
    </div>
  )
}
