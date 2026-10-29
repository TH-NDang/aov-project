import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import { control } from "../publishing/fields"

export function MediaSourceFields({
  value,
  onChange,
  disabled = false,
}: {
  value: MediaSourceInput
  onChange: (value: MediaSourceInput) => void
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Nguồn & chủ sở hữu ảnh</legend>
      <label className="grid gap-1 text-sm">
        Loại nguồn
        <select
          className={control}
          value={value.type ?? "OTHER"}
          onChange={(event) => onChange({ ...value, type: event.target.value })}
        >
          <option value="OFFICIAL">Kênh chính thức</option>
          <option value="GAME_CLIENT">Chụp / trích xuất từ game</option>
          <option value="COMMUNITY">Cộng đồng</option>
          <option value="OTHER">Khác / chưa xác minh</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Tên nguồn
        <input
          className={control}
          required
          maxLength={200}
          value={value.label}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
          placeholder="Ví dụ: Garena Liên Quân, Liquipedia…"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Chủ sở hữu / tên cần credit
        <input
          className={control}
          maxLength={200}
          value={value.ownerName ?? ""}
          onChange={(event) => onChange({ ...value, ownerName: event.target.value || null })}
          placeholder="Để trống nếu chưa xác nhận"
        />
      </label>
      <label className="grid gap-1 text-sm">
        URL nguồn ảnh
        <input
          className={control}
          type="url"
          maxLength={2048}
          value={value.url ?? ""}
          onChange={(event) => onChange({ ...value, url: event.target.value || null })}
          placeholder="https://…"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Trang liên hệ của bên cung cấp (nếu có)
        <input
          className={control}
          type="url"
          maxLength={2048}
          value={value.contactUrl ?? ""}
          onChange={(event) => onChange({ ...value, contactUrl: event.target.value || null })}
          placeholder="https://…"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Giữ tên nơi lấy ảnh riêng với chủ sở hữu. Mục Liên hệ của Wiki luôn có trên khung nguồn ảnh.
      </p>
    </fieldset>
  )
}
