import { ItemRowPicker } from "./item-row-picker"
import { shopColumns } from "./item-shop-position"
import { WarehouseChangeHistory } from "./warehouse-change-history"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { AssetPicker } from "../publishing/asset-picker"
import { Field, control } from "../publishing/fields"
import { HeroAsset } from "../publishing/hero-content"
import { WarehouseTranslations } from "./warehouse-translations"
import { WarehousePatchContext } from "./warehouse-patch-context"
import { warehouseMissingFieldLabel } from "./warehouse-labels"
import { WarehouseNotes } from "./warehouse-notes"
import {
  warehouseName,
  warehouseText,
  type ItemContent,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "./warehouse-types"

export function ItemEditor({
  entry,
  items,
  categories,
  locale,
  editable,
  onClose,
  onApply,
  onFork,
  onPublish,
  busy,
}: {
  entry: WarehouseEntry<ItemContent>
  items: WarehouseEntry<ItemContent>[]
  categories: WarehouseMetadata[]
  locale: string
  editable: boolean
  onClose: () => void
  onApply: (content: ItemContent, patchId: string | null) => void
  onFork: () => void
  onPublish?: () => void
  busy: boolean
}) {
  const wide = useIsWide()
  const [value, setValue] = useState(() => structuredClone(entry.content))
  const [patchId, setPatchId] = useState(entry.revision.effectiveFromPatchVariantId)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState("gameplay")
  const [dirty, setDirty] = useState(false)
  const name = warehouseName(entry, locale)
  const change = (patch: Partial<ItemContent>) => {
    setValue((old) => ({ ...old, ...patch }))
    setDirty(true)
  }
  function close() {
    if (!uploading && (!dirty || window.confirm("Bỏ các chỉnh sửa chưa áp dụng?"))) onClose()
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(620px,90vw)] flex-col overflow-y-auto sm:max-w-none"
            : "flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-2xl"
        }
        onEscapeKeyDown={(event) => {
          if (uploading) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (uploading) event.preventDefault()
        }}
      >
        <SheetHeader className="pr-8">
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            {entry.code} · Bản {entry.revision.revisionNo} ·{" "}
            {entry.revision.state === "DRAFT" ? "Bản nháp" : "Đã xuất bản"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {entry.missingFields?.length ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <p className="font-medium">Cần hoàn thiện trước khi xuất bản</p>
              <ul className="mt-1 list-disc pl-4">
                {entry.missingFields.map((field) => (
                  <li key={field}>{warehouseMissingFieldLabel(field)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {entry.revision.state !== "DRAFT" && (
            <Button variant="outline" disabled={busy} onClick={onFork}>
              Tạo bản nháp chỉnh sửa
            </Button>
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger className="flex-1" value="gameplay">
                Thông tin & công thức
              </TabsTrigger>
              <TabsTrigger className="flex-1" value="translations">
                Bản dịch · {value.translations.length}
              </TabsTrigger>
              <TabsTrigger value="history">Lịch sử</TabsTrigger>
            </TabsList>
            <TabsContent value="gameplay" className="space-y-5 pt-3">
              <WarehousePatchContext
                rulesetId={entry.revision.rulesetId}
                value={patchId}
                onChange={(id) => {
                  setPatchId(id)
                  setDirty(true)
                }}
                disabled={!editable || busy || entry.revision.cause !== "DATA_BASELINE"}
              />
              {editable ? (
                <AssetPicker
                  semanticType="ITEM_ICON"
                  value={value.iconAssetId}
                  onChange={(iconAssetId) => change({ iconAssetId })}
                  onBusyChange={setUploading}
                />
              ) : (
                <HeroAsset id={value.iconAssetId} alt={name} className="mx-auto size-24" preview />
              )}
              <fieldset disabled={!editable || busy || uploading} className="space-y-5 disabled:opacity-60">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Giá (vàng)"
                    type="number"
                    min="0"
                    value={value.price ?? ""}
                    onChange={(v) => change({ price: v === "" ? null : Number(v) })}
                  />
                  <label className="grid gap-1.5 text-sm">
                    Cấp trang bị
                    <select
                      className={control}
                      value={value.tier ?? ""}
                      onChange={(event) => change({ tier: event.target.value ? Number(event.target.value) : null })}
                    >
                      <option value="">Chưa xác định</option>
                      {[1, 2, 3].map((tier) => (
                        <option key={tier} value={tier}>
                          Cấp {tier}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm">
                  Nhóm chính
                  <select
                    className={control}
                    value={value.categoryCode ?? ""}
                    onChange={(event) => change({ categoryCode: event.target.value || null })}
                  >
                    <option value="">Chưa chọn nhóm</option>
                    {categories.map((group) => (
                      <option key={group.code} value={group.code}>
                        {warehouseText(group.translations, locale)?.name || group.code}
                      </option>
                    ))}
                  </select>
                </label>
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Vị trí trong shop</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        change({
                          shopPositions: [
                            ...value.shopPositions,
                            {
                              categoryCode: value.categoryCode ?? categories[0]?.code ?? "",
                              row: null,
                              column: null,
                              variant: null,
                            },
                          ],
                        })
                      }
                    >
                      <Plus className="size-4" />
                      Thêm vị trí
                    </Button>
                  </div>
                  {value.shopPositions.map((position, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_100px_32px]"
                    >
                      <label className="grid gap-1 text-xs">
                        Nhóm
                        <select
                          className={control}
                          value={position.categoryCode}
                          onChange={(event) =>
                            change({
                              shopPositions: value.shopPositions.map((p, i) =>
                                i === index ? { ...p, categoryCode: event.target.value } : p,
                              ),
                            })
                          }
                        >
                          {categories.map((group) => (
                            <option key={group.code} value={group.code}>
                              {warehouseText(group.translations, locale)?.name || group.code}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs">
                        Cột
                        <select
                          className={control}
                          aria-label={`Cột vị trí ${index + 1}`}
                          value={position.column ?? ""}
                          onChange={(event) =>
                            change({
                              shopPositions: value.shopPositions.map((p, i) =>
                                i === index
                                  ? { ...p, column: event.target.value === "" ? null : Number(event.target.value) }
                                  : p,
                              ),
                            })
                          }
                        >
                          <option value="">Chọn cột</option>
                          {shopColumns(items, position.column).map((column) => (
                            <option key={column} value={column}>
                              Cột {column + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa vị trí ${index + 1}`}
                        onClick={() => change({ shopPositions: value.shopPositions.filter((_, i) => i !== index) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <ItemRowPicker
                        entry={{ ...entry, content: value }}
                        items={items}
                        positionIndex={index}
                        locale={locale}
                        contextLabel={
                          warehouseText(
                            categories.find((group) => group.code === position.categoryCode)?.translations ?? [],
                            locale,
                          )?.name ?? position.categoryCode
                        }
                        disabled={!editable || busy || uploading}
                        onChange={(row) =>
                          change({
                            shopPositions: value.shopPositions.map((p, i) => (i === index ? { ...p, row } : p)),
                          })
                        }
                      />
                      <div className="col-span-full">
                        <Field
                          label="Nhánh (nếu có)"
                          value={position.variant ?? ""}
                          onChange={(variant) =>
                            change({
                              shopPositions: value.shopPositions.map((p, i) =>
                                i === index ? { ...p, variant: variant || null } : p,
                              ),
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </section>
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">Công thức trực tiếp</h3>
                  <select
                    aria-label="Trạng thái công thức"
                    className={control}
                    value={value.recipeStatus}
                    onChange={(event) =>
                      change({
                        recipeStatus: event.target.value as ItemContent["recipeStatus"],
                        ...(event.target.value !== "VERIFIED" ? { components: [] } : {}),
                      })
                    }
                  >
                    <option value="UNKNOWN">Chưa xác nhận</option>
                    <option value="NONE">Không cần ghép</option>
                    <option value="VERIFIED">Đã xác nhận công thức</option>
                  </select>
                  {value.components.map((part, index) => (
                    <div key={part.itemId} className="flex items-end gap-2">
                      <label className="grid min-w-0 flex-1 gap-1 text-xs">
                        Nguyên liệu
                        <select
                          className={control}
                          value={part.itemId}
                          onChange={(event) =>
                            change({
                              components: value.components.map((p, i) =>
                                i === index ? { ...p, itemId: event.target.value } : p,
                              ),
                            })
                          }
                        >
                          {items
                            .filter(
                              (item) =>
                                item.id !== entry.id &&
                                !value.components.some((p) => p.itemId === item.id && p !== part),
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {warehouseName(item, locale)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="w-20">
                        <Field
                          label="Số lượng"
                          type="number"
                          min="1"
                          value={part.quantity}
                          onChange={(v) =>
                            change({
                              components: value.components.map((p, i) =>
                                i === index ? { ...p, quantity: Number(v) } : p,
                              ),
                            })
                          }
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Bỏ nguyên liệu ${index + 1}`}
                        onClick={() => change({ components: value.components.filter((_, i) => i !== index) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={items.length < 2}
                    onClick={() => {
                      const candidate = items.find(
                        (item) => item.id !== entry.id && !value.components.some((p) => p.itemId === item.id),
                      )
                      if (candidate)
                        change({
                          recipeStatus: "VERIFIED",
                          components: [...value.components, { itemId: candidate.id, quantity: 1 }],
                        })
                    }}
                  >
                    <Plus className="size-4" />
                    Thêm nguyên liệu
                  </Button>
                  {value.components.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Giá nguyên liệu:{" "}
                      {value.components
                        .reduce(
                          (sum, p) =>
                            sum + (items.find((item) => item.id === p.itemId)?.content.price ?? 0) * p.quantity,
                          0,
                        )
                        .toLocaleString("vi-VN")}{" "}
                      vàng. Chênh lệch giá chưa được coi là phí ghép.
                    </p>
                  )}
                </section>
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Chỉ số</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => change({ stats: [...value.stats, { key: "", value: 0, unit: null }] })}
                    >
                      <Plus className="size-4" />
                      Thêm chỉ số
                    </Button>
                  </div>
                  {value.stats.map((stat, index) => (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_80px_60px_32px] items-end gap-2">
                      <Field
                        label="Mã chỉ số"
                        value={stat.key}
                        onChange={(key) =>
                          change({ stats: value.stats.map((s, i) => (i === index ? { ...s, key } : s)) })
                        }
                      />
                      <Field
                        label="Giá trị"
                        type="number"
                        step="any"
                        value={stat.value}
                        onChange={(v) =>
                          change({ stats: value.stats.map((s, i) => (i === index ? { ...s, value: Number(v) } : s)) })
                        }
                      />
                      <Field
                        label="Đơn vị"
                        value={stat.unit ?? ""}
                        onChange={(unit) =>
                          change({ stats: value.stats.map((s, i) => (i === index ? { ...s, unit: unit || null } : s)) })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa chỉ số ${index + 1}`}
                        onClick={() => change({ stats: value.stats.filter((_, i) => i !== index) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </section>
                <WarehouseNotes
                  value={value.notes}
                  onChange={(notes) => change({ notes })}
                  disabled={!editable || busy}
                />
              </fieldset>
            </TabsContent>
            <TabsContent value="translations" className="pt-3">
              <WarehouseTranslations
                value={value.translations}
                onChange={(translations) => change({ translations })}
                locale={locale}
                disabled={!editable || busy}
                showSummary
                showEffects
                statKeys={value.stats.map((stat) => stat.key)}
                variantKeys={[
                  ...new Set(value.shopPositions.map((position) => position.variant).filter((v): v is string => !!v)),
                ]}
              />
            </TabsContent>
            <TabsContent value="history" className="pt-3">
              <WarehouseChangeHistory
                kind="items"
                entryId={entry.id}
                rulesetId={entry.revision.rulesetId}
                locale={locale}
              />
            </TabsContent>
          </Tabs>
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background py-3">
            {onPublish && (
              <Button
                variant="outline"
                disabled={busy || uploading || dirty || !!entry.missingFields?.length}
                onClick={onPublish}
              >
                Xuất bản
              </Button>
            )}
            {editable && (
              <Button
                disabled={busy || uploading || !dirty}
                onClick={() => {
                  onApply(value, patchId)
                  setDirty(false)
                }}
              >
                Áp dụng vào bản đang sửa
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
