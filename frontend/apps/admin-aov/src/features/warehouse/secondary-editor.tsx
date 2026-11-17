import { WarehouseChangeHistory } from "./warehouse-change-history"
import { useEffect, useState, type ReactNode } from "react"
import {
  ChartNoAxesCombined,
  History,
  Image,
  Languages,
  Layers,
  LayoutList,
  LoaderCircle,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Clapperboard,
  FileText,
} from "lucide-react"
import { SubjectVideosPanel } from "../videos/subject-videos-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { Button } from "@aov/ui/components/button"
import type { WarehouseSection } from "./warehouse-edit-section"
import { SecondaryAttributes } from "./secondary-attributes"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { ContentsSection, SectionContents, useSectionContents, type ContentsEntry } from "@/components/section-contents"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "../publishing/asset-picker"
import { HeroAsset } from "@/features/publishing/hero-asset"
import { VersionFacts } from "../publishing/version-facts"
import { Field, control } from "../publishing/fields"
import { WarehouseTranslations } from "./warehouse-translations"
import { WarehousePatchContext } from "./warehouse-patch-context"
import { warehouseMissingFieldLabel } from "./warehouse-labels"
import { WarehouseStatsEditor } from "./warehouse-stats-editor"
import { WarehouseNotes } from "./warehouse-notes"
import { SpellArtwork } from "./spell-artwork"
import { SpellRemovalHistory } from "./spell-removal-history"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import { WarehouseOrderPicker } from "./warehouse-order-picker"
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
import {
  warehouseBaselineMode,
  type WarehouseMetadata,
  type WarehouseEntry,
  type WarehouseRevision,
} from "./warehouse-types"
import {
  warehouseText,
  type WarehouseContent,
  type WarehouseStat,
  type SpellContent,
  type EnchantmentContent,
} from "@aov/ui/lib/warehouse-content"
import { confirmDiscard } from "@/components/confirm-dialog"

export type SecondaryKind = "arcana" | "spells" | "enchantments"

/** Sections of an arcana, spell or enchantment content page, in reading order; patch and notes have a tab. */
const SECONDARY_SECTIONS = {
  overview: "secondary-section-overview",
  mechanics: "secondary-section-mechanics",
  stats: "secondary-section-stats",
  states: "secondary-section-states",
  images: "secondary-section-images",
  videos: "secondary-section-videos",
} as const
type SecondarySectionKey = keyof typeof SECONDARY_SECTIONS
const partIcons = { mechanics: SlidersHorizontal, stats: ChartNoAxesCombined, states: Layers }
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

/**
 * An arcana, spell or enchantment read as a page, laid out like the item sheet: a compact header holding the version
 * and every action, one pencil that turns the whole page into its form, and underlined tabs right under the header.
 * A new entry opens straight into its form.
 */
