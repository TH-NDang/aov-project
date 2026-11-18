import { type ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { Button } from "@aov/ui/components/button"
import { HeroAsset } from "@/features/publishing/components/editing/hero-asset"
import { Field, control } from "../../../publishing/components/editing/fields"
import { warehouseText } from "@aov/ui/lib/warehouse-content"
import type { SecondaryKind, SecondaryContent, SecondaryBranch } from "../../model/secondary-content"

export function SecondaryMechanics({
  part,
  kind,
  content,
  onChange,
  branches,
  locale,
  disabled,
  enchantmentOrderControl,
}: {
  kind: SecondaryKind
  content: SecondaryContent
  onChange: (value: Partial<SecondaryContent>) => void
  branches: SecondaryBranch[]
  locale: string
  disabled: boolean
  part: "mechanics" | "states" | "stats"
  enchantmentOrderControl?: ReactNode
}) {
  if (kind === "enchantments")
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <span className="type-label">Hệ phù hiệu</span>
          <Select
            value={content.branchCode || ""}
            disabled={disabled}
            onValueChange={(branchCode) => onChange({ branchCode })}
          >
            <SelectTrigger className="w-full" aria-label="Hệ phù hiệu">
              <SelectValue placeholder="Chọn hệ" />
            </SelectTrigger>
            <SelectContent>
              {content.branchCode && !branches.some((branch) => branch.code === content.branchCode) && (
                <SelectItem value={content.branchCode}>{content.branchCode}</SelectItem>
              )}
              {branches.map((branch) => (
                <SelectItem key={branch.code} value={branch.code}>
                  <span className="flex items-center gap-2">
                    <HeroAsset id={branch.iconAssetId} frameAspectRatio={1} className="size-5 rounded-full" />
                    {warehouseText(branch.translations, locale)?.name || branch.code}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TierField value={content.tier ?? 1} disabled={disabled} onChange={(tier) => onChange({ tier })} />
        <div className="self-end">{enchantmentOrderControl}</div>
      </div>
    )
  if (kind === "arcana")
    return (
      <div className="space-y-5">
        {part === "mechanics" && (
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1.5 text-sm">
              <span>Màu ngọc</span>
              <select
                className={control}
                value={content.color ?? "RED"}
                disabled={disabled}
                onChange={(event) => onChange({ color: event.target.value as SecondaryContent["color"] })}
              >
                <option value="RED">Đỏ</option>
                <option value="PURPLE">Tím</option>
                <option value="GREEN">Xanh</option>
              </select>
            </label>
            <TierField value={content.tier ?? 3} disabled={disabled} onChange={(tier) => onChange({ tier })} />
          </div>
        )}
      </div>
    )
  return (
    <div className="space-y-5">
      {part === "mechanics" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Hồi chiêu (giây)"
              type="number"
              min={0}
              value={content.cooldownSeconds ?? ""}
              onChange={(value) => onChange({ cooldownSeconds: value === "" ? null : Number(value) })}
              disabled={disabled}
            />
            <label className="grid gap-1.5 text-sm">
              <span>Khả dụng</span>
              <select
                className={control}
                value={content.availability ?? "UNKNOWN"}
                disabled={disabled}
                onChange={(event) => onChange({ availability: event.target.value as SecondaryContent["availability"] })}
              >
                <option value="AVAILABLE">Đang có</option>
                <option value="REMOVED">Đã gỡ</option>
                <option value="UNKNOWN">Chưa xác định</option>
              </select>
            </label>
            <Field
              label="Thứ tự hiển thị"
              type="number"
              min={0}
              step={1}
              value={content.displayOrder ?? 0}
              onChange={(value) => onChange({ displayOrder: Number(value) })}
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Số lần tích trữ"
              type="number"
              min={1}
              step={1}
              value={content.maxCharges ?? ""}
              onChange={(value) => onChange({ maxCharges: value === "" ? null : Number(value) })}
              disabled={disabled}
            />
            <Field
              label="Thời gian tích (giây)"
              type="number"
              min={0}
              value={content.chargeRechargeSeconds ?? ""}
              onChange={(value) => onChange({ chargeRechargeSeconds: value === "" ? null : Number(value) })}
              disabled={disabled}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={content.legacy ?? false}
              disabled={disabled}
              onChange={(event) => onChange({ legacy: event.target.checked })}
            />{" "}
            Phụ trợ cũ
          </label>
        </>
      )}
      {part === "states" && (
        <section className="space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                onChange({
                  states: [
                    ...(content.states ?? []),
                    {
                      key: "",
                      iconAssetId: null,
                      translations: [{ locale, name: "", summary: null, description: null }],
                    },
                  ],
                })
              }
            >
              <Plus className="size-4" /> Thêm
            </Button>
          </div>
          {content.states?.map((state, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={`Mã trạng thái ${index + 1}`}
                  value={state.key}
                  disabled={disabled}
                  onChange={(key) =>
                    onChange({
                      states: content.states!.map((entry, n) => (n === index ? { ...entry, key } : entry)),
                      ...(content.defaultStateKey === state.key ? { defaultStateKey: key || null } : {}),
                    })
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Bỏ trạng thái ${index + 1}`}
                onClick={() =>
                  onChange({
                    states: content.states!.filter((_, n) => n !== index),
                    ...(content.defaultStateKey === state.key ? { defaultStateKey: null } : {}),
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {!!content.states?.length && (
            <label className="grid gap-1.5 text-sm">
              <span>Trạng thái mặc định</span>
              <select
                className={control}
                value={content.defaultStateKey ?? ""}
                disabled={disabled}
                onChange={(event) => onChange({ defaultStateKey: event.target.value || null })}
              >
                <option value="">Chưa chọn</option>
                {content.states
                  .filter((state) => state.key)
                  .map((state) => (
                    <option key={state.key} value={state.key}>
                      {warehouseText(state.translations, locale)?.name || state.key}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </section>
      )}
    </div>
  )
}

export function TierField({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span>Cấp</span>
      <select
        className={control}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
      >
        {[1, 2, 3].map((tier) => (
          <option key={tier} value={tier}>
            {["I", "II", "III"][tier - 1]}
          </option>
        ))}
      </select>
    </label>
  )
}
