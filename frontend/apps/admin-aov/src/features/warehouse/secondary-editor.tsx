import { WarehouseChangeHistory } from "./warehouse-change-history"
import { useEffect, useState, type ReactNode } from "react"
import { Archive, History, Image, Languages, LoaderCircle, Plus, Save, Settings2, Trash2 } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "../publishing/asset-picker"
import { HeroAsset } from "../publishing/hero-content"
import { AdminEntityText } from "../terminology/catalog"
import { Field, control } from "../publishing/fields"
import { WarehouseTranslations } from "./warehouse-translations"
import { WarehousePatchContext } from "./warehouse-patch-context"
import { warehouseMissingFieldLabel } from "./warehouse-labels"
import { WarehouseNotes } from "./warehouse-notes"
import { SpellArtwork } from "./spell-artwork"
import { SpellRemovalHistory } from "./spell-removal-history"
import { enchantmentBranchColor } from "./enchantment-colors"
import { WarehouseOrderPicker } from "./warehouse-order-picker"
import {
  warehouseText,
  type WarehouseContent,
  type WarehouseMetadata,
  type WarehouseStat,
  type SpellContent,
  type EnchantmentContent,
  type WarehouseEntry,
} from "./warehouse-types"

export type SecondaryKind = "arcana" | "spells" | "enchantments"
export interface SecondaryContent extends WarehouseContent {
  color?: "RED" | "PURPLE" | "GREEN"
  tier?: number
  stats?: WarehouseStat[]
  branchCode?: string
  position?: number | null
  cooldownSeconds?: number | null
  unlockType?: "ACCOUNT_CREATION" | "LEVEL" | "UNKNOWN"
  unlockLevel?: number | null
  chargeRechargeSeconds?: number | null
  maxCharges?: number | null
  defaultStateKey?: string | null
  referenceImages?: { assetId: string; notes: string | null }[]
  availability?: "AVAILABLE" | "REMOVED" | "UNKNOWN"
  legacy?: boolean
  displayOrder?: number
  states?: SpellContent["states"]
}
export type SecondaryBranch = WarehouseMetadata

export const secondaryNames: Record<SecondaryKind, string> = {
  arcana: "ngọc",
  spells: "phụ trợ",
  enchantments: "phù hiệu",
}
const semanticTypes: Record<SecondaryKind, string> = {
  arcana: "ARCANA_ICON",
  spells: "SPELL_ICON",
  enchantments: "ENCHANTMENT_ICON",
}

export function newSecondaryContent(kind: SecondaryKind, locale: string, branchCode = ""): SecondaryContent {
  const shared = {
    iconAssetId: null,
    notes: null,
    translations: [{ locale, name: "", summary: null, description: null }],
  }
  if (kind === "arcana") return { ...shared, color: "RED", tier: 3, stats: [] }
  if (kind === "enchantments") return { ...shared, branchCode, tier: 1, position: 0 }
  return {
    ...shared,
    cooldownSeconds: null,
    unlockType: "UNKNOWN",
    unlockLevel: null,
    chargeRechargeSeconds: null,
    maxCharges: null,
    defaultStateKey: null,
    referenceImages: [],
    availability: "UNKNOWN",
    legacy: false,
    displayOrder: 0,
    states: [],
  }
}

