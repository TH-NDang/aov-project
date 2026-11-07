import { catalogScopePatch, resolveCatalogScope } from "./catalog-scope"
import { useCatalogScopePreference } from "./catalog-scope-memory"
import { HeroTimeline } from "./hero-timeline"
import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { revisionSkillReferences } from "./revision-skill-references"
import { useHeroSkillImages } from "./skill-artwork"
import { Link, Navigate, useBeforeUnload, useLocation, useNavigate, useParams } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, FileUp, MoreHorizontal, Plus, RefreshCw, Save, Settings2, Trash2, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Page, PageHeader } from "@/components/page-header"
import { useIsWide } from "@/hooks/use-media-query"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { usePageCloseGuard } from "@/app/layout/page-tabs"
import { errorMessage, isApiError } from "@/lib/api/errors"
import { languageOptions } from "../users/profile-preference-picker"
import { createPublishingApi, heroPreviewKey } from "./publishing-api"
import { invalidateHeroCatalogs } from "./publishing-cache"
import { BaselineContextForm } from "./baseline-context-form"
import { HeroAsset, HeroContent } from "./hero-content"
import { HeroScrollIdentity } from "./hero-scroll-identity"
import { HeroQuickSwitcher } from "./hero-quick-switcher"
import { selectCatalogRevisions } from "./catalog-data"
import { HeroCatalog } from "./hero-catalog"
import { HeroRevisionHistory } from "./hero-revision-history"
import { HeroPatchTimeline } from "./hero-patch-view"
import { HeroTranslationStatus } from "./hero-translation-status"
import { HeroLanguagePicker } from "./hero-language-picker"
import { HeroReviewNotice } from "./hero-review-notice"
import { reviewTab, type HeroReviewItem } from "./hero-source-review"
import {
  missingTranslationFields,
  translatedText,
  translationFields,
  type TranslationField,
  type TranslationTarget,
} from "./hero-translation-model"
import { TranslationEditor, type TranslatableSection } from "./translation-editor"
import { Box, control } from "./fields"
import { PatchChangeForm } from "./patch-change-form"
import { SectionEditor, emptySection } from "./section-editor"
import { statPatchContext } from "./combat-attributes"
import { useStatDefaults } from "./patch-stat-defaults"
import { replaceProfilePart, type ProfileEditorPart } from "./hero-profile-editor"
import { ImportContextPicker, type ImportContext } from "./import-context"
import { type CatalogFilter } from "./catalog-context"
import { usePublicationOverview, useContentLocale } from "./publication-overview"
import { publicationPatchLink, publishBlockers, usesObservedStats } from "./publish-rules"
import {
  SECTIONS,
  type Cause,
  type Content,
  type HeroRow,
  type Preview,
  type Revision,
  type Section,
  type Skill,
} from "./types"
import {
  heroLocationId,
  heroPageLocation,
  readHeroLocation,
  switchHeroLocation,
  type HeroWorkspaceView,
} from "./hero-location"
import { useHeroLocation } from "./use-hero-location"
import { HeroNavigationGuard } from "./hero-navigation-guard"
import { useLocalDraft } from "@/app/drafts/use-local-draft"
import { DraftStatusControl } from "@/app/drafts/draft-status"
import { HeroDraftChanges, savedHeroSections } from "./hero-draft-changes"
import { PublishButton } from "./publish-button"
import { ReferenceRulesetProvider } from "../terminology/catalog"
import { visibleSkins } from "./hero-skins"
import { HeroWorkspaceTabs } from "./hero-workspace-tabs"
import { captureFocus } from "./patch-capture-model"
import { PatchCapturePanel, PatchCaptureToggle } from "./patch-capture-panel"
import { PatchCaptureProvider, usePatchCaptureWorkspace, type PatchCaptureWorkspace } from "./use-patch-captures"
import {
  dirtyHeroSections,
  emptyHeroContent,
  heroWorkingConflict,
  type HeroWorkingCopy,
  heroWorkingSchema,
  mergeHeroWorkingCopy,
  sameHeroSection,
} from "./hero-working-copy"
import { toast } from "sonner"

const api = createPublishingApi(backendRequest)
const CAUSES: Record<Cause, string> = {
  DATA_BASELINE: "Mốc dữ liệu đã biết",
  CONTENT_CORRECTION: "Sửa nội dung",
  GAME_PATCH: "Cập nhật gameplay",
  TRANSLATION: "Bản dịch",
  IMPORT_CORRECTION: "Sửa dữ liệu nhập",
  VISUAL_UPDATE: "Thay artwork",
  OTHER: "Khác",
}
const STATES = { DRAFT: "Bản nháp", PUBLISHED: "Đã xuất bản", DISCARDED: "Đã hủy" }
const noSkills: Skill[] = []

function PublishingFrame({
  detail,
  footer,
  revision,
  heroContent,
  captures,
  ...props
}: ComponentProps<typeof Page> & {
  detail: boolean
  footer?: ReactNode
  revision?: Revision
  heroContent?: Content
  captures: PatchCaptureWorkspace
}) {
  const images = useHeroSkillImages(
    heroContent?.SKILLS?.skills.some((skill) => !skill.iconAssetId) ? revision?.heroId : undefined,
  )
  const skills = useMemo(
    () => (revision && heroContent ? revisionSkillReferences(revision, heroContent, images.data ?? []) : []),
    [revision, heroContent, images.data],
  )
  return (
    <ReferenceRulesetProvider rulesetId={revision?.rulesetId} skills={skills}>
      <PatchCaptureProvider value={captures}>
        {detail ? (
          // A container query cannot style its own container, so the split direction lives one level down.
          <div className="@container/hero-split flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col @5xl/hero-split:flex-row">
              <div className="@container flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
                  <Page {...props} />
                </div>
                {footer}
              </div>
              {captures.open && captures.state.status !== "unavailable" && <PatchCapturePanel captures={captures} />}
            </div>
          </div>
        ) : (
          <Page {...props} />
        )}
      </PatchCaptureProvider>
    </ReferenceRulesetProvider>
  )
}

