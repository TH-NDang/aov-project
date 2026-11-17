import { ItemCategorySelect } from "./item-category-icon"
import { ItemCategoryIcon } from "@/features/warehouse/components/item-category-view"
import { ItemRecipe } from "./item-recipe"
import { ItemRowPicker } from "./item-row-picker"
import { shopColumns } from "../model/item-shop-position"
import { WarehouseChangeHistory } from "./warehouse-change-history"
import { useState } from "react"
import {
  Clapperboard,
  FileText,
  Hammer,
  History,
  ImagePlus,
  Info,
  LayoutGrid,
  LayoutList,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { ITEM_STATS, itemReaderContent, itemStatsFromDescription } from "@aov/ui/lib/item-description"
import { ItemPrice } from "@aov/ui/components/warehouse/item-price"
import { ItemStatList } from "@aov/ui/components/warehouse/item-facts"
import { ItemRecipeView } from "@aov/ui/components/warehouse/item-recipe"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { ContentsSection, SectionContents, useSectionContents } from "@/components/section-contents"
import { AssetPicker } from "../../publishing/components/assets/asset-picker"
import { Field, control } from "../../publishing/components/fields"
import { HeroAsset } from "@/features/publishing/components/hero-asset"
import { VersionFacts } from "../../publishing/components/setup/version-facts"
import { AdminRichTextPreview } from "../../terminology/rich-text-field"
import { AdminWarehouseView } from "./warehouse-view"
import { WarehouseTranslations } from "./warehouse-translations"
import { WarehousePatchContext } from "./warehouse-patch-context"
import { warehouseMissingFieldLabel } from "../model/warehouse-labels"
import { WarehouseStatsEditor } from "./warehouse-stats-editor"
import { WarehouseNotes } from "./warehouse-notes"
import {
  LanguagePicker,
  ReferenceLanguage,
  baseLanguage,
  languageName,
  pickDisplayLanguage,
  translationProgress,
} from "./warehouse-translation-panel"
import {
  CopyCode,
  SHEET_TAB,
  SHEET_TAB_LIST,
  SheetActions,
  WarehouseDescription,
  focusSheet,
  versionLabel,
  type NewDraft,
} from "./warehouse-sheet"
import type { WarehouseSection } from "./warehouse-edit-section"
import { SubjectVideosPanel } from "../../videos/subject-videos-panel"
import { warehouseBaselineMode, type WarehouseEntry, type WarehouseMetadata } from "../model/warehouse-types"
import { warehouseName, warehouseText, type ItemContent } from "@aov/ui/lib/warehouse-content"
import { confirmDiscard } from "@/components/confirm-dialog"

/** Sections of the item page, in reading order. Viewing and editing share them, so the page never rearranges. */
const ITEM_SECTIONS = {
  overview: "item-section-overview",
  text: "item-section-text",
  recipe: "item-section-recipe",
  positions: "item-section-positions",
  videos: "item-section-videos",
} as const

/** Where a request to edit one part of the item lands on the page; the patch and notes have a tab of their own. */
const SECTION_FOR: Record<WarehouseSection, string> = {
  details: ITEM_SECTIONS.overview,
  stats: ITEM_SECTIONS.overview,
  images: ITEM_SECTIONS.overview,
  mechanics: ITEM_SECTIONS.overview,
  states: ITEM_SECTIONS.overview,
  translations: ITEM_SECTIONS.text,
  recipe: ITEM_SECTIONS.recipe,
  positions: ITEM_SECTIONS.positions,
  context: ITEM_SECTIONS.overview,
}

/**
 * One item read as a page, with a single pencil that turns the whole page into its form. Every section keeps its
 * place while editing, so the editor changes values where the reader saw them.
 */
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
  openDraftNo,
  onPublish,
  onDiscard,
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
  /** Opens the page already editing, scrolled to this part. */
  initialSection?: WarehouseSection
  initialLanguage?: string
  onLanguageChange?: (language: string) => void
  /** Starts a draft of the chosen kind from the version on screen. */
  onFork?: (draft: NewDraft) => void
  onOpenDraft?: (section: WarehouseSection) => void
  /** The number of the draft `onOpenDraft` opens, for the pencil's menu. */
  openDraftNo?: number
  onPublish?: () => void
  /** Throws the draft away; offered only for a draft, after asking. */
  onDiscard?: () => void
  busy: boolean
}) {
  const wide = useIsWide()
  const [value, setValue] = useState(() => structuredClone(entry.content))
  const [patchId, setPatchId] = useState(entry.revision.effectiveFromPatchVariantId)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(editable && !!initialSection)
  const [picking, setPicking] = useState(editable && initialSection === "images")
  const [tab, setTab] = useState(initialSection === "context" ? "history" : "content")
  const [language, setLanguage] = useState(
    () => initialLanguage ?? pickDisplayLanguage(entry.content.translations, locale),
  )
  const [dirty, setDirty] = useState(false)
  const contents = useSectionContents({
    requested: initialSection ? SECTION_FOR[initialSection] : undefined,
    first: ITEM_SECTIONS.overview,
  })
  const canEdit = editable || !!onFork || !!onOpenDraft
  // A translation draft may only change the words and the notes; the rest of the item stays as published.
  const editsContent = editing && !translationOnly
  const name = warehouseName({ ...entry, content: value }, locale)
  const text = warehouseText(value.translations, language) ?? warehouseText(value.translations, locale)
  const reading = itemReaderContent(value, warehouseText(value.translations, locale))
  const describedStats = itemStatsFromDescription(warehouseText(value.translations, locale)?.description)
  const category = categories.find((group) => group.code === value.categoryCode)
  const baselineMode = warehouseBaselineMode(entry.revision, entry.missingFields)
  const visibleMissing = (entry.missingFields ?? []).filter(
    (field) => field !== "effectiveFromPatchVariantId" || !!patchId || !baselineMode,
  )
  const upgrades = relatedItems.filter(
    (item) =>
      item.revision.state === "PUBLISHED" &&
      item.content.recipeStatus === "VERIFIED" &&
      item.content.components.some((part) => part.itemId === entry.id),
  )
  const change = (patch: Partial<ItemContent>) => {
    setValue((old) => ({ ...old, ...patch }))
    setDirty(true)
  }
  const changePosition = (index: number, patch: Partial<ItemContent["shopPositions"][number]>) =>
    change({ shopPositions: value.shopPositions.map((p, i) => (i === index ? { ...p, ...patch } : p)) })
  const editLabel = editing ? "Xem lại trang bị" : "Sửa trang bị"
  function toggleEditing() {
    setEditing(!editing)
  }
  const statKeys = value.stats.map((stat) => stat.key)
  const variantKeys = [
    ...new Set(value.shopPositions.map((position) => position.variant).filter((v): v is string => !!v)),
  ]
  const progress = (target: string) =>
    translationProgress(value.translations, baseLanguage(value.translations), target, {
      summary: true,
      statKeys,
      variantKeys,
    })
  function chooseLanguage(next: string) {
    setLanguage(next)
    onLanguageChange?.(next)
  }
  async function leave(next: () => void, title: string) {
    if (
      !dirty ||
      (await confirmDiscard({
        title,
        description: "Các chỉnh sửa chưa áp dụng sẽ bị bỏ.",
        confirmLabel: "Bỏ chỉnh sửa",
      }))
    )
      next()
  }
  function close() {
    if (busy || uploading) return
    void leave(onClose, "Đóng phần chỉnh sửa?")
  }
  const viewItem = (item: WarehouseEntry<ItemContent>) => void leave(() => onView(item), "Mở trang bị khác?")
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
            ? "flex w-[min(880px,94vw)] flex-col gap-0 overflow-hidden sm:max-w-none"
            : "flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl"
        }
        onEscapeKeyDown={(event) => {
          if (uploading) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (uploading) event.preventDefault()
        }}
        onOpenAutoFocus={focusSheet}
        showCloseButton={false}
      >
        <SheetHeader className="shrink-0 flex-row flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <HeroAsset
            id={value.iconAssetId}
            alt={name}
            className="size-12 shrink-0 rounded-lg"
            frameAspectRatio={1}
            preview
          />
          <div className="min-w-40 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <SheetTitle className="type-section-title break-words">{name}</SheetTitle>
              <CopyCode code={entry.code} />
            </div>
            <div className="type-body flex flex-wrap items-center gap-x-3 gap-y-1">
              {value.categoryCode && (
                <span className="inline-flex items-center gap-1">
                  <ItemCategoryIcon category={category} />
                  {(category && warehouseText(category.translations, locale)?.name) || value.categoryCode}
                </span>
              )}
              {value.tier !== null && <span>Cấp {value.tier}</span>}
              <ItemPrice amount={value.price} locale={locale} />
            </div>
            <SheetDescription className="sr-only">Mã {entry.code}</SheetDescription>
          </div>
          <SheetActions
            version={versionLabel(entry.revision.revisionNo, entry.revision.state, editing)}
            editing={editing}
            disabled={busy || uploading}
            closeDisabled={uploading}
            onClose={close}
            language={
              <LanguagePicker
                translations={value.translations}
                value={language}
                onChange={chooseLanguage}
                progress={progress}
                disabled={busy || uploading}
                onEdit={
                  canEdit
                    ? (next) => {
                        // The language is remembered by the page, so the draft opens writing it.
                        chooseLanguage(next)
                        if (editable) setEditing(true)
                        else if (onOpenDraft) onOpenDraft("translations")
                        else onFork?.({ cause: "TRANSLATION_UPDATE" })
                      }
                    : undefined
                }
              />
            }
            edit={editable ? { label: editLabel, pressed: editing, onClick: toggleEditing } : undefined}
            draft={
              !editable && canEdit
                ? {
                    name: "trang bị",
                    rulesetId: entry.revision.rulesetId,
                    basePatchVariantId: entry.revision.effectiveFromPatchVariantId,
                    openDraft: onOpenDraft
                      ? {
                          revisionNo: openDraftNo,
                          onOpen: () => onOpenDraft(translationOnly ? "translations" : "details"),
                        }
                      : undefined,
                    onCreate: onFork,
                  }
                : undefined
            }
            discard={
              onDiscard
                ? {
                    description: "Nội dung trong bản nháp sẽ bị hủy. Bản đã xuất bản giữ nguyên.",
                    onConfirm: onDiscard,
                  }
                : undefined
            }
            save={
              editable && dirty
                ? {
                    label: "Áp dụng vào bản đang sửa",
                    title: "Đưa chỉnh sửa vào bản đang sửa; bấm Lưu thay đổi trên trang để ghi lại.",
                    onClick: () => {
                      onApply(value, patchId)
                      setDirty(false)
                    },
                  }
                : undefined
            }
            publish={
              onPublish
                ? {
                    disabled: dirty || visibleMissing.length > 0,
                    quiet: dirty,
                    title: dirty
                      ? "Áp dụng chỉnh sửa trước khi xuất bản"
                      : visibleMissing.length
                        ? "Cần hoàn thiện trước khi xuất bản"
                        : undefined,
                    onClick: onPublish,
                  }
                : undefined
            }
          />
        </SheetHeader>
        {/* The tab row sits right under the header and stays put; only the tab's content scrolls. */}
        <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-auto gap-0">
          <TabsList aria-label="Trang bị" variant="line" className={SHEET_TAB_LIST}>
            <TabsTrigger value="content" className={SHEET_TAB}>
              <LayoutList /> Nội dung
            </TabsTrigger>
            <TabsTrigger value="history" className={SHEET_TAB}>
              <History /> Lịch sử
            </TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-auto space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
            {visibleMissing.length ? (
              <div className="type-body rounded-lg border border-(--aov-warning)/30 bg-(--aov-warning-soft) p-3">
                <p className="type-label">Cần hoàn thiện trước khi xuất bản</p>
                <ul className="mt-1 list-disc pl-4">
                  {visibleMissing.map((field) => (
                    <li key={field}>{warehouseMissingFieldLabel(field)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {translationOnly && editing && (
              <p className="type-meta">
                Nháp bản dịch chỉ sửa tên, mô tả và ghi chú; phần còn lại giữ như bản đã xuất bản.
              </p>
            )}
            <TabsContent value="content">
              <AdminWarehouseView>
                <SectionContents
                  contents={contents}
                  layout="panel"
                  entries={[
                    { id: ITEM_SECTIONS.overview, label: "Tổng quan", icon: Info },
                    { id: ITEM_SECTIONS.text, label: "Mô tả", icon: FileText },
                    { id: ITEM_SECTIONS.recipe, label: "Công thức", icon: Hammer },
                    { id: ITEM_SECTIONS.positions, label: "Vị trí trong cửa hàng", icon: LayoutGrid },
                    { id: ITEM_SECTIONS.videos, label: "Video", icon: Clapperboard },
                  ]}
                >
                  <ContentsSection id={ITEM_SECTIONS.overview} title="Tổng quan" icon={Info}>
                    {editsContent ? (
                      <fieldset disabled={busy || uploading} className="min-w-0 space-y-5 disabled:opacity-60">
                        <div className="flex items-center gap-3">
                          <HeroAsset
                            id={value.iconAssetId}
                            alt={name}
                            className="size-12 shrink-0 rounded-lg"
                            frameAspectRatio={1}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="type-label">Biểu tượng</p>
                            <p className="type-meta">Ảnh vuông dùng trong cửa hàng và trên Wiki.</p>
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>
                            <ImagePlus /> {value.iconAssetId ? "Đổi ảnh" : "Chọn ảnh"}
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
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
                          <ItemCategorySelect
                            label="Nhóm chính"
                            categories={categories}
                            locale={locale}
                            value={value.categoryCode}
                            allowEmpty
                            onChange={(code) => change({ categoryCode: code || null })}
                          />
                        </div>
                        <section className="space-y-2" aria-label="Chỉ số">
                          <h3 className="type-label">Chỉ số</h3>
                          {!value.stats.length && describedStats.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => change({ stats: describedStats })}
                            >
                              <Sparkles />
                              Điền {describedStats.length} chỉ số từ mô tả
                            </Button>
                          )}
                          <WarehouseStatsEditor
                            stats={value.stats}
                            catalog={items}
                            locale={locale}
                            disabled={busy || uploading}
                            onChange={(stats) => change({ stats })}
                            knownStats={ITEM_STATS.map((stat) => ({ key: stat.key, label: stat.vi }))}
                          />
                        </section>
                      </fieldset>
                    ) : (
                      <div className="space-y-4">
                        {text?.summary && (
                          <div className="type-body text-muted-foreground">
                            <AdminRichTextPreview text={text.summary} locale={text.locale} />
                          </div>
                        )}
                        <section className="space-y-2" aria-label="Chỉ số">
                          <h3 className="type-label">Chỉ số</h3>
                          {reading.stats.length ? (
                            <ItemStatList stats={reading.stats} locale={locale} />
                          ) : (
                            <p className="type-meta">Chưa có chỉ số.</p>
                          )}
                          {!value.stats.length && reading.stats.length > 0 && (
                            <p className="type-meta">Đang đọc từ mô tả, chưa lưu thành chỉ số có cấu trúc.</p>
                          )}
                        </section>
                      </div>
                    )}
                  </ContentsSection>
                  <ContentsSection
                    id={ITEM_SECTIONS.text}
                    title={editing ? `Tên và mô tả · ${languageName(language)}` : "Mô tả"}
                    icon={FileText}
                  >
                    {editing ? (
                      // The language chosen at the top is written here; a field opens a reference in another one.
                      <ReferenceLanguage translations={value.translations} editing={language}>
                        <WarehouseTranslations
                          value={value.translations}
                          onChange={(translations) => change({ translations })}
                          locale={language}
                          fixedLanguage
                          disabled={busy}
                          showSummary
                          showEffects
                          statKeys={statKeys}
                          variantKeys={variantKeys}
                        />
                      </ReferenceLanguage>
                    ) : value.translations.some((entry) => entry.locale === language) ? (
                      <WarehouseDescription text={warehouseText(value.translations, language)} />
                    ) : (
                      <p className="type-meta">Chưa có bản dịch {languageName(language)}. Bấm bút để dịch.</p>
                    )}
                  </ContentsSection>
                  {/* The recipe brings its own headings: what the item is built from and what it builds into. */}
                  <ContentsSection id={ITEM_SECTIONS.recipe} label="Công thức">
                    <div className="space-y-5">
                      {editsContent ? (
                        <fieldset disabled={busy || uploading} className="min-w-0 disabled:opacity-60">
                          <ItemRecipe
                            itemId={entry.id}
                            content={value}
                            items={items}
                            locale={locale}
                            onChange={change}
                          />
                        </fieldset>
                      ) : (
                        <ItemRecipeView
                          content={value}
                          items={items}
                          upgrades={upgrades}
                          locale={locale}
                          onView={viewItem}
                          showStatus
                        />
                      )}
                    </div>
                  </ContentsSection>
                  <ContentsSection id={ITEM_SECTIONS.positions} title="Vị trí trong cửa hàng" icon={LayoutGrid}>
                    {editsContent ? (
                      <fieldset disabled={busy || uploading} className="min-w-0 space-y-2 disabled:opacity-60">
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
                              onChange={(categoryCode) => changePosition(index, { categoryCode })}
                            />
                            <label className="type-label grid gap-1">
                              Cột
                              <select
                                className={control}
                                aria-label={`Cột vị trí ${index + 1}`}
                                value={position.column ?? ""}
                                onChange={(event) =>
                                  changePosition(index, {
                                    column: event.target.value === "" ? null : Number(event.target.value),
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
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Xóa vị trí ${index + 1}`}
                              onClick={() =>
                                change({ shopPositions: value.shopPositions.filter((_, i) => i !== index) })
                              }
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
                              disabled={busy || uploading}
                              onChange={(row) => changePosition(index, { row })}
                            />
                            <div className="col-span-full">
                              <Field
                                label="Nhánh (nếu có)"
                                value={position.variant ?? ""}
                                onChange={(variant) => changePosition(index, { variant: variant || null })}
                              />
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
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
                      </fieldset>
                    ) : (
                      <ShopPositions content={value} categories={categories} language={text?.locale ?? locale} />
                    )}
                  </ContentsSection>
                  {/* The video panel brings its own heading and add button. */}
                  <ContentsSection id={ITEM_SECTIONS.videos} label="Video" lazy placeholderHeight={200}>
                    <SubjectVideosPanel kind="ITEM" id={entry.id} name={warehouseName(entry, locale)} />
                  </ContentsSection>
                </SectionContents>
              </AdminWarehouseView>
            </TabsContent>
            <TabsContent value="history" className="space-y-5">
              <section className="space-y-4 rounded-xl border bg-muted/20 p-4" aria-label="Phiên bản đang mở">
                <h2 className="type-section-title">Phiên bản đang mở</h2>
                <VersionFacts
                  version={versionLabel(entry.revision.revisionNo, entry.revision.state, false)}
                  cause={entry.revision.cause}
                  patch={
                    <WarehousePatchContext
                      compact={!editing}
                      inline
                      rulesetId={entry.revision.rulesetId}
                      value={patchId}
                      baselineMode={baselineMode}
                      onChange={(id) => {
                        setPatchId(id)
                        setDirty(true)
                      }}
                      disabled={
                        !editing ||
                        busy ||
                        entry.revision.cause !== "DATA_BASELINE" ||
                        !!entry.revision.sourceRevisionId
                      }
                    />
                  }
                />
                {editing || value.notes ? (
                  <WarehouseNotes
                    value={value.notes}
                    onChange={(notes) => change({ notes })}
                    disabled={!editing || busy}
                  />
                ) : (
                  <p className="type-meta">Chưa có ghi chú.</p>
                )}
              </section>
              <WarehouseChangeHistory
                kind="items"
                entryId={entry.id}
                rulesetId={entry.revision.rulesetId}
                locale={locale}
                currentRevisionId={entry.revision.id}
              />
            </TabsContent>
          </div>
        </Tabs>
        {editable && (
          <Dialog
            open={picking}
            onOpenChange={(open) => {
              if (!open && !uploading) setPicking(false)
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
      </SheetContent>
    </Sheet>
  )
}

function ShopPositions({
  content,
  categories,
  language,
}: {
  content: ItemContent
  categories: WarehouseMetadata[]
  language: string
}) {
  const text = warehouseText(content.translations, language)
  if (!content.shopPositions.length) return <p className="type-meta">Chưa xếp vị trí.</p>
  return (
    <ul className="flex flex-wrap gap-2">
      {content.shopPositions.map((position, i) => {
        const category = categories.find((group) => group.code === position.categoryCode)
        const groupName = category && warehouseText(category.translations, language)?.name
        return (
          <li key={i} className="type-body flex flex-wrap items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
            <ItemCategoryIcon category={category} />
            <span>{groupName || position.categoryCode || "Chưa xếp nhóm"}</span>
            <span className="text-muted-foreground">
              {[
                position.column === null ? "Chưa xếp cột" : `Cột ${position.column + 1}`,
                position.row === null ? "Chưa xếp hàng" : `Hàng ${position.row + 1}`,
                position.variant && (text?.variantLabels?.[position.variant] || position.variant),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
