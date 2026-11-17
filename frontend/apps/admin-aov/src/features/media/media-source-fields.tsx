import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import { control } from "../publishing/fields"
import { OwnerNameHints, OwnerNameInput } from "./owner-name-field"
import { useTournamentAccess } from "@/features/esports/data/use-esports-data"
import { PageReferencePicker } from "@/features/community/page-reference-picker"

export function MediaSourceFields({
  value,
  onChange,
  disabled = false,
  autoFocusOwner = false,
  ownerRequired = false,
  form,
}: {
  value: MediaSourceInput
  onChange: (value: MediaSourceInput) => void
  disabled?: boolean
  /** Focus the owner field, for completing a source that only lacks its owner. */
  autoFocusOwner?: boolean
  /** New uploads must name an owner, so they never start out missing credit. */
  ownerRequired?: boolean
  /** An empty form owner keeps upload controls out of the surrounding content form. */
  form?: string
}) {
  const ownerMissing = ownerRequired && !value.ownerName?.trim()
  const access = useTournamentAccess()
  return (
    <fieldset disabled={disabled} className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Nguồn & chủ sở hữu ảnh</legend>
      <label className="grid gap-1 text-sm">
        Loại nguồn
        <select
          form={form}
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
      <div className="grid gap-1">
        <label className="grid gap-1 text-sm">
          Tên nguồn
          <input
            form={form}
            className={control}
            required
            maxLength={200}
            value={value.label}
            onChange={(event) => onChange({ ...value, label: event.target.value })}
            placeholder="Ví dụ: Garena Liên Quân, Liquipedia…"
          />
        </label>
        <span className="type-meta">Nơi bạn lấy ảnh.</span>
      </div>
      <div className="grid gap-1">
        <label className="grid gap-1 text-sm">
          Chủ sở hữu / tên cần ghi công
          <OwnerNameInput
            form={form}
            className={control}
            autoFocus={autoFocusOwner}
            required={ownerRequired}
            aria-invalid={ownerMissing || undefined}
            value={value.ownerName ?? ""}
            onValueChange={(ownerName) => onChange({ ...value, ownerName: ownerName || null })}
            placeholder="Ví dụ: Garena, BOOM Esports…"
          />
        </label>
        <OwnerNameHints
          value={value.ownerName ?? ""}
          disabled={disabled}
          onPick={(ownerName) => onChange({ ...value, ownerName })}
        />
        {ownerRequired ? (
          <span className={ownerMissing ? "type-meta text-(--aov-warning)" : "type-meta"}>
            Bắt buộc khi tải ảnh mới. Chọn tên đã dùng để mọi ảnh của cùng chủ sở hữu ghi giống nhau.
          </span>
        ) : (
          <span className="type-meta">
            Người hoặc tổ chức sở hữu ảnh. Ảnh chỉ được tính là đủ nguồn khi có mục này; để trống nếu chưa xác nhận.
          </span>
        )}
      </div>
      <label className="grid gap-1 text-sm">
        URL nguồn ảnh
        <input
          form={form}
          className={control}
          type="url"
          maxLength={2048}
          value={value.url ?? ""}
          onChange={(event) => onChange({ ...value, url: event.target.value || null })}
          placeholder="https://…"
        />
      </label>
      {access.canRead && (
        <div className="space-y-3">
          <PageReferencePicker
            label="Hồ sơ chủ sở hữu"
            value={value.ownerPageId}
            actorKey={access.actorKey}
            canWrite={!disabled}
            canCreate={access.canWrite && !disabled}
            onSelect={(profile) =>
              onChange({
                ...value,
                ownerPageId: profile?.id || null,
                ownerName: value.ownerName?.trim() || profile?.content?.name || null,
              })
            }
          />
          <PageReferencePicker
            label="Nội dung liên quan"
            value={value.relatedPageId}
            actorKey={access.actorKey}
            canWrite={!disabled}
            canCreate={access.canWrite && !disabled}
            onSelect={(profile) => onChange({ ...value, relatedPageId: profile?.id || null })}
          />
        </div>
      )}
      <label className="grid gap-1 text-sm">
        Trang liên hệ của bên cung cấp (nếu có)
        <input
          form={form}
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