/** Mounted while open, so the viewport check runs only when the sheet is shown. */
function ManagementSheet({
  description,
  onClose,
  children,
}: {
  description: string
  onClose: () => void
  children: ReactNode
}) {
  const wide = useIsWide()
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        aria-label="Quản lý phiên bản"
        className={wide ? "w-[min(640px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader className="gap-1 border-b">
          <SheetTitle className="type-section-title pr-8">Quản lý phiên bản</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}

export function PublishingPage({ translationMode = false }: { translationMode?: boolean }) {
  const { heroId = "" } = useParams()
  // Shares the workspace's revisions query; the backend rejects a hero code in the id slot, e.g. /hero/airi.
  const revisions = useQuery({
    queryKey: ["publishing-revisions", heroId],
    queryFn: () => api.revisions(heroId),
    enabled: !!heroId,
  })
  if (
    isApiError(revisions.error, "INVALID_REQUEST") &&
    revisions.error.problem.errors?.some((field) => field.path === "heroId")
  )
    return <HeroCodeRedirect code={heroId} />
  return <PublishingWorkspace key={`${heroId}:${translationMode}`} heroId={heroId} translationMode={translationMode} />
}

/** Opens `/hero/{code}` links, e.g. `/hero/airi`, by swapping the code for the hero's id. */
function HeroCodeRedirect({ code }: { code: string }) {
  const location = useLocation()
  const lookup = useQuery({
    queryKey: ["publishing-hero-code", code.toLowerCase()],
    queryFn: ({ signal }) => api.heroes(0, { q: code }, signal),
  })
  const match = lookup.data?.items.find((row) => row.code.toLowerCase() === code.toLowerCase())
  if (match)
    return (
      <Navigate
        replace
        to={`${location.pathname.replace(/^\/hero\/[^/]+/, `/hero/${match.id}`)}${location.search}${location.hash}`}
      />
    )
  return (
    <Page>
      {lookup.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tìm tướng “{code}”…
        </p>
      ) : (
        <div role="alert" className="space-y-3 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">
            {lookup.isError ? errorMessage(lookup.error) : `Không tìm thấy tướng có mã “${code}”.`}
          </p>
          <Button variant="outline" asChild>
            <Link to="/hero">
              <ArrowLeft className="size-4" />
              Về danh sách tướng
            </Link>
          </Button>
        </div>
      )}
    </Page>
  )
}