export function SecondaryEditor({
  kind,
  entryId,
  revisionId,
  revisionPublished = false,
  code: initialCode = "",
  content: initialContent,
  locale,
  branches,
  isNew,
  readOnly = false,
  canPublish = false,
  revisionLabel,
  rulesetId,
  initialPatchId = null,
  allowPatchChange = false,
  missingFields = [],
  onSave,
  onPublish,
  onCreateDraft,
  onDiscard,
  onClose,
  enchantmentPeers = [],
  onReorderEnchantments,
  onDraft,
}: {
  onDraft?: (entry: WarehouseEntry) => void
  kind: SecondaryKind
  entryId?: string
  revisionId?: string
  revisionPublished?: boolean
  code?: string
  content: SecondaryContent
  locale: string
  branches: SecondaryBranch[]
  isNew: boolean
  readOnly?: boolean
  canPublish?: boolean
  revisionLabel?: string
  rulesetId: string
  initialPatchId?: string | null
  allowPatchChange?: boolean
  missingFields?: string[]
  onSave: (code: string, content: SecondaryContent, patchId: string | null) => Promise<void>
  onPublish?: () => Promise<void>
  onCreateDraft?: () => Promise<void>
  onDiscard?: () => Promise<void>
  onClose: () => void
  enchantmentPeers?: WarehouseEntry<EnchantmentContent>[]
  onReorderEnchantments?: (ids: string[]) => Promise<void>
}) {
  const wide = useIsWide()
  const [code, setCode] = useState(initialCode)
  const [content, setContent] = useState(initialContent)
  const [patchId, setPatchId] = useState(initialPatchId)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const disabled = readOnly || busy || uploading
  const archiveEligible = kind === "spells" && !!content.legacy && content.availability === "REMOVED"
  const archivedWithoutPatch = archiveEligible && !patchId
  const visibleMissing = missingFields.filter(
    (field) => field !== "effectiveFromPatchVariantId" || !archivedWithoutPatch,
  )
  const hasHistory = !!entryId && !!revisionId
  function update(patch: Partial<SecondaryContent>) {
    setContent((current) => ({ ...current, ...patch }))
    setDirty(true)
  }
  function close() {
    if (!busy && !uploading && (!dirty || window.confirm("Có thay đổi chưa lưu. Đóng phần chỉnh sửa?"))) onClose()
  }
  useEffect(() => {
    if (!dirty && !busy && !uploading) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [dirty, busy, uploading])
  async function act(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await action()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  function save() {
    if (!code.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code.trim())) {
      setError("Mã chỉ gồm chữ thường không dấu, số và dấu gạch nối.")
      return
    }
    if (!content.translations.length || content.translations.some((text) => !text.name.trim())) {
      setError("Mỗi bản dịch đã thêm cần có tên hiển thị.")
      return
    }
    if (kind === "enchantments" && !content.branchCode) {
      setError("Chọn hệ phù hiệu trước khi lưu.")
      return
    }
    if (
      kind === "spells" &&
      content.states?.some(
        (state) =>
          !state.key.trim() || !state.translations.length || state.translations.some((text) => !text.name.trim()),
      )
    ) {
      setError("Mỗi trạng thái cần mã và tên của các bản dịch đã thêm.")
      return
    }
    void act(() => onSave(code.trim(), content, patchId))
  }
  const currentText = warehouseText(content.translations, locale)
  const name = currentText?.name || initialCode
  const orderPeers = enchantmentPeers
    .filter((entry) => entry.content.branchCode === content.branchCode && entry.content.tier === content.tier)
    .sort((a, b) => (a.content.position ?? 999) - (b.content.position ?? 999) || a.code.localeCompare(b.code))
  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(640px,94vw)] flex-col gap-0 overflow-hidden sm:max-w-none"
            : "flex h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl"
        }
        onEscapeKeyDown={(event) => (busy || uploading) && event.preventDefault()}
        onPointerDownOutside={(event) => (busy || uploading) && event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b pr-12">
          <SheetTitle>{isNew ? `Tạo ${secondaryNames[kind]}` : name}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {revisionLabel && <Badge variant="outline">{revisionLabel}</Badge>}
            {!isNew && <span className="font-mono text-xs">{initialCode}</span>}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {visibleMissing.length > 0 && (
            <div className="mb-4 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium">Cần bổ sung trước khi xuất bản</p>
              <div className="flex flex-wrap gap-1.5">
                {visibleMissing.map((field) => (
                  <Badge key={field} variant="outline">
                    {warehouseMissingFieldLabel(field)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {readOnly && onCreateDraft && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <p className="flex-1 text-sm">Bản đã xuất bản. Tạo bản nháp để cập nhật.</p>
              <Button size="sm" disabled={busy} onClick={() => void act(onCreateDraft)}>
                <Plus className="size-4" /> Tạo bản nháp
              </Button>
            </div>
          )}
          <Tabs defaultValue="information" className="gap-5">
            <TabsList className={`grid w-full ${hasHistory ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="information" disabled={busy || uploading}>
                <Settings2 className="size-4" /> Thông tin
              </TabsTrigger>
              <TabsTrigger value="translations" disabled={busy || uploading}>
                <Languages className="size-4" /> Bản dịch
              </TabsTrigger>
              <TabsTrigger value="images" disabled={busy || uploading}>
                <Image className="size-4" /> Ảnh
              </TabsTrigger>
              {hasHistory && (
                <TabsTrigger value="history" disabled={busy || uploading}>
                  <History className="size-4" />
                  Lịch sử
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="information" className="space-y-5">
              <WarehousePatchContext
                rulesetId={rulesetId}
                allowUnknownPatch={archiveEligible}
                value={patchId}
                disabled={disabled || !allowPatchChange}
                onChange={(value) => {
                  setPatchId(value)
                  setDirty(true)
                }}
              />
              <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3">
                {kind === "spells" ? (
                  <SpellArtwork
                    iconAssetId={content.iconAssetId}
                    states={content.states}
                    defaultStateKey={content.defaultStateKey}
                    name={name}
                    locale={locale}
                    preview
                  />
                ) : (
                  <HeroAsset
                    id={content.iconAssetId}
                    alt={name}
                    frameAspectRatio={1}
                    preview
                    className="size-16 shrink-0 rounded-full"
                  />
                )}
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{name || `Tạo ${secondaryNames[kind]}`}</p>
                  {currentText?.summary && <p className="text-sm text-muted-foreground">{currentText.summary}</p>}
                  {currentText && currentText.locale !== locale && (
                    <Badge variant="outline">
                      {currentText.locale} · Chưa có {locale}
                    </Badge>
                  )}
                </div>
              </div>
              {isNew && kind === "spells" && !readOnly && (
                <fieldset disabled={busy || uploading} className="space-y-2">
                  <legend className="mb-2 text-sm font-medium">Biểu tượng phụ trợ</legend>
                  <AssetPicker
                    semanticType="SPELL_ICON"
                    value={content.iconAssetId}
                    directUpload
                    onChange={(iconAssetId) => update({ iconAssetId })}
                    onBusyChange={setUploading}
                  />
                  <p className="text-xs text-muted-foreground">PNG, JPEG hoặc WebP · tối đa 25 MB.</p>
                </fieldset>
              )}
              {currentText?.description && (
                <div className="text-sm leading-6">
                  <AdminEntityText text={currentText.description} />
                </div>
              )}
              {isNew && (
                <Field
                  label="Mã định danh"
                  value={code}
                  onChange={(value) => {
                    setCode(value)
                    setDirty(true)
                  }}
                  disabled={disabled}
                  placeholder="vi-du-ma-khong-dau"
                />
              )}
              <SecondaryMechanics
                kind={kind}
                content={content}
                onChange={update}
                branches={branches}
                locale={locale}
                disabled={disabled}
                enchantmentOrderControl={
                  <WarehouseOrderPicker
                    label="Thứ tự trong cấp"
                    contextLabel={`${warehouseText(branches.find((branch) => branch.code === content.branchCode)?.translations ?? [], locale)?.name ?? content.branchCode ?? ""} · Cấp ${["I", "II", "III"][(content.tier ?? 1) - 1]}`}
                    items={orderPeers.map((entry) => ({
                      id: entry.id,
                      name: warehouseText(entry.content.translations, locale)?.name ?? entry.code,
                      iconAssetId: entry.content.iconAssetId,
                      color: enchantmentBranchColor(
                        branches.find((branch) => branch.code === content.branchCode) ?? {
                          code: content.branchCode ?? "",
                          color: null,
                        },
                      ),
                    }))}
                    disabled={disabled || dirty || isNew || !onReorderEnchantments}
                    disabledReason={
                      isNew
                        ? "Lưu phù hiệu trước khi sắp xếp trong cấp."
                        : dirty
                          ? "Lưu thay đổi trước khi sắp xếp."
                          : undefined
                    }
                    blockedReason={
                      orderPeers.some(
                        (entry) => entry.revision.state !== "DRAFT" || entry.revision.cause === "TRANSLATION_UPDATE",
                      )
                        ? "Tạo bản nháp nội dung cho các phù hiệu trong cấp trước khi sắp xếp. Bản đã xuất bản và bản dịch được giữ nguyên."
                        : undefined
                    }
                    onSave={async (ids) => {
                      await onReorderEnchantments?.(ids)
                    }}
                  />
                }
              />
              <WarehouseNotes value={content.notes} onChange={(notes) => update({ notes })} disabled={disabled} />
            </TabsContent>
            <TabsContent value="translations">
              <WarehouseTranslations
                value={content.translations}
                onChange={(translations) => update({ translations })}
                locale={locale}
                disabled={disabled}
                statKeys={(content.stats ?? []).map((stat) => stat.key).filter(Boolean)}
              />
              {kind === "spells" && (content.states?.length ?? 0) > 0 && (
                <div className="mt-6 space-y-5 border-t pt-5">
                  <h3 className="font-medium">Bản dịch trạng thái phụ trợ</h3>
                  {content.states!.map((state, index) => (
                    <details key={index} className="rounded-xl border p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        {warehouseText(state.translations, locale)?.name || state.key || `Trạng thái ${index + 1}`}
                      </summary>
                      <div className="pt-4">
                        <WarehouseTranslations
                          value={state.translations}
                          locale={locale}
                          disabled={disabled}
                          onChange={(translations) =>
                            update({
                              states: content.states!.map((entry, n) =>
                                n === index ? { ...entry, translations } : entry,
                              ),
                            })
                          }
                        />
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="images" className="space-y-5">
              {readOnly ? (
                <div className="space-y-3">
                  <HeroAsset
                    id={content.iconAssetId}
                    alt={name}
                    preview
                    frameAspectRatio={1}
                    className="mx-auto size-48 rounded-full"
                  />
                  <p className="text-sm text-muted-foreground">Tạo bản nháp để chọn hoặc tải ảnh mới.</p>
                  {kind === "spells" && (content.states?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-2 gap-3 border-t pt-4">
                      {content.states!.map((state) => (
                        <div key={state.key} className="space-y-2 rounded-xl border p-3">
                          <HeroAsset
                            id={state.iconAssetId}
                            alt={warehouseText(state.translations, locale)?.name || state.key}
                            preview
                            frameAspectRatio={1}
                            className="mx-auto size-20 rounded-full"
                          />
                          <p className="text-center text-xs">
                            {warehouseText(state.translations, locale)?.name || state.key}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {kind === "spells" && (content.referenceImages?.length ?? 0) > 0 && (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="text-sm font-medium">Ảnh tham khảo</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {content.referenceImages!.map((image) => (
                          <div key={image.assetId} className="space-y-2">
                            <HeroAsset
                              id={image.assetId}
                              alt={image.notes ?? "Ảnh tham khảo"}
                              preview
                              frameAspectRatio={1}
                              className="mx-auto size-24"
                            />
                            {image.notes && <p className="text-center text-xs text-muted-foreground">{image.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <fieldset disabled={busy || uploading} className="space-y-4">
                  <p className="text-sm text-muted-foreground">Biểu tượng dùng chung cho các bản dịch.</p>
                  <AssetPicker
                    semanticType={semanticTypes[kind]}
                    value={content.iconAssetId}
                    onChange={(iconAssetId) => update({ iconAssetId })}
                    onBusyChange={setUploading}
                  />
                  {content.iconAssetId && (
                    <Button variant="ghost" size="sm" disabled={disabled} onClick={() => update({ iconAssetId: null })}>
                      Bỏ biểu tượng
                    </Button>
                  )}
                  {kind === "spells" &&
                    content.states?.map((state, index) => (
                      <div key={index} className="space-y-3 border-t pt-4">
                        <h3 className="text-sm font-medium">
                          {warehouseText(state.translations, locale)?.name || state.key || `Trạng thái ${index + 1}`}
                        </h3>
                        <AssetPicker
                          semanticType="SPELL_ICON"
                          value={state.iconAssetId}
                          onBusyChange={setUploading}
                          onChange={(iconAssetId) =>
                            update({
                              states: content.states!.map((entry, n) =>
                                n === index ? { ...entry, iconAssetId } : entry,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  {kind === "spells" && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium">Ảnh tham khảo</h3>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() =>
                            update({
                              referenceImages: [...(content.referenceImages ?? []), { assetId: "", notes: null }],
                            })
                          }
                        >
                          <Plus className="size-4" /> Thêm ảnh
                        </Button>
                      </div>
                      {content.referenceImages?.map((image, index) => (
                        <div key={index} className="space-y-3 rounded-xl border p-3">
                          <AssetPicker
                            semanticType="SPELL_ICON"
                            value={image.assetId || null}
                            onBusyChange={setUploading}
                            onChange={(assetId) =>
                              update({
                                referenceImages: content.referenceImages!.map((entry, n) =>
                                  n === index ? { ...entry, assetId } : entry,
                                ),
                              })
                            }
                          />
                          <Field
                            label="Ghi chú ảnh"
                            value={image.notes ?? ""}
                            onChange={(notes) =>
                              update({
                                referenceImages: content.referenceImages!.map((entry, n) =>
                                  n === index ? { ...entry, notes: notes || null } : entry,
                                ),
                              })
                            }
                            disabled={disabled}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={disabled}
                            onClick={() =>
                              update({ referenceImages: content.referenceImages!.filter((_, n) => n !== index) })
                            }
                          >
                            <Trash2 className="size-4" /> Bỏ ảnh
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </fieldset>
              )}
            </TabsContent>
            {hasHistory && (
              <TabsContent value="history">
                <WarehouseChangeHistory
                  kind={kind}
                  entryId={entryId!}
                  rulesetId={rulesetId}
                  locale={locale}
                  onDraft={onDraft}
                />
                {archiveEligible && (
                  <SpellRemovalHistory
                    id={entryId!}
                    revisionId={revisionId!}
                    rulesetId={rulesetId}
                    published={revisionPublished}
                    canPublish={canPublish}
                  />
                )}
              </TabsContent>
            )}
          </Tabs>
          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        {!readOnly && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-background p-4">
            {onDiscard && (
              <Button
                variant="ghost"
                className="mr-auto"
                disabled={busy || uploading}
                onClick={() => {
                  if (window.confirm("Bỏ bản nháp này?")) void act(onDiscard)
                }}
              >
                <Archive className="size-4" /> Bỏ nháp
              </Button>
            )}
            <Button disabled={disabled || (!isNew && !dirty)} onClick={save}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              <Save className="size-4" /> Lưu nháp
            </Button>
            {canPublish && onPublish && (
              <Button
                variant="outline"
                disabled={disabled || dirty || (!patchId && !archivedWithoutPatch) || visibleMissing.length > 0}
                onClick={() => void act(onPublish)}
              >
                Xuất bản
              </Button>
            )}
          </footer>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SecondaryMechanics({
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
  enchantmentOrderControl?: ReactNode
}) {
  if (kind === "enchantments")
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span>Hệ phù hiệu</span>
          <select
            className={control}
            value={content.branchCode ?? ""}
            disabled={disabled}
            onChange={(event) => onChange({ branchCode: event.target.value })}
          >
            <option value="">Chọn hệ</option>
            {branches.map((branch) => (
              <option key={branch.code} value={branch.code}>
                {branch.translations.find((text) => text.locale === locale)?.name ??
                  branch.translations[0]?.name ??
                  branch.code}
              </option>
            ))}
          </select>
        </label>
        <TierField value={content.tier ?? 1} disabled={disabled} onChange={(tier) => onChange({ tier })} />
        <div className="self-end">{enchantmentOrderControl}</div>
      </div>
    )
  if (kind === "arcana")
    return (
      <div className="space-y-5">
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
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Chỉ số</h3>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onChange({ stats: [...(content.stats ?? []), { key: "", value: 0, unit: null }] })}
            >
              <Plus className="size-4" /> Thêm chỉ số
            </Button>
          </div>
          {content.stats?.map((stat, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_5rem_4rem_2rem] items-end gap-2 rounded-lg border p-3"
            >
              <Field
                label="Mã chỉ số"
                value={stat.key}
                disabled={disabled}
                onChange={(key) =>
                  onChange({ stats: content.stats!.map((entry, n) => (n === index ? { ...entry, key } : entry)) })
                }
              />
              <Field
                label="Giá trị"
                type="number"
                step="any"
                value={stat.value}
                disabled={disabled}
                onChange={(value) =>
                  onChange({
                    stats: content.stats!.map((entry, n) => (n === index ? { ...entry, value: Number(value) } : entry)),
                  })
                }
              />
              <Field
                label="Đơn vị"
                value={stat.unit ?? ""}
                placeholder="%"
                disabled={disabled}
                onChange={(unit) =>
                  onChange({
                    stats: content.stats!.map((entry, n) => (n === index ? { ...entry, unit: unit || null } : entry)),
                  })
                }
              />
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={disabled}
                aria-label={`Bỏ chỉ số ${index + 1}`}
                onClick={() => onChange({ stats: content.stats!.filter((_, n) => n !== index) })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {!content.stats?.length && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Chưa có chỉ số.</p>
          )}
        </section>
      </div>
    )
  return (
    <div className="space-y-5">
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
          <span>Cách mở khóa</span>
          <select
            className={control}
            value={content.unlockType ?? "UNKNOWN"}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                unlockType: event.target.value as SecondaryContent["unlockType"],
                ...(event.target.value !== "LEVEL" ? { unlockLevel: null } : {}),
              })
            }
          >
            <option value="ACCOUNT_CREATION">Khi tạo tài khoản</option>
            <option value="LEVEL">Theo Lv tài khoản</option>
            <option value="UNKNOWN">Chưa xác định</option>
          </select>
        </label>
        <Field
          label="Lv mở khóa"
          type="number"
          min={1}
          step={1}
          value={content.unlockLevel ?? ""}
          onChange={(value) => onChange({ unlockLevel: value === "" ? null : Number(value) })}
          disabled={disabled || content.unlockType !== "LEVEL"}
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
      <section className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Các trạng thái</h3>
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
    </div>
  )
}

function TierField({
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

export function EnchantmentBranchEditor({
  branch,
  locale,
  kind = "enchantments",
  onSave,
  onClose,
  branches = [],
  onReorderBranches,
}: {
  branch: WarehouseMetadata | null
  locale: string
  kind?: "items" | "enchantments"
  onSave: (value: WarehouseMetadata) => Promise<void>
  onClose: () => void
  branches?: WarehouseMetadata[]
  onReorderBranches?: (ids: string[]) => Promise<void>
}) {
  const wide = useIsWide()
  const entityName = kind === "items" ? "nhóm trang bị" : "hệ phù hiệu"
  const [value, setValue] = useState<WarehouseMetadata>(
    branch ?? {
      code: "",
      version: 0,
      displayOrder: 0,
      iconAssetId: null,
      backgroundAssetId: null,
      color: "#d6ad57",
      translations: [{ locale, name: "", description: null, suitability: null }],
    },
  )
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const displayColor = kind === "enchantments" ? enchantmentBranchColor(value) : (value.color ?? "#d6ad57")
  function update(patch: Partial<WarehouseMetadata>) {
    setValue((current) => ({ ...current, ...patch }))
    setDirty(true)
  }
  function close() {
    if (!busy && !uploading && (!dirty || window.confirm(`Có thay đổi ${entityName} chưa lưu. Đóng phần chỉnh sửa?`)))
      onClose()
  }
  useEffect(() => {
    if (!dirty && !busy && !uploading) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [dirty, busy, uploading])
  async function save() {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.code) ||
      !value.translations.length ||
      value.translations.some((text) => !text.name.trim())
    ) {
      setError("Cần mã không dấu và tên của các bản dịch đã thêm.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await onSave({
        ...value,
        translations: value.translations.map(({ locale, name, description, suitability }) => ({
          locale,
          name,
          description: description || null,
          suitability: suitability || null,
        })),
      })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(600px,94vw)] flex-col overflow-hidden sm:max-w-none"
            : "flex h-[92dvh] flex-col overflow-hidden rounded-t-2xl"
        }
      >
        <SheetHeader className="pr-8">
          <SheetTitle>{branch ? `Chỉnh sửa ${entityName}` : `Tạo ${entityName}`}</SheetTitle>
          <SheetDescription>Thiết lập bố cục và các bản dịch.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <Tabs defaultValue="information" className="gap-5">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="information">
                <Settings2 className="size-4" /> Thông tin
              </TabsTrigger>
              <TabsTrigger value="translations">
                <Languages className="size-4" /> Bản dịch
              </TabsTrigger>
              <TabsTrigger value="images">
                <Image className="size-4" /> Ảnh
              </TabsTrigger>
            </TabsList>
            <TabsContent value="information" className="space-y-4">
              <Field
                label={kind === "items" ? "Mã nhóm" : "Mã hệ"}
                value={value.code}
                onChange={(code) => update({ code })}
                disabled={!!branch || busy}
              />
              {kind === "items" ? (
                <Field
                  label="Thứ tự hiển thị"
                  type="number"
                  min={0}
                  step={1}
                  value={value.displayOrder}
                  onChange={(displayOrder) => update({ displayOrder: Number(displayOrder) })}
                  disabled={busy}
                />
              ) : (
                <WarehouseOrderPicker
                  label="Thứ tự các hệ"
                  items={branches.map((entry) => ({
                    id: entry.code,
                    name: warehouseText(entry.translations, locale)?.name ?? entry.code,
                    iconAssetId: entry.iconAssetId,
                    color: enchantmentBranchColor(entry),
                  }))}
                  disabled={!branch || dirty || busy || uploading || !onReorderBranches}
                  disabledReason={
                    !branch ? "Lưu hệ mới trước khi sắp xếp." : dirty ? "Lưu thay đổi trước khi sắp xếp." : undefined
                  }
                  onSave={async (ids) => {
                    await onReorderBranches?.(ids)
                  }}
                />
              )}
              <label className="grid gap-1.5 text-sm">
                <span>Màu nhận diện</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Màu nhận diện hệ"
                    className="h-10 w-14 cursor-pointer rounded-md border bg-background p-1"
                    value={displayColor}
                    disabled={busy}
                    onChange={(event) => update({ color: event.target.value })}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {value.color?.trim() || `${displayColor} · Mặc định`}
                  </span>
                </div>
              </label>
            </TabsContent>
            <TabsContent value="translations">
              <WarehouseTranslations
                value={value.translations}
                onChange={(translations) => update({ translations })}
                locale={locale}
                disabled={busy}
                showSummary={false}
              />
            </TabsContent>
            <TabsContent value="images" className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Biểu tượng</h3>
                <AssetPicker
                  semanticType={kind === "items" ? "ITEM_ICON" : "ENCHANTMENT_ICON"}
                  value={value.iconAssetId}
                  onChange={(iconAssetId) => update({ iconAssetId })}
                  onBusyChange={setUploading}
                />
              </div>
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Ảnh nền</h3>
                <AssetPicker
                  semanticType="OTHER"
                  value={value.backgroundAssetId}
                  onChange={(backgroundAssetId) => update({ backgroundAssetId })}
                  onBusyChange={setUploading}
                />
              </div>
            </TabsContent>
          </Tabs>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <footer className="flex shrink-0 justify-end border-t p-4">
          <Button disabled={!dirty || busy || uploading} onClick={() => void save()}>
            {(busy || uploading) && <LoaderCircle className="size-4 animate-spin" />} Lưu {entityName}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
