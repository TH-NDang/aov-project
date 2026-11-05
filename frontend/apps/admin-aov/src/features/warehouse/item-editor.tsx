import { ItemCategoryIcon, ItemCategorySelect } from "./item-category-icon"
import { ItemOverview } from "./item-overview"
import { ItemRecipe } from "./item-recipe"
import { ItemRowPicker } from "./item-row-picker"
import { shopColumns } from "./item-shop-position"
import { WarehouseChangeHistory } from "./warehouse-change-history"
import { useState } from "react"
import { Coins, History, Languages, ArrowLeft, Plus, Settings2, Trash2 } from "lucide-react"
import { SectionPencil, type WarehouseSection } from "./warehouse-edit-section"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { AssetPicker } from "../publishing/asset-picker"
import { Field, control } from "../publishing/fields"
import { HeroAsset } from "../publishing/hero-content"
import { WarehouseTranslations } from "./warehouse-translations"
import { WarehousePatchContext } from "./warehouse-patch-context"
import { warehouseMissingFieldLabel } from "./warehouse-labels"
import { WarehouseStatsEditor } from "./warehouse-stats-editor"
import { WarehouseNotes } from "./warehouse-notes"
import {
  warehouseName,
  warehouseText,
  warehouseBaselineMode,
  type ItemContent,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "./warehouse-types"

export function ItemEditor({
  entry,
  items,
  relatedItems,
  onView,
  categories,
  locale,
  editable,
  initialSection,
  initialLanguage,
  onLanguageChange,
  translationOnly = false,
  onClose,
  onApply,
  onFork,
  onOpenDraft,
  onPublish,
  busy,
}: {
  entry: WarehouseEntry<ItemContent>
  items: WarehouseEntry<ItemContent>[]
  relatedItems: WarehouseEntry<ItemContent>[]
  onView: (item: WarehouseEntry<ItemContent>) => void
  categories: WarehouseMetadata[]
  locale: string
  editable: boolean
  onClose: () => void
  onApply: (content: ItemContent, patchId: string | null) => void
  translationOnly?: boolean
  initialSection?: WarehouseSection
  initialLanguage?: string
  onLanguageChange?: (language: string) => void
  onFork?: (section: WarehouseSection) => void
  onOpenDraft?: (section: WarehouseSection) => void
  onPublish?: () => void
  busy: boolean
}) {
  const wide = useIsWide()
  const [value, setValue] = useState(() => structuredClone(entry.content))
  const [patchId, setPatchId] = useState(entry.revision.effectiveFromPatchVariantId)
  const [uploading, setUploading] = useState(false)
  const [section, setSection] = useState(initialSection)
  const [tab, setTab] = useState(initialSection === "translations" ? "translations" : "gameplay")
  const [dirty, setDirty] = useState(false)
  const canEdit = editable || !!onFork || !!onOpenDraft
  const focused = editable && ["details", "stats", "recipe", "positions"].includes(section ?? "")
  function pencil(target: WarehouseSection, className?: string) {
    if (!canEdit || (translationOnly && target !== "translations" && target !== "context")) return null
    const active = editable && section === target && tab === (target === "translations" ? "translations" : "gameplay")
    return (
      <SectionPencil
        section={target}
        active={active}
        className={className}
        disabled={busy || uploading}
        draftAction={editable ? undefined : onOpenDraft ? "open" : "create"}
        onClick={() => {
          if (!editable) return (onOpenDraft ?? onFork)?.(target)
          setSection(active ? undefined : target)
          setTab(target === "translations" ? "translations" : "gameplay")
        }}
      />
    )
  }
  const name = warehouseName({ ...entry, content: value }, locale)
  const category = categories.find((group) => group.code === value.categoryCode)
  const baselineMode = warehouseBaselineMode(entry.revision, entry.missingFields)
  const visibleMissing = (entry.missingFields ?? []).filter(
    (field) => field !== "effectiveFromPatchVariantId" || !!patchId || !baselineMode,
  )
  const change = (patch: Partial<ItemContent>) => {
    setValue((old) => ({ ...old, ...patch }))
    setDirty(true)
  }
  function close() {
    if (!busy && !uploading && (!dirty || window.confirm("Bỏ các chỉnh sửa chưa áp dụng?"))) onClose()
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
            ? "flex w-[min(640px,94vw)] flex-col gap-0 overflow-hidden sm:max-w-none"
            : "flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl"
        }
        onEscapeKeyDown={(event) => {
          if (uploading) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (uploading) event.preventDefault()
        }}
      >
        <SheetHeader className="shrink-0 flex-row items-center gap-3 border-b pr-10">
          <div className="relative shrink-0">
            <HeroAsset id={value.iconAssetId} alt={name} className="size-14 rounded-lg" frameAspectRatio={1} preview />
            {pencil("images", "absolute -right-1 -bottom-1 rounded-full border bg-background")}
            {editable && (
              <Dialog
                open={section === "images"}
                onOpenChange={(open) => {
                  if (!open && !uploading) setSection(undefined)
                }}
              >
                <DialogContent className="max-h-[85dvh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Ảnh trang bị</DialogTitle>
                    <DialogDescription>{name}</DialogDescription>
                  </DialogHeader>
                  <AssetPicker
                    semanticType="ITEM_ICON"
                    value={value.iconAssetId}
                    onChange={(iconAssetId) => change({ iconAssetId })}
                    onBusyChange={setUploading}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1">
              <SheetTitle className="type-section-title break-words">{name}</SheetTitle>
              {tab !== "translations" && pencil("translations")}
            </div>
            <SheetDescription className="type-meta">
              Bản {entry.revision.revisionNo} · {entry.revision.state === "DRAFT" ? "Bản nháp" : "Đã xuất bản"} ·{" "}
              {entry.code}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {value.categoryCode && (
                <span className="inline-flex items-center gap-1">
                  <ItemCategoryIcon category={category} />
                  {(category && warehouseText(category.translations, locale)?.name) || value.categoryCode}
                </span>
              )}
              {value.tier !== null && <span>Cấp {value.tier}</span>}
              {value.price !== null && (
                <span className="item-price-text inline-flex items-center gap-1">
                  <Coins className="size-3.5 text-amber-600" aria-hidden />
                  {value.price.toLocaleString(locale)} vàng
                </span>
              )}
              {value.price == null && value.tier == null && !value.categoryCode && canEdit && (
                <span className="type-meta">Giá, cấp và nhóm</span>
              )}
              {pencil("details")}
            </div>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-auto space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
          {visibleMissing.length ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <p className="font-medium">Cần hoàn thiện trước khi xuất bản</p>
              <ul className="mt-1 list-disc pl-4">
                {visibleMissing.map((field) => (
                  <li key={field}>{warehouseMissingFieldLabel(field)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!editable && canEdit && (
            <p className="type-meta">
              {onOpenDraft
                ? "Chọn bút để sửa bản nháp đang có."
                : `Chọn bút để tạo nháp từ bản ${entry.revision.revisionNo}.`}
            </p>
          )}
          {translationOnly && <p className="type-meta">Nháp bản dịch cho phép sửa nội dung dịch và ghi chú.</p>}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList aria-label="Trang bị" className="sticky top-0 z-10 grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="gameplay">
                <Settings2 className="size-4" /> Thông tin
              </TabsTrigger>
              <TabsTrigger value="translations">
                <Languages className="size-4" /> Bản dịch · {value.translations.length}
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="size-4" /> Lịch sử
              </TabsTrigger>
            </TabsList>
            <TabsContent value="gameplay" className="space-y-5 pt-3">
              {!focused && (
                <ItemOverview
                  entry={{ ...entry, content: value }}
                  items={items}
                  relatedItems={relatedItems}
                  categories={categories}
                  locale={locale}
                  pencil={canEdit && !translationOnly ? pencil : undefined}
                  onView={(item) => {
                    if (!dirty || window.confirm("Bỏ các chỉnh sửa chưa áp dụng?")) onView(item)
                  }}
                />
              )}
              {focused && (
                <fieldset disabled={busy || uploading} className="min-w-0 space-y-5 disabled:opacity-60">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSection(undefined)}>
                    <ArrowLeft /> Về thông tin trang bị
                  </Button>
                  {section === "details" && (
                    <>
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
                            onChange={(event) =>
                              change({ tier: event.target.value ? Number(event.target.value) : null })
                            }
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
                      <ItemCategorySelect
                        label="Nhóm chính"
                        categories={categories}
                        locale={locale}
                        value={value.categoryCode}
                        allowEmpty
                        onChange={(code) => change({ categoryCode: code || null })}
                      />
                    </>
                  )}
                  {section === "recipe" && (
                    <ItemRecipe itemId={entry.id} content={value} items={items} locale={locale} onChange={change} />
                  )}
                  {section === "positions" && (
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
                          <ItemCategorySelect
                            label={`Nhóm vị trí ${index + 1}`}
                            categories={categories}
                            locale={locale}
                            value={position.categoryCode}
                            onChange={(categoryCode) =>
                              change({
                                shopPositions: value.shopPositions.map((p, i) =>
                                  i === index ? { ...p, categoryCode } : p,
                                ),
                              })
                            }
                          />
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
                  )}
                  {section === "stats" && (
                    <section className="space-y-2">
                      <h3 className="type-section-title">Chỉ số</h3>
                      <WarehouseStatsEditor
                        stats={value.stats}
                        catalog={items}
                        locale={locale}
                        disabled={busy || uploading}
                        onChange={(stats) => change({ stats })}
                      />
                    </section>
                  )}
                </fieldset>
              )}
              <details
                key={section === "context" ? "edit" : "view"}
                open={section === "context" || undefined}
                className="border-t pt-3"
              >
                <summary className="cursor-pointer text-sm font-medium">Mốc patch và ghi chú</summary>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="type-label">Ngữ cảnh dữ liệu</span>
                    {pencil("context")}
                  </div>
                  <WarehousePatchContext
                    compact={section !== "context"}
                    rulesetId={entry.revision.rulesetId}
                    value={patchId}
                    baselineMode={baselineMode}
                    onChange={(id) => {
                      setPatchId(id)
                      setDirty(true)
                    }}
                    disabled={
                      !editable ||
                      section !== "context" ||
                      busy ||
                      entry.revision.cause !== "DATA_BASELINE" ||
                      !!entry.revision.sourceRevisionId
                    }
                  />
                  {(editable || value.notes) && (
                    <WarehouseNotes
                      value={value.notes}
                      onChange={(notes) => change({ notes })}
                      disabled={!editable || section !== "context" || busy}
                    />
                  )}
                </div>
              </details>
            </TabsContent>
            <TabsContent value="translations" className="pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="type-section-title">Nội dung bản dịch</h3>
                {pencil("translations")}
              </div>
              <WarehouseTranslations
                preview={!editable || section !== "translations"}
                value={value.translations}
                onChange={(translations) => change({ translations })}
                locale={initialLanguage ?? locale}
                onLanguageChange={onLanguageChange}
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
        </div>
        {(onPublish || editable) && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-background px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            {onPublish && (
              <Button
                variant="outline"
                disabled={busy || uploading || dirty || visibleMissing.length > 0}
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
        )}
      </SheetContent>
    </Sheet>
  )
}