export function PublishingWorkspace({
  heroId,
  revisionId,
  onUnsavedChange,
  translationMode = false,
}: {
  heroId: string
  revisionId?: string
  onUnsavedChange?: (unsafe: boolean, busy?: boolean) => void
  translationMode?: boolean
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("hero:write")
  const canPublish = capabilities.includes("hero:publish")
  const { params: urlParams, update: updateLocation } = useHeroLocation()
  const requestedRevision = revisionId ?? heroLocationId(urlParams.get("revision"))
  const [selectedId, setSelectedId] = useState(requestedRevision)
  const [editing, setEditing] = useState(false)
  const [profilePart, setProfilePart] = useState<ProfileEditorPart>("information")
  const [managementOpen, setManagementOpen] = useState(false)
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [reviewTarget, setReviewTarget] = useState<HeroReviewItem | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [cause, setCause] = useState<Cause>(translationMode ? "TRANSLATION" : "CONTENT_CORRECTION")
  const [importContext, setImportContext] = useState<ImportContext | null>(null)
  const [publishFailure, setPublishFailure] = useState("")
  const [publishing, setPublishing] = useState(false)
  const requestedFilter: CatalogFilter = {
    seasonId: heroLocationId(urlParams.get("season")),
    variantId: heroLocationId(urlParams.get("patch")),
  }
  const editorRef = useRef<HTMLDivElement>(null)
  const sectionFormId = useId()
  const heroHeadingRef = useRef<HTMLHeadingElement>(null)
  const overview = usePublicationOverview()
  const preferred = useCatalogScopePreference(overview.data, requestedFilter, !heroId)
  const filter = !heroId && overview.data ? resolveCatalogScope(overview.data, preferred) : requestedFilter
  const setFilter = (next: CatalogFilter) =>
    updateLocation(catalogScopePatch(!heroId && overview.data ? resolveCatalogScope(overview.data, next) : next))
  useEffect(() => {
    if (
      !heroId &&
      overview.data &&
      (filter.variantId !== requestedFilter.variantId || filter.seasonId !== requestedFilter.seasonId)
    )
      updateLocation(catalogScopePatch(filter))
  }, [
    heroId,
    overview.data,
    filter.variantId,
    filter.seasonId,
    requestedFilter.variantId,
    requestedFilter.seasonId,
    updateLocation,
  ])
  const displayLocale = useContentLocale()
  const location = readHeroLocation(urlParams, translationMode, displayLocale)
  const { view, section, targetLocale, sourceLocale } = location
  const setSection = (value: Section) =>
    updateLocation({ section: value, translationKey: null, translationField: null })
  const setContentLocale = (value: string) => updateLocation({ readLocale: value })
  const setTargetLocale = (value: string) => updateLocation({ target: value })
  const setSourceLocale = (value: string) => updateLocation({ source: value })
  const rulesets = useQuery({ queryKey: ["publishing-rulesets"], queryFn: api.rulesets })
  const regions = useQuery({ queryKey: ["publishing-regions"], queryFn: api.regions })
  const revisions = useQuery({
    queryKey: ["publishing-revisions", heroId],
    queryFn: () => api.revisions(heroId),
    enabled: !!heroId,
  })
  const read = useQuery({
    queryKey: heroPreviewKey(heroId, selectedId),
    queryFn: () => api.read(heroId, selectedId),
    enabled: !!heroId && !!selectedId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
  const initialCopy: HeroWorkingCopy = { content: read.data?.content ?? emptyHeroContent, notes: {} }
  const localDraft = useLocalDraft({
    form: `hero:${heroId}:${selectedId}`,
    initialValue: initialCopy,
    baseVersion: read.data?.revision.version ?? null,
    schema: heroWorkingSchema,
    enabled: !!heroId && !!selectedId && !!read.data && canWrite && read.data.revision.state === "DRAFT",
    hasConflict: heroWorkingConflict,
    merge: mergeHeroWorkingCopy,
  })
  const preview: Preview | null = read.data ? { ...read.data, content: localDraft.value.content } : null
  const dirty = new Set(dirtyHeroSections(localDraft.value, initialCopy))
  const noteKey = editing && section === "PROFILE" && profilePart === "lore" ? "PROFILE_LORE" : section
  const note = localDraft.value.notes[noteKey] ?? ""
  const setNote = (value: string) => {
    const notes = { ...localDraft.value.notes }
    if (value) notes[noteKey] = value
    else delete notes[noteKey]
    localDraft.update({ ...localDraft.value, notes })
  }
  const revision = preview?.revision
  const statPatch = statPatchContext(
    overview.data?.variants ?? [],
    revision,
    heroLocationId(urlParams.get("atPatch")) || filter.variantId || null,
    preview?.content,
  )
  const statDefaults = useStatDefaults(statPatch?.id)
  const writable = canWrite && revision?.state === "DRAFT"
  const savedChanges = useQuery({
    queryKey: ["hero-draft-changes", heroId, revision?.id, revision?.version],
    queryFn: () => api.draftChanges(heroId, revision!.id),
    enabled: !!writable,
    retry: false,
  })
  const savedSections = savedChanges.data ? savedHeroSections(savedChanges.data) : []
  const translating = view === "translations"
  const locale = translating ? targetLocale : location.readLocale
  const focusedProfile = !translating && section === "PROFILE"
  const editorLocale = locale
  const editorDisabled =
    !writable ||
    busy ||
    !localDraft.ready ||
    localDraft.invalid ||
    localDraft.conflict ||
    read.isFetching ||
    (translating && sourceLocale === locale)
  const sectionValue = focusedProfile
    ? replaceProfilePart(
        read.data?.content.PROFILE ?? null,
        preview?.content.PROFILE ?? null,
        profilePart,
        editorLocale,
      )
    : preview?.content[section]
  const sectionDirty = focusedProfile
    ? !sameHeroSection("PROFILE", sectionValue, read.data?.content.PROFILE)
    : dirty.has(section)
  const editorTitle =
    focusedProfile && profilePart === "lore" ? "Cốt truyện" : SECTIONS.find(([key]) => key === section)![2]
  const heroName =
    translatedText(preview?.content.PROFILE?.translations ?? [], location.readLocale, ["name"])?.name || "Hồ sơ tướng"
  const captures = usePatchCaptureWorkspace({
    heroId,
    heroName: preview?.content.PROFILE ? heroName : "",
    patchCode: statPatch?.patchCode,
    skills: preview?.content.SKILLS?.skills ?? noSkills,
    locale: location.readLocale,
    ready: !!preview && !overview.isPending,
    focus: captureFocus({
      view,
      tab: location.tab,
      editing,
      section,
      skillKey: heroLocationId(urlParams.get("skill")),
      skills: preview?.content.SKILLS?.skills ?? noSkills,
    }),
  })
  const publicationPatch = overview.data?.variants.find(
    (variant) => variant.id === revision?.effectiveFromPatchVariantId,
  )
  const issues = preview
    ? publishBlockers({
        revision: preview.revision,
        content: preview.content,
        patch: publicationPatch,
        patchLoading: overview.isPending,
        observedStats: usesObservedStats(preview.content, publicationPatch),
      }).map((blocker) => blocker.message)
    : []

  useEffect(() => {
    if (requestedRevision === selectedId) return
    setSelectedId(requestedRevision)
    setEditing(false)
    setError("")
  }, [heroId, requestedRevision])
  useEffect(() => {
    if (!selectedId && !requestedRevision && revisions.data?.length) {
      const chosen =
        revisions.data.find((row) => row.state === "DRAFT") ??
        revisions.data.find((row) => row.state === "PUBLISHED") ??
        revisions.data[0]
      if (chosen) {
        setSelectedId(chosen.id)
        updateLocation({ revision: chosen.id })
      }
    }
  }, [revisions.data, selectedId, requestedRevision])
  useEffect(() => {
    onUnsavedChange?.(busy, busy)
  }, [busy, onUnsavedChange])
  useEffect(() => {
    if (editing) {
      editorRef.current?.focus({ preventScroll: true })
      editorRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" })
    }
  }, [editing])
  useBeforeUnload((event) => {
    if (busy) {
      event.preventDefault()
      event.returnValue = ""
    }
  })
  const canLeave = () => !busy
  usePageCloseGuard(canLeave, !!heroId && !onUnsavedChange)

  function switchHero(next: HeroRow) {
    if (busy || next.id === heroId) return
    const rulesetId = revision?.rulesetId || heroLocationId(urlParams.get("ruleset"))
    const selected =
      selectCatalogRevisions(next.revisions, overview.data, filter, rulesetId)[0] ??
      [...next.revisions]
        .filter((row) => row.state !== "DISCARDED" && (!rulesetId || row.rulesetId === rulesetId))
        .sort((a, b) => b.revisionNo - a.revisionNo)[0]
    const params = switchHeroLocation(urlParams, next.id, selected?.id)
    if (onUnsavedChange) void navigate({ search: `?${params}` }, { preventScrollReset: true })
    else void navigate(heroPageLocation(next.id, params), { preventScrollReset: false })
  }
  const quickSwitcher = heroId ? (
    <HeroQuickSwitcher
      heroId={heroId}
      locale={displayLocale}
      rulesetId={revision?.rulesetId}
      disabled={busy || !preview}
      onSelect={switchHero}
    />
  ) : null

  async function run(action: () => Promise<unknown>, success: string, onFailure: (message: string) => void = setError) {
    setBusy(true)
    setError("")
    try {
      await action()
      toast.success(success)
      await invalidateHeroCatalogs(queryClient)
      await queryClient.invalidateQueries({ queryKey: ["hero-comparison", heroId] })
      await revisions.refetch()
    } catch (failure) {
      onFailure(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  async function openRevision(next: Revision) {
    const data = await api.read(next.heroId, next.id)
    queryClient.setQueryData(["publishing-preview", next.heroId, next.id], data)
    setSelectedId(next.id)
    updateLocation({ revision: next.id, compare: null, changes: null })
    setEditing(false)
  }
  function update(value: NonNullable<Content[Section]>) {
    localDraft.update({ ...localDraft.value, content: { ...localDraft.value.content, [section]: value } })
  }
  function openTranslation(target: TranslationTarget) {
    if (busy) return
    updateLocation({
      view: "translations",
      section: target.section,
      target: location.readLocale,
      source: target.sourceLocale,
      readLocale: location.readLocale,
      translationKey: target.key,
      translationField: target.field,
    })
    setEditing(false)
    setError("")
  }
  function switchView(next: HeroWorkspaceView) {
    if (busy) return
    updateLocation({
      view: next,
      ...(next === "translations" && !["PROFILE", "SKILLS", "SKINS"].includes(section) ? { section: "PROFILE" } : {}),
    })
    setEditing(false)
  }
  function cancelSection() {
    setEditing(false)
    setError("")
    if (!sectionDirty && !note) return
    const notes = { ...localDraft.value.notes }
    delete notes[noteKey]
    localDraft.update({
      content: {
        ...localDraft.value.content,
        [section]: focusedProfile
          ? replaceProfilePart(
              localDraft.value.content.PROFILE,
              read.data?.content.PROFILE ?? null,
              profilePart,
              editorLocale,
            )
          : structuredClone(read.data?.content[section]),
      },
      notes,
    })
  }
  async function refresh() {
    if (!canLeave()) return
    await run(async () => {
      const fresh = await api.read(heroId, selectedId)
      queryClient.setQueryData(["publishing-preview", heroId, selectedId], fresh)
      setEditing(false)
    }, "Đã tải phiên bản mới nhất.")
  }
  function openManagement() {
    setError("")
    setManagementOpen(true)
  }
  function openUnsavedSection(next: Section) {
    updateLocation({ view: "overview" })
    setSection(next)
    setProfilePart("information")
    setEditing(true)
    setError("")
  }
  function publishRevision() {
    if (!revision) return
    setPublishing(true)
    void run(
      async () => {
        const published = await api.publish(revision, note)
        await localDraft.discard()
        await openRevision(published)
      },
      "Đã xuất bản phiên bản tướng.",
      setPublishFailure,
    ).finally(() => setPublishing(false))
  }
  // One ruleset holds one draft, so a second one can only fail: offer the one that exists instead.
  const openDraft = revisions.data?.find((row) => row.state === "DRAFT" && row.rulesetId === revision?.rulesetId)
  const startDraftLabel = openDraft ? `Mở bản nháp #${openDraft.revisionNo}` : "Tạo bản nháp"
  function startDraft() {
    if (!openDraft) return openManagement()
    setSelectedId(openDraft.id)
    updateLocation({ revision: openDraft.id, compare: null, changes: null })
    setEditing(false)
  }
  const canMoveBaseline =
    !!writable &&
    revision?.cause === "DATA_BASELINE" &&
    !revision.sourceRevisionId &&
    !revisions.data?.some((row) => row.state === "PUBLISHED" && row.rulesetId === revision.rulesetId)
  const canFork = revision?.state === "PUBLISHED" && canWrite && !openDraft
  const canRecordChanges =
    revision?.state === "PUBLISHED" &&
    revision.cause === "GAME_PATCH" &&
    !!revision.effectiveFromPatchVariantId &&
    capabilities.includes("patch:write")

  const patchLink = revision && publicationPatchLink(revision, publicationPatch)

  // A link from the overview of all heroes lands on the part to fix, once the draft is here to open it.
  const fix = urlParams.get("fix")
  const fixReady = !!fix && !!preview && !revisions.isPending && (!writable || localDraft.ready)
  useEffect(() => {
    if (!fixReady) return
    updateLocation({ fix: null })
    if (fix === "PATCH") {
      if (canMoveBaseline) openManagement()
    } else if (SECTIONS.some(([key]) => key === fix)) {
      if (writable) {
        setProfilePart("information")
        setEditing(true)
      } else setReviewTarget({ note: "", section: fix as Section })
    }
  }, [fixReady])

  // The one action the header offers for this version; the rest stays in its menu.
  const headerAction =
    revision?.state === "DRAFT" && canPublish ? "publish" : revision?.state === "PUBLISHED" && canWrite ? "draft" : null
  function discardDraft() {
    if (!revision || !window.confirm("Hủy bản nháp này? Bản đã xuất bản vẫn được giữ lại.")) return
    void run(async () => {
      const discarded = await api.discard(revision)
      await localDraft.discard()
      await openRevision(discarded)
    }, "Đã hủy bản nháp.")
  }

  return (
    <PublishingFrame
      detail={!!heroId}
      footer={
        writable &&
        (editing || translating) && (
          <fieldset
            aria-label="Lưu thay đổi"
            disabled={editorDisabled}
            className="m-0 min-w-0 shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]"
          >
            <div className="mx-auto grid w-full max-w-6xl gap-2 px-4 py-2 @min-[650px]:grid-cols-[minmax(0,1fr)_auto] @min-[650px]:items-center md:px-6">
              <label className="min-w-0">
                <span className="sr-only">Ghi chú thay đổi</span>
                <input
                  form={sectionFormId}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:bg-muted/40 disabled:text-muted-foreground"
                  placeholder="Ghi chú thay đổi (tùy chọn)"
                  value={note}
                  disabled={!sectionDirty}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <div className="flex min-w-0 items-center justify-end gap-2">
                <span className="type-meta mr-auto truncate @min-[650px]:sr-only">
                  {sectionDirty ? "Có thay đổi chưa lưu" : "Chưa có thay đổi"}
                </span>
                <Button type="button" variant="outline" onClick={cancelSection}>
                  <X className="size-4" />
                  <span>
                    Hủy<span className="sr-only"> chỉnh sửa phần này</span>
                  </span>
                </Button>
                <Button type="submit" form={sectionFormId} disabled={!sectionDirty}>
                  <Save className="size-4" />
                  {busy ? "Đang lưu…" : "Lưu phần này"}
                </Button>
              </div>
            </div>
          </fieldset>
        )
      }
      revision={revision}
      captures={captures}
      heroContent={view === "overview" || translating ? preview?.content : undefined}
      className={`@container min-w-0 ${heroId ? "mx-auto w-full max-w-6xl" : ""}`}
    >
      {!onUnsavedChange && <HeroNavigationGuard unsafe={busy} busy={busy} />}
      {heroId && (
        <HeroScrollIdentity
          headingRef={heroHeadingRef}
          identityKey={`${heroId}:${selectedId}`}
          assetId={preview?.content.MEDIA_BINDINGS?.bindings.HEAD}
          name={heroName}
          actions={quickSwitcher}
        />
      )}
      {!heroId ? (
        <PageHeader
          title="Tướng"
          search={<div ref={setSearchSlot} className="contents" />}
          actions={
            canWrite ? (
              <PageActionsMenu label="Tạo và import tướng">
                <DropdownMenuItem asChild>
                  <Link to="/hero/new">
                    <Plus />
                    Tạo tướng
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/hero/import">
                    <FileUp />
                    Import tướng
                  </Link>
                </DropdownMenuItem>
              </PageActionsMenu>
            ) : undefined
          }
        />
      ) : (
        <>
          <header className="relative">
            {/* The name and the controls wrap as two whole groups, so no button can end up alone on a line. */}
            <div className="flex flex-col gap-3 @2xl:flex-row @2xl:flex-wrap @2xl:items-center @2xl:justify-end @2xl:gap-x-4">
              <div className="flex min-w-0 items-center gap-2.5 @max-2xl:pr-11 @2xl:flex-auto">
                {!onUnsavedChange && (
                  <Button variant="ghost" size="icon" asChild>
                    <Link
                      to="/hero"
                      aria-label="Danh sách tướng"
                      onClick={(event) => {
                        if (!canLeave()) event.preventDefault()
                      }}
                    >
                      <ArrowLeft className="size-4" />
                    </Link>
                  </Button>
                )}
                <HeroAsset
                  id={preview?.content.MEDIA_BINDINGS?.bindings.HEAD}
                  alt={`Ảnh tướng ${heroName}`}
                  className="size-9 shrink-0 rounded-full"
                  frameAspectRatio={1}
                />
                <div className="min-w-0">
                  <h1 ref={heroHeadingRef} className="truncate text-base font-semibold">
                    {heroName}
                  </h1>
                  <p className="truncate text-xs text-muted-foreground">
                    {revision ? CAUSES[revision.cause] : "Đang mở dữ liệu"}
                  </p>
                </div>
                {quickSwitcher}
                <PatchCaptureToggle />
                {preview && (
                  <HeroReviewNotice
                    skills={preview.content.SKILLS?.skills ?? []}
                    locale={location.readLocale}
                    disabled={busy}
                    onReview={
                      writable && !editorDisabled
                        ? () => {
                            updateLocation({ view: "overview", section: "SKILLS", tab: "skills" })
                            setEditing(true)
                            setReviewOpen(true)
                          }
                        : undefined
                    }
                    onNavigate={(item) => {
                      if (!item.section) return
                      setEditing(false)
                      setReviewTarget(item)
                      updateLocation({
                        view: "overview",
                        section: item.section,
                        tab: reviewTab(item.section),
                        skill: item.skillKey,
                      })
                    }}
                  />
                )}
                {writable && (
                  <DraftStatusControl
                    key={revision.id}
                    draft={localDraft}
                    disabled={busy}
                    sections={dirty.size}
                    changed={new Set([...dirty, ...savedSections]).size}
                    alwaysShown
                    discardLabel="Bỏ thay đổi chưa lưu"
                  >
                    <HeroDraftChanges
                      before={initialCopy}
                      after={localDraft.value}
                      saved={savedChanges.data}
                      savedFailed={savedChanges.isError}
                      locale={locale}
                      name={heroName}
                      revisionNo={revision.revisionNo}
                    />
                  </DraftStatusControl>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2 @2xl:shrink-0">
                {revision && (revisions.data?.length ?? 0) > 1 ? (
                  <label className="flex min-w-0 flex-1 items-center text-sm @2xl:flex-none">
                    <span className="sr-only">Phiên bản dữ liệu</span>
                    <select
                      aria-label="Phiên bản dữ liệu"
                      className="h-9 w-full rounded-md border bg-background px-2.5 text-sm disabled:opacity-50 @2xl:w-44"
                      value={selectedId}
                      disabled={busy}
                      onChange={(event) => {
                        setSelectedId(event.target.value)
                        updateLocation({
                          revision: event.target.value,
                          compare: null,
                          changes: null,
                          translationKey: null,
                          translationField: null,
                        })
                        setEditing(false)
                      }}
                    >
                      {revisions.data?.map((row) => (
                        <option key={row.id} value={row.id}>
                          #{row.revisionNo} · {STATES[row.state]}
                          {new Set(revisions.data?.map((item) => item.rulesetId)).size > 1
                            ? ` · ${rulesets.data?.find((item) => item.id === row.rulesetId)?.code ?? "Bộ quy tắc khác"}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  // Most heroes have a single version; there is nothing to switch to.
                  revision && (
                    <span className="inline-flex h-9 min-w-0 flex-1 items-center rounded-md border bg-muted/40 px-2.5 text-sm @2xl:flex-none">
                      <span className="truncate">
                        #{revision.revisionNo} · {STATES[revision.state]}
                      </span>
                    </span>
                  )
                )}
                {preview && revision && !translating && (
                  <HeroLanguagePicker
                    content={preview.content}
                    locale={location.readLocale}
                    revisionNo={revision.revisionNo}
                    disabled={busy || (editing && section !== "SKILLS")}
                    onChange={setContentLocale}
                  />
                )}
                {headerAction === "publish" && revision && (
                  <PublishButton
                    busy={busy}
                    publishing={publishing}
                    issues={issues}
                    unsaved={SECTIONS.filter(([key]) => dirty.has(key)).map(([key, , label]) => ({ key, label }))}
                    patch={
                      patchLink && {
                        ...patchLink,
                        canPublish: capabilities.includes("patch:publish"),
                      }
                    }
                    onReloadPatch={
                      revision.effectiveFromPatchVariantId && !publicationPatch && !overview.isPending
                        ? () => void overview.refetch()
                        : undefined
                    }
                    reloadingPatch={overview.isFetching}
                    failure={publishFailure}
                    onDismissFailure={() => setPublishFailure("")}
                    onOpenSection={(key) => openUnsavedSection(key as Section)}
                    onPublish={publishRevision}
                  />
                )}
                {headerAction === "draft" && (
                  <Button variant="outline" disabled={busy} onClick={startDraft}>
                    {!openDraft && <Plus className="size-4" />}
                    {startDraftLabel}
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Thao tác tướng"
                      className="shrink-0 @max-2xl:absolute @max-2xl:top-0 @max-2xl:right-0"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {(canMoveBaseline || canFork || canRecordChanges) && (
                      <DropdownMenuItem onSelect={openManagement}>
                        <Settings2 />
                        Quản lý phiên bản
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem disabled={busy} onSelect={() => void refresh()}>
                      <RefreshCw />
                      Tải dữ liệu mới nhất
                    </DropdownMenuItem>
                    {writable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" disabled={busy} onSelect={() => discardDraft()}>
                          <Trash2 />
                          Hủy bản nháp
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          <HeroWorkspaceTabs
            view={view}
            contentTab={location.tab}
            busy={busy}
            counts={{
              skills: preview?.content.SKILLS?.skills.length ?? null,
              skins: preview ? visibleSkins(preview.content.SKINS?.skins ?? []).length : null,
            }}
            onContentTab={(contentTab) => {
              if (busy) return
              updateLocation({ view: "overview", tab: contentTab === "overview" ? null : contentTab })
              setEditing(false)
            }}
            onView={switchView}
          />
        </>
      )}
      {[rulesets.error, regions.error, revisions.error, read.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {errorMessage(failure)}
        </p>
      ))}
      {error && !managementOpen && (
        <div role="alert" className="space-y-1 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          <p>{error}</p>
          {(editing || translating) && (
            <p>Phần đang sửa vẫn được giữ lại. Nếu có xung đột, hủy chỉnh sửa nhóm này rồi tải dữ liệu mới nhất.</p>
          )}
        </div>
      )}
      {!heroId ? (
        <>
          {overview.data ? (
            <>
              <HeroTimeline data={overview.data} rulesetId="" value={filter} onChange={setFilter} />
            </>
          ) : (
            <p role={overview.error ? "alert" : "status"}>
              {overview.error ? errorMessage(overview.error) : "Đang tải mùa và patch…"}
            </p>
          )}
          {overview.data && (
            <HeroCatalog
              ruleset=""
              locale={displayLocale}
              overview={overview.data}
              filter={filter}
              searchSlot={searchSlot}
            />
          )}
        </>
      ) : (
        <>
          {(read.isFetching || revisions.isPending) && !preview && (
            <div
              role="status"
              className="flex min-h-48 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground"
            >
              Đang tải hồ sơ tướng…
            </div>
          )}
          {preview && revision && (
            <>
              {(rulesets.data?.length ?? 0) > 1 && (
                <p className="type-meta">
                  {rulesets.data?.find((row) => row.id === revision.rulesetId)?.code ?? "Bộ quy tắc khác"}
                </p>
              )}
              {revision.state !== "DRAFT" && (editing || translating) && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
                  <p>Đang xem bản chỉ đọc. Tạo bản nháp để chỉnh sửa hoặc thêm bản dịch.</p>
                  {canWrite && (
                    <Button variant="outline" onClick={startDraft}>
                      {startDraftLabel}
                    </Button>
                  )}
                </div>
              )}
              <div role="tabpanel" id={`workspace-${view}`} className="min-w-0 space-y-5">
                {view === "overview" && !editing && (
                  <HeroContent
                    variantId={statPatch?.id}
                    statDefaults={statDefaults.data}
                    referenceError={statDefaults.isError}
                    patchCode={statPatch?.patchCode}
                    showTabs={false}
                    reviewTarget={reviewTarget}
                    onReviewShown={() => setReviewTarget(null)}
                    content={preview.content}
                    locale={locale}
                    editable={!!writable}
                    busy={busy}
                    tab={location.tab}
                    heroId={heroId}
                    selectedSkillKey={heroLocationId(urlParams.get("skill"))}
                    skillLayout={urlParams.get("skillLayout") === "flat" ? "flat" : "focus"}
                    onSkillLayoutChange={(layout) => updateLocation({ skillLayout: layout === "flat" ? "flat" : null })}
                    onSkillChange={(skill) => updateLocation({ skill })}
                    onTabChange={(tab) => updateLocation({ tab })}
                    onTranslate={canWrite ? openTranslation : undefined}
                    onNeedsDraft={canWrite && revision?.state === "PUBLISHED" ? startDraft : undefined}
                    canWrite={canWrite}
                    issues={writable ? issues : undefined}
                    onEdit={(next, part = "information") => {
                      if (next === "PROFILE") {
                        const fields = part === "lore" ? (["lore"] as const) : (["name", "title", "summary"] as const)
                        const missing = missingTranslationFields(
                          preview.content.PROFILE?.translations ?? [],
                          location.readLocale,
                          fields,
                        )[0]
                        if (missing) return openTranslation({ ...missing, section: "PROFILE", key: "profile" })
                      }
                      setSection(next)
                      setProfilePart(part)
                      setEditing(true)
                      setError("")
                    }}
                  />
                )}
                {translating && (
                  <HeroTranslationStatus
                    content={preview.content}
                    selectedLocale={targetLocale}
                    disabled={busy}
                    onSelect={(next) => {
                      updateLocation({
                        target: next,
                        source:
                          sourceLocale === next
                            ? languageOptions.find((option) => option.value !== next)!.value
                            : sourceLocale,
                        section: "PROFILE",
                        translationKey: null,
                        translationField: null,
                      })
                      setError("")
                    }}
                  />
                )}
                {view === "history" && (
                  <HeroRevisionHistory
                    heroId={heroId}
                    revision={revision}
                    revisions={revisions.data ?? []}
                    locale={locale}
                    content={preview.content}
                    disabled={busy}
                    onOpenRevision={(next) => void run(() => openRevision(next), "Đã mở phiên bản.")}
                  />
                )}
                {view === "patch" && (
                  <HeroPatchTimeline
                    heroId={heroId}
                    revision={revision}
                    revisions={revisions.data ?? []}
                    content={preview.content}
                    locale={locale}
                    canRecord={capabilities.includes("patch:write")}
                  />
                )}
                {(editing || translating) && (
                  <div
                    ref={editorRef}
                    tabIndex={-1}
                    className="scroll-mt-16 space-y-4 outline-none"
                    role="region"
                    aria-label="Chỉnh sửa nội dung"
                  >
                    {translating && (
                      <fieldset disabled={busy} className="grid gap-4 admin-section py-4 @min-[600px]:grid-cols-2">
                        <div className="min-w-0 space-y-2">
                          <p className="type-label">Đọc từ</p>
                          <HeroLanguagePicker
                            label="Ngôn ngữ nguồn"
                            locale={sourceLocale}
                            disabled={busy}
                            onChange={setSourceLocale}
                            compact={false}
                          />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <p className="type-label">Dịch sang</p>
                          <HeroLanguagePicker
                            label="Ngôn ngữ đích"
                            locale={targetLocale}
                            content={preview.content}
                            revisionNo={revision.revisionNo}
                            disabled={busy}
                            onChange={setTargetLocale}
                            compact={false}
                          />
                        </div>
                        {sourceLocale === locale && (
                          <p role="status" className="text-sm text-amber-600 @min-[600px]:col-span-2">
                            Chọn ngôn ngữ đích khác nguồn để bắt đầu biên dịch.
                          </p>
                        )}
                      </fieldset>
                    )}
                    {translating && (
                      <div className="flex gap-1 overflow-x-auto" aria-label="Các phần nội dung">
                        {SECTIONS.filter(([key]) => ["PROFILE", "SKILLS", "SKINS"].includes(key)).map(
                          ([key, , label]) => (
                            <Button
                              key={key}
                              type="button"
                              disabled={busy}
                              className="shrink-0"
                              variant={section === key ? "secondary" : "ghost"}
                              onClick={() => setSection(key)}
                            >
                              {label}
                              {dirty.has(key) && (
                                <span className="size-1.5 rounded-full bg-amber-500" aria-label="Chưa lưu" />
                              )}
                            </Button>
                          ),
                        )}
                      </div>
                    )}
                    <Box title={editorTitle} unframed={section === "SKILLS" && !translating}>
                      <form
                        id={sectionFormId}
                        onSubmit={(event) => {
                          event.preventDefault()
                          if (!sectionDirty || editorDisabled) return
                          void run(async () => {
                            const value = sectionValue ?? emptySection(section, editorLocale)
                            const next = await api.save(revision, section, value, note)
                            const saved = await api.read(heroId, revision.id)
                            queryClient.setQueryData(["publishing-preview", heroId, revision.id], saved)
                            const notes = { ...localDraft.value.notes }
                            delete notes[noteKey]
                            const content = {
                              ...preview.content,
                              [section]: focusedProfile
                                ? replaceProfilePart(
                                    preview.content.PROFILE,
                                    saved.content.PROFILE,
                                    profilePart,
                                    editorLocale,
                                  )
                                : saved.content[section],
                            }
                            localDraft.rebase({ content, notes }, { content: saved.content, notes: {} }, next.version)
                            if (!translating) setEditing(false)
                          }, "Đã lưu nội dung vào bản nháp.")
                        }}
                      >
                        <fieldset disabled={editorDisabled} className="min-w-0 space-y-5">
                          {translating ? (
                            <TranslationEditor
                              section={section as TranslatableSection}
                              value={
                                (preview.content[section] ?? emptySection(section, locale)) as NonNullable<
                                  Content[TranslatableSection]
                                >
                              }
                              sourceLocale={sourceLocale}
                              targetLocale={locale}
                              onChange={update}
                              focusKey={urlParams.get("translationKey") ?? undefined}
                              focusField={
                                Object.hasOwn(translationFields, urlParams.get("translationField") ?? "")
                                  ? (urlParams.get("translationField") as TranslationField)
                                  : undefined
                              }
                              onClearFocus={() => updateLocation({ translationKey: null, translationField: null })}
                            />
                          ) : (
                            <SectionEditor
                              statDefaults={statDefaults.data}
                              referenceError={statDefaults.isError}
                              skills={preview.content.SKILLS}
                              patchCode={statPatch?.patchCode}
                              section={section}
                              value={preview.content[section]}
                              locale={editorLocale}
                              profilePart={profilePart}
                              onChange={update}
                              heroId={heroId}
                              initialSkillKey={heroLocationId(urlParams.get("skill"))}
                              skillLayout={urlParams.get("skillLayout") === "flat" ? "flat" : "focus"}
                              onSkillLayoutChange={(layout) =>
                                updateLocation({ skillLayout: layout === "flat" ? "flat" : null })
                              }
                              onSkillChange={(skill) => updateLocation({ skill })}
                              onBusyChange={setBusy}
                              reviewOpen={reviewOpen}
                              onReviewOpenChange={setReviewOpen}
                            />
                          )}
                        </fieldset>
                      </form>
                    </Box>
                  </div>
                )}
              </div>
              {/* A sheet keeps publishing next to the page instead of below every section. */}
              {managementOpen && (
                <ManagementSheet
                  onClose={() => setManagementOpen(false)}
                  description={`Bản #${revision.revisionNo} · ${STATES[revision.state]} · ${CAUSES[revision.cause]}`}
                >
                  <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pt-4 pb-6">
                    {error && (
                      <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    {canFork && (
                      <Box title="Tạo bản nháp kế thừa">
                        <form
                          className="space-y-4"
                          onSubmit={(event) => {
                            event.preventDefault()
                            void run(async () => {
                              await openRevision(
                                await api.fork(
                                  revision,
                                  cause,
                                  cause === "GAME_PATCH" ? (importContext?.patchVariantId ?? null) : null,
                                ),
                              )
                              setManagementOpen(false)
                            }, "Đã tạo bản nháp từ phiên bản đã chọn.")
                          }}
                        >
                          <label className="grid gap-2 text-sm">
                            Loại thay đổi
                            <select
                              className={control}
                              value={cause}
                              onChange={(event) => setCause(event.target.value as Cause)}
                            >
                              {Object.entries(CAUSES)
                                .filter(([key]) => key !== "DATA_BASELINE")
                                .map(([key, label]) => (
                                  <option value={key} key={key}>
                                    {label}
                                  </option>
                                ))}
                            </select>
                          </label>
                          {cause === "GAME_PATCH" && (
                            <>
                              <ImportContextPicker
                                regions={regions.data ?? []}
                                value={importContext}
                                onChange={setImportContext}
                                disabled={busy}
                              />
                              {importContext && importContext.rulesetId !== revision.rulesetId && (
                                <p className="text-sm text-destructive">Chọn patch thuộc cùng bộ quy tắc gameplay.</p>
                              )}
                            </>
                          )}
                          <Button
                            disabled={
                              busy ||
                              !!dirty.size ||
                              (cause === "GAME_PATCH" &&
                                (!importContext || importContext.rulesetId !== revision.rulesetId))
                            }
                          >
                            Tạo bản nháp từ mốc này
                          </Button>
                        </form>
                      </Box>
                    )}
                    {canMoveBaseline && (
                      <BaselineContextForm
                        revision={revision}
                        disabled={busy || !!dirty.size}
                        onBusyChange={setBusy}
                        onMove={async (next) => {
                          await openRevision(next)
                          await invalidateHeroCatalogs(queryClient)
                          await queryClient.invalidateQueries({ queryKey: ["hero-comparison", heroId] })
                          await revisions.refetch()
                          setManagementOpen(false)
                          toast.success("Đã chuyển mốc ban đầu, giữ nguyên nội dung và ảnh.")
                        }}
                      />
                    )}
                    {canRecordChanges && <PatchChangeForm key={revision.id} revision={revision} locale={locale} />}
                  </div>
                </ManagementSheet>
              )}
            </>
          )}
        </>
      )}
    </PublishingFrame>
  )
}
