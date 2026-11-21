import { WarehouseChangeHistory } from "../history/warehouse-change-history"
import { useWarehouseRevisions } from "../../api/warehouse-api"
import { WarehouseDraftChanges } from "../history/warehouse-draft-changes"
import { useEffect, useState } from "react"
import {
  ChartNoAxesCombined,
  History,
  Image,
  Layers,
  LayoutList,
  Plus,
  SlidersHorizontal,
  Trash2,
  Clapperboard,
  FileText,
} from "lucide-react"
import { SubjectVideosPanel } from "../../../videos/subject-videos-panel"
import { Button } from "@aov/ui/components/button"
import type { WarehouseSection } from "../sheet/warehouse-edit-section"
import { SecondaryAttributes } from "./secondary-attributes"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { ContentsSection, SectionContents, useSectionContents, type ContentsEntry } from "@/components/section-contents"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "../../../publishing/components/assets/asset-picker"
import { HeroAsset } from "@/features/publishing/components/editing/hero-asset"
import { VersionFacts } from "../../../publishing/components/setup/version-facts"
import { Field } from "../../../publishing/components/editing/fields"
import { WarehouseTranslations } from "../sheet/warehouse-translations"
import { WarehousePatchContext } from "../history/warehouse-patch-context"
import { warehouseMissingFieldLabel } from "../../model/warehouse-labels"
import { WarehouseStatsEditor } from "../sheet/warehouse-stats-editor"
import { WarehouseNotes } from "../sheet/warehouse-notes"
import { SpellArtwork } from "../spells/spell-artwork"
import { SpellRemovalHistory } from "../spells/spell-removal-history"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import { WarehouseOrderPicker } from "./warehouse-order-picker"
import {
  LanguagePicker,
  ReferenceLanguage,
  baseLanguage,
  languageName,
  pickDisplayLanguage,
  translationProgress,
} from "../sheet/warehouse-translation-panel"
import {
  CopyCode,
  SHEET_TAB,
  SHEET_TAB_LIST,
  SheetActions,
  WarehouseDescription,
  focusSheet,
  versionLabel,
  type NewDraft,
} from "../sheet/warehouse-sheet"
import { warehouseBaselineMode, type WarehouseEntry, type WarehouseRevision } from "../../model/warehouse-types"
import { warehouseText, type EnchantmentContent } from "@aov/ui/lib/warehouse-content"
import { confirmDiscard } from "@/components/confirm-dialog"
import {
  SecondaryKind,
  SecondaryContent,
  SecondaryBranch,
  secondaryNames,
  semanticTypes,
} from "../../model/secondary-content"
import { SecondaryMechanics } from "./secondary-mechanics"

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
  onOpenRevision,
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
  /** Opens another version of the entry in this sheet, as the hero page does. */
  onOpenRevision?: (revisionId: string) => void
}) {
  const revisions = useWarehouseRevisions(kind, entryId)
  const [changesOpen, setChangesOpen] = useState(false)
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
        {/* One row at every width, as the hero's: the icon, the name over one line of facts, then the controls. */}
        <SheetHeader className="shrink-0 flex-row flex-nowrap items-center gap-3 px-4 py-3">
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
                className="size-10 shrink-0 rounded-full"
              />
            ))}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <SheetTitle className="type-section-title truncate">{isNew ? `Tạo ${kindName}` : name}</SheetTitle>
              {!isNew && <CopyCode code={initialCode} />}
            </div>
            <p className="type-meta flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap">
              {facts.filter(Boolean).map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </p>
            <SheetDescription className="sr-only">
              {isNew ? `Điền thông tin ${kindName} rồi lưu nháp.` : `Mã ${initialCode}`}
            </SheetDescription>
          </div>
          <SheetActions
            version={isNew ? "Mới" : versionLabel(revisionNo, revisionState, editingPage)}
            changes={!isNew && revisionState === "DRAFT" ? { onOpen: () => setChangesOpen(true) } : undefined}
            versions={
              !isNew && onOpenRevision && revisionId && revisionNo != null && revisionState
                ? {
                    current: { id: revisionId, revisionNo, state: revisionState, rulesetId },
                    rows: revisions.data?.filter((row) => row.rulesetId === rulesetId),
                    onChoose: onOpenRevision,
                  }
                : undefined
            }
            editing={editingPage}
            disabled={busy || uploading}
            closeDisabled={busy || uploading}
            onClose={() => void close()}
            language={
              isNew ? undefined : (
                <LanguagePicker
                  variant="menu"
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
              canPublish && onPublish
                ? revisionState !== "PUBLISHED"
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
                  : // A published version with a draft in progress publishes that draft from here, as items do, so the
                    // draft does not have to be opened first to find the button.
                    {
                      disabled: false,
                      title: openDraftNo ? `Xuất bản bản nháp #${openDraftNo}` : undefined,
                      onClick: () => void act(onPublish),
                    }
                : undefined
            }
          />
        </SheetHeader>
        {!isNew && entryId && revisionState === "DRAFT" && revisionNo != null && (
          <WarehouseDraftChanges
            open={changesOpen}
            onOpenChange={setChangesOpen}
            kind={kind}
            entryId={entryId}
            name={warehouseText(initialContent.translations, locale)?.name ?? initialCode ?? kindName}
            revisionNo={revisionNo}
            sourceRevisionId={sourceRevisionId}
            content={initialContent}
            locale={locale}
          />
        )}
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
              <div className="type-body rounded-lg border border-(--aov-warning)/30 bg-(--aov-warning-soft) p-3">
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
                  onOpenRevision={onOpenRevision}
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