export function SecondaryEditor({
  kind,
  entryId,
  revisionId,
  revisionNo,
  revisionState,
  revisionPublished = false,
  revisionCause = "DATA_BASELINE",
  sourceRevisionId = null,
  code: initialCode = "",
  content: initialContent,
  locale,
  branches,
  isNew,
  readOnly = false,
  initialSection,
  initialLanguage,
  onLanguageChange,
  canPublish = false,
  translationOnly = false,
  rulesetId,
  initialPatchId = null,
  allowPatchChange = false,
  missingFields = [],
  onSave,
  onPublish,
  onCreateDraft,
  onOpenDraft,
  onDiscard,
  onClose,
  statCatalog = [],
  enchantmentPeers = [],
  onReorderEnchantments,
  openDraftNo,
}: {
  kind: SecondaryKind
  entryId?: string
  revisionId?: string
  revisionNo?: number
  revisionState?: WarehouseRevision["state"]
  revisionPublished?: boolean
  revisionCause?: WarehouseRevision["cause"]
  sourceRevisionId?: string | null
  code?: string
  content: SecondaryContent
  locale: string
  branches: SecondaryBranch[]
  isNew: boolean
  readOnly?: boolean
  canPublish?: boolean
  translationOnly?: boolean
  rulesetId: string
  initialPatchId?: string | null
  allowPatchChange?: boolean
  missingFields?: string[]
  onSave: (code: string, content: SecondaryContent, patchId: string | null) => Promise<void>
  onPublish?: () => Promise<void>
  /** Opens the page already editing, at this part. */
  initialSection?: WarehouseSection
  initialLanguage?: string
  onLanguageChange?: (language: string) => void
  /** Starts a draft of the chosen kind from the version on screen. */
  onCreateDraft?: (draft: NewDraft) => Promise<void>
  onOpenDraft?: (section: WarehouseSection) => void
  /** The number of the draft `onOpenDraft` opens, for the pencil's menu. */
  openDraftNo?: number
  onDiscard?: () => Promise<void>
  onClose: () => void
  statCatalog?: WarehouseEntry<SecondaryContent>[]
  enchantmentPeers?: WarehouseEntry<EnchantmentContent>[]
  onReorderEnchantments?: (ids: string[]) => Promise<void>
}) {
  const wide = useIsWide()
  const [pageEditing, setPageEditing] = useState(!readOnly && !!initialSection)
  const [tab, setTab] = useState<string>(initialSection === "context" ? "history" : "content")
  const [language, setLanguage] = useState(
    () => initialLanguage ?? (isNew ? locale : pickDisplayLanguage(initialContent.translations, locale)),
  )
  const [code, setCode] = useState(initialCode)
  const [content, setContent] = useState(initialContent)
  const [patchId, setPatchId] = useState(initialPatchId)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const disabled = readOnly || busy || uploading
  const editingPage = !readOnly && (isNew || pageEditing)
  const archiveEligible =
    kind === "spells" && revisionCause !== "GAME_PATCH" && !!content.legacy && content.availability === "REMOVED"
  const archivedWithoutPatch = archiveEligible && !patchId
  const baselineMode =
    kind === "spells"
      ? warehouseBaselineMode(
          { cause: revisionCause, effectiveFromPatchVariantId: initialPatchId, sourceRevisionId },
          missingFields,
        )
      : undefined
  const baselineWithoutPatch = !!baselineMode && !patchId
  const visibleMissing = missingFields.filter(
    (field) => field !== "effectiveFromPatchVariantId" || (!archivedWithoutPatch && !baselineWithoutPatch),
  )
  const hasHistory = !!entryId && !!revisionId
  function update(patch: Partial<SecondaryContent>) {
    setContent((current) => ({ ...current, ...patch }))
    setDirty(true)
  }
  async function close() {
    if (busy || uploading) return
    if (!dirty || (await confirmDiscard({ title: "Đóng phần chỉnh sửa?", description: "Có thay đổi chưa lưu." })))
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
  /** A translation draft may change only the words and the notes; the rest stays as published. */
  function editing(target: WarehouseSection) {
    return editingPage && (!translationOnly || target === "translations" || target === "context")
  }
  const kindName = secondaryNames[kind]
  const canEdit = !isNew && (!readOnly || !!onOpenDraft || !!onCreateDraft)
  const editLabel = editingPage ? `Xem lại ${kindName}` : `Sửa ${kindName}`
  function toggleEditing() {
    setPageEditing(!pageEditing)
  }
  const statKeys = (content.stats ?? []).map((stat) => stat.key).filter(Boolean)
  const progress = (target: string) =>
    translationProgress(content.translations, baseLanguage(content.translations), target, { summary: true, statKeys })
  function chooseLanguage(next: string) {
    setLanguage(next)
    onLanguageChange?.(next)
  }
  const stateName = (state: NonNullable<SecondaryContent["states"]>[number], index: number) =>
    warehouseText(state.translations, locale)?.name || state.key || `Trạng thái ${index + 1}`
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
  const mechanicsTitle = kind === "enchantments" ? "Hệ và vị trí" : kind === "arcana" ? "Phân loại ngọc" : "Thuộc tính"
  const parts: ("mechanics" | "stats" | "states")[] = ["mechanics"]
  if (kind === "arcana") parts.push("stats")
  if (kind === "spells") parts.push("states")
  const sectionKeys: SecondarySectionKey[] = [
    "overview",
    ...parts,
    "images",
    ...(hasHistory ? (["videos"] as const) : []),
  ]
  const partTitle = (part: (typeof parts)[number]) =>
    part === "stats" ? "Chỉ số" : part === "states" ? "Trạng thái phụ trợ" : mechanicsTitle
  const overviewTitle = editing("translations") ? `Tên và mô tả · ${languageName(language)}` : "Mô tả"
  const sectionLabels: Record<SecondarySectionKey, string> = {
    overview: overviewTitle,
    mechanics: mechanicsTitle,
    stats: "Chỉ số",
    states: "Trạng thái phụ trợ",
    images: "Ảnh",
    videos: "Video",
  }
  const sectionIcons = { overview: FileText, ...partIcons, images: Image, videos: Clapperboard }
  const entries: ContentsEntry[] = sectionKeys.map((key) => ({
    id: SECONDARY_SECTIONS[key],
    label: sectionLabels[key],
    icon: sectionIcons[key],
  }))
  const requestedKey: SecondarySectionKey | undefined =
    initialSection === "translations"
      ? "overview"
      : initialSection && initialSection in SECONDARY_SECTIONS
        ? (initialSection as SecondarySectionKey)
        : undefined
  const contents = useSectionContents({
    requested: requestedKey && SECONDARY_SECTIONS[requestedKey],
    first: SECONDARY_SECTIONS.overview,
  })
  const branch = branches.find((entry) => entry.code === content.branchCode)
  const facts =
    kind === "spells"
      ? [
          content.cooldownSeconds != null ? `Hồi chiêu ${content.cooldownSeconds} giây` : null,
          content.availability === "REMOVED" ? "Đã gỡ" : null,
        ]
      : kind === "arcana"
        ? [
            content.color ? `Ngọc ${{ RED: "đỏ", PURPLE: "tím", GREEN: "xanh" }[content.color]}` : null,
            content.tier != null ? `Cấp ${content.tier}` : null,
          ]
        : [
            branch ? (warehouseText(branch.translations, locale)?.name ?? branch.code) : null,
            content.tier != null ? `Cấp ${["I", "II", "III"][content.tier - 1] ?? content.tier}` : null,
          ]
  const orderPeers = enchantmentPeers
    .filter((entry) => entry.content.branchCode === content.branchCode && entry.content.tier === content.tier)
    .sort((a, b) => (a.content.position ?? 999) - (b.content.position ?? 999) || a.code.localeCompare(b.code))
  return (
    <Sheet open onOpenChange={(open) => !open && void close()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(880px,94vw)] flex-col gap-0 overflow-hidden sm:max-w-none"
            : "flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl"
        }
        onEscapeKeyDown={(event) => (busy || uploading) && event.preventDefault()}
        onPointerDownOutside={(event) => (busy || uploading) && event.preventDefault()}
        onOpenAutoFocus={focusSheet}
        showCloseButton={false}
      >
        <SheetHeader className="shrink-0 flex-row flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          {!isNew &&
            (kind === "spells" ? (
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
                className="size-12 shrink-0 rounded-full"
              />
            ))}
          <div className="min-w-40 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <SheetTitle className="type-section-title break-words">{isNew ? `Tạo ${kindName}` : name}</SheetTitle>
              {!isNew && <CopyCode code={initialCode} />}
            </div>
            {facts.some(Boolean) && (
              <p className="type-body flex flex-wrap items-center gap-x-3 gap-y-1">
                {facts.filter(Boolean).map((fact) => (
                  <span key={fact}>{fact}</span>
                ))}
              </p>
            )}
            <SheetDescription className="sr-only">
              {isNew ? `Điền thông tin ${kindName} rồi lưu nháp.` : `Mã ${initialCode}`}
            </SheetDescription>
          </div>
          <SheetActions
            version={isNew ? "Mới" : versionLabel(revisionNo, revisionState, editingPage)}
            editing={editingPage}
            disabled={busy || uploading}
            closeDisabled={busy || uploading}
            onClose={() => void close()}
            language={
              isNew ? undefined : (
                <LanguagePicker
                  translations={content.translations}
                  value={language}
                  onChange={chooseLanguage}
                  progress={progress}
                  disabled={busy || uploading}
                  onEdit={
                    canEdit
                      ? (next) => {
                          // The language is remembered by the page, so the draft opens writing it.
                          chooseLanguage(next)
                          if (!readOnly) setPageEditing(true)
                          else if (onOpenDraft) onOpenDraft("translations")
                          else if (onCreateDraft) void act(() => onCreateDraft({ cause: "TRANSLATION_UPDATE" }))
                        }
                      : undefined
                  }
                />
              )
            }
            edit={canEdit && !readOnly ? { label: editLabel, pressed: pageEditing, onClick: toggleEditing } : undefined}
            draft={
              canEdit && readOnly
                ? {
                    name: kindName,
                    rulesetId,
                    basePatchVariantId: initialPatchId,
                    openDraft: onOpenDraft
                      ? {
                          revisionNo: openDraftNo,
                          onOpen: () => onOpenDraft(translationOnly ? "translations" : "mechanics"),
                        }
                      : undefined,
                    onCreate: onCreateDraft ? (request) => void act(() => onCreateDraft(request)) : undefined,
                  }
                : undefined
            }
            discard={
              !readOnly && onDiscard
                ? { description: "Nội dung trong bản nháp sẽ bị hủy.", onConfirm: () => void act(onDiscard) }
                : undefined
            }
            save={!readOnly && (isNew || dirty) ? { label: "Lưu nháp", busy, onClick: save } : undefined}
            publish={
              !readOnly && canPublish && onPublish
                ? {
                    disabled:
                      dirty ||
                      (!patchId && !archivedWithoutPatch && !baselineWithoutPatch) ||
                      visibleMissing.length > 0,
                    quiet: dirty,
                    title: dirty
                      ? "Lưu nháp trước khi xuất bản"
                      : visibleMissing.length
                        ? "Cần hoàn thiện trước khi xuất bản"
                        : undefined,
                    onClick: () => void act(onPublish),
                  }
                : undefined
            }
          />
        </SheetHeader>
        {/* The tab row sits right under the header and stays put; only the tab's content scrolls. */}
        <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-auto gap-0">
          <TabsList aria-label={kindName} variant="line" className={SHEET_TAB_LIST}>
            <TabsTrigger value="content" className={SHEET_TAB} disabled={busy || uploading}>
              <LayoutList /> Nội dung
            </TabsTrigger>
            <TabsTrigger value="history" className={SHEET_TAB} disabled={busy || uploading}>
              <History /> Lịch sử
            </TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-auto space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
            {visibleMissing.length > 0 && (
              <div className="type-body rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="type-label">Cần hoàn thiện trước khi xuất bản</p>
                <ul className="mt-1 list-disc pl-4">
                  {visibleMissing.map((field) => (
                    <li key={field}>{warehouseMissingFieldLabel(field)}</li>
                  ))}
                </ul>
              </div>
            )}
            {translationOnly && editingPage && (
              <p className="type-meta">
                Nháp bản dịch chỉ sửa tên, mô tả và ghi chú; phần còn lại giữ như bản đã xuất bản.
              </p>
            )}
            {error && (
              <p role="alert" className="type-body rounded-lg border border-destructive/30 p-3 text-destructive">
                {error}
              </p>
            )}
            <TabsContent value="content">
              <SectionContents contents={contents} entries={entries} layout="panel">
                <ContentsSection id={SECONDARY_SECTIONS.overview} title={overviewTitle} icon={FileText}>
                  {editing("translations") ? (
                    <div className="space-y-5">
                      {isNew && kind === "spells" && (
                        <fieldset disabled={busy || uploading} className="space-y-2">
                          <legend className="type-label mb-2">Biểu tượng phụ trợ</legend>
                          <AssetPicker
                            semanticType="SPELL_ICON"
                            value={content.iconAssetId}
                            directUpload
                            onChange={(iconAssetId) => update({ iconAssetId })}
                            onBusyChange={setUploading}
                          />
                          <p className="type-meta">PNG, JPEG hoặc WebP · tối đa 25 MB.</p>
                        </fieldset>
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
                      {/* The language chosen at the top is written here; a field opens a reference in another one. */}
                      <ReferenceLanguage translations={content.translations} editing={language}>
                        <WarehouseTranslations
                          value={content.translations}
                          onChange={(translations) => update({ translations })}
                          locale={language}
                          fixedLanguage
                          disabled={disabled}
                          statKeys={statKeys}
                        />
                      </ReferenceLanguage>
                      {kind === "spells" && (content.states?.length ?? 0) > 0 && (
                        <div className="space-y-3 border-t pt-4">
                          <h3 className="type-label">Tên và mô tả trạng thái phụ trợ</h3>
                          {content.states!.map((state, index) => (
                            <details key={index} className="rounded-xl border p-3">
                              <summary className="type-body cursor-pointer">{stateName(state, index)}</summary>
                              <div className="pt-4">
                                <ReferenceLanguage translations={state.translations} editing={language}>
                                  <WarehouseTranslations
                                    value={state.translations}
                                    locale={language}
                                    fixedLanguage
                                    disabled={disabled}
                                    onChange={(translations) =>
                                      update({
                                        states: content.states!.map((entry, n) =>
                                          n === index ? { ...entry, translations } : entry,
                                        ),
                                      })
                                    }
                                  />
                                </ReferenceLanguage>
                              </div>
                            </details>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : content.translations.some((entry) => entry.locale === language) ? (
                    <WarehouseDescription text={warehouseText(content.translations, language)} showSummary />
                  ) : (
                    <p className="type-meta">Chưa có bản dịch {languageName(language)}. Bấm bút để dịch.</p>
                  )}
                </ContentsSection>
                {parts.map((part) => (
                  <ContentsSection
                    key={part}
                    id={SECONDARY_SECTIONS[part]}
                    title={partTitle(part)}
                    icon={partIcons[part]}
                  >
                    {editing(part) && part === "stats" ? (
                      <WarehouseStatsEditor
                        stats={content.stats ?? []}
                        catalog={statCatalog}
                        locale={locale}
                        disabled={disabled}
                        onChange={(stats) => update({ stats })}
                      />
                    ) : editing(part) ? (
                      <SecondaryMechanics
                        part={part}
                        kind={kind}
                        content={content}
                        onChange={update}
                        branches={branches}
                        locale={locale}
                        disabled={disabled}
                        enchantmentOrderControl={
                          <WarehouseOrderPicker
                            label="Thứ tự trong cấp"
                            contextLabel={`${warehouseText(branch?.translations ?? [], locale)?.name ?? content.branchCode ?? ""} · Cấp ${["I", "II", "III"][(content.tier ?? 1) - 1]}`}
                            items={orderPeers.map((entry) => ({
                              id: entry.id,
                              name: warehouseText(entry.content.translations, locale)?.name ?? entry.code,
                              iconAssetId: entry.content.iconAssetId,
                              color: enchantmentBranchColor(branch ?? { code: content.branchCode ?? "", color: null }),
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
                                (entry) =>
                                  entry.revision.state !== "DRAFT" || entry.revision.cause === "TRANSLATION_UPDATE",
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
                    ) : (
                      <SecondaryAttributes
                        part={part}
                        kind={kind}
                        content={content}
                        branches={branches}
                        locale={locale}
                      />
                    )}
                  </ContentsSection>
                ))}
                <ContentsSection id={SECONDARY_SECTIONS.images} title="Ảnh" icon={Image} lazy placeholderHeight={160}>
                  {!editing("images") ? (
                    <div className="space-y-3">
                      <HeroAsset
                        id={content.iconAssetId}
                        alt={name}
                        preview
                        frameAspectRatio={1}
                        className="size-20 rounded-full"
                      />
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
                              <p className="type-meta text-center">
                                {warehouseText(state.translations, locale)?.name || state.key}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      {kind === "spells" && (content.referenceImages?.length ?? 0) > 0 && (
                        <div className="space-y-3 border-t pt-4">
                          <h3 className="type-label">Ảnh tham khảo</h3>
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
                                {image.notes && <p className="type-meta text-center">{image.notes}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <fieldset disabled={busy || uploading} className="space-y-4">
                      {/* A new spell picks its icon with its name and description above, on the same page. */}
                      {!(isNew && kind === "spells") && (
                        <>
                          <p className="type-meta">Biểu tượng dùng chung cho các bản dịch.</p>
                          <AssetPicker
                            semanticType={semanticTypes[kind]}
                            value={content.iconAssetId}
                            onChange={(iconAssetId) => update({ iconAssetId })}
                            onBusyChange={setUploading}
                          />
                        </>
                      )}
                      {content.iconAssetId && !(isNew && kind === "spells") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => update({ iconAssetId: null })}
                        >
                          Bỏ biểu tượng
                        </Button>
                      )}
                      {kind === "spells" &&
                        content.states?.map((state, index) => (
                          <div key={index} className="space-y-3 border-t pt-4">
                            <h3 className="type-label">
                              {warehouseText(state.translations, locale)?.name ||
                                state.key ||
                                `Trạng thái ${index + 1}`}
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
                            <h3 className="type-label">Ảnh tham khảo</h3>
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
                </ContentsSection>
                {hasHistory && (
                  // The video panel brings its own heading and add button.
                  <ContentsSection id={SECONDARY_SECTIONS.videos} label="Video" lazy placeholderHeight={200}>
                    <SubjectVideosPanel
                      kind={kind === "enchantments" ? "ENCHANTMENT" : kind === "arcana" ? "ARCANA" : "SPELL"}
                      id={entryId!}
                      name={name}
                    />
                  </ContentsSection>
                )}
              </SectionContents>
            </TabsContent>
            <TabsContent value="history" className="space-y-5">
              <section className="space-y-4 rounded-xl border bg-muted/20 p-4" aria-label="Phiên bản đang mở">
                <h2 className="type-section-title">Phiên bản đang mở</h2>
                <VersionFacts
                  version={isNew ? `${kindName} mới` : versionLabel(revisionNo, revisionState, false)}
                  cause={revisionCause}
                  patch={
                    <WarehousePatchContext
                      compact={!editing("context")}
                      inline
                      rulesetId={rulesetId}
                      allowUnknownPatch={archiveEligible}
                      baselineMode={baselineMode}
                      value={patchId}
                      disabled={
                        disabled || translationOnly || !editing("context") || !allowPatchChange || !!sourceRevisionId
                      }
                      onChange={(value) => {
                        setPatchId(value)
                        setDirty(true)
                      }}
                    />
                  }
                />
                {editing("context") || content.notes ? (
                  <WarehouseNotes
                    value={content.notes}
                    onChange={(notes) => update({ notes })}
                    disabled={disabled || !editing("context")}
                  />
                ) : (
                  <p className="type-meta">Chưa có ghi chú.</p>
                )}
              </section>
              {hasHistory && (
                <WarehouseChangeHistory
                  kind={kind}
                  entryId={entryId!}
                  rulesetId={rulesetId}
                  locale={locale}
                  currentRevisionId={revisionId}
                />
              )}
              {hasHistory && archiveEligible && (
                <SpellRemovalHistory
                  id={entryId!}
                  revisionId={revisionId!}
                  rulesetId={rulesetId}
                  published={revisionPublished}
                  canPublish={canPublish}
                />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function SecondaryMechanics({
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
  async function close() {
    if (busy || uploading) return
    if (
      !dirty ||
      (await confirmDiscard({ title: "Đóng phần chỉnh sửa?", description: `Có thay đổi ${entityName} chưa lưu.` }))
    )
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
    <Sheet open onOpenChange={(open) => !open && void close()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(640px,94vw)] flex-col overflow-hidden sm:max-w-none"
            : "flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl"
        }
      >
        <SheetHeader className="pr-8">
          <SheetTitle>{branch ? `Chỉnh sửa ${entityName}` : `Tạo ${entityName}`}</SheetTitle>
          <SheetDescription>Thiết lập bố cục và các bản dịch.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-auto overflow-y-auto px-4 pb-4">
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
