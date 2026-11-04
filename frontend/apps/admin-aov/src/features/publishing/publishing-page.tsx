import { catalogScopePatch } from "./catalog-scope"
import { resolveHeroCatalogScope } from "./hero-catalog-scope"
import { HeroTimeline } from "./hero-timeline"
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Link, Navigate, useBeforeUnload, useLocation, useNavigate, useParams } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
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
import type { Hero } from "@/lib/api/types"
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
import {
  missingTranslationFields,
  translatedText,
  translationFields,
  type TranslationField,
  type TranslationTarget,
} from "./hero-translation-model"
import { TranslationEditor, type TranslatableSection } from "./translation-editor"
import { Box, Field, control } from "./fields"
import { PatchChangeForm } from "./patch-change-form"
import { SectionEditor, emptySection } from "./section-editor"
import { statPatchContext } from "./combat-attributes"
import { useStatDefaults } from "./patch-stat-defaults"
import { replaceProfilePart, type ProfileEditorPart } from "./hero-profile-editor"
import { sameDraftValue } from "@/app/drafts/draft-store"
import { ImportContextPicker, type ImportContext } from "./import-context"
import { type CatalogFilter } from "./catalog-context"
import { usePublicationOverview, useContentLocale } from "./publication-overview"
import { resourceContent } from "./resource-import"
import {
  SECTIONS,
  publishIssues,
  type Cause,
  type Content,
  type HeroRow,
  type Preview,
  type Revision,
  type Section,
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
import { DraftStatus } from "@/app/drafts/draft-status"
import { ReferenceRulesetProvider } from "../terminology/catalog"
import { visibleSkins } from "./hero-skins"
import { HeroWorkspaceTabs } from "./hero-workspace-tabs"
import {
  dirtyHeroSections,
  emptyHeroContent,
  heroWorkingConflict,
  heroWorkingSchema,
  mergeHeroWorkingCopy,
  type HeroWorkingCopy,
} from "./hero-working-copy"

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

function PublishingFrame({ rulesetId, ...props }: ComponentProps<typeof Page> & { rulesetId?: string }) {
  return (
    <ReferenceRulesetProvider rulesetId={rulesetId}>
      <Page {...props} />
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
  const [message, setMessage] = useState("")
  const [cause, setCause] = useState<Cause>(translationMode ? "TRANSLATION" : "CONTENT_CORRECTION")
  const [importContext, setImportContext] = useState<ImportContext | null>(null)
  const [resourceId, setResourceId] = useState("")
  const [showResources, setShowResources] = useState(false)
  const requestedFilter: CatalogFilter = {
    seasonId: heroLocationId(urlParams.get("season")),
    variantId: heroLocationId(urlParams.get("patch")),
  }
  const editorRef = useRef<HTMLDivElement>(null)
  const heroHeadingRef = useRef<HTMLHeadingElement>(null)
  const overview = usePublicationOverview()
  const filter = !heroId && overview.data ? resolveHeroCatalogScope(overview.data, requestedFilter) : requestedFilter
  const setFilter = (next: CatalogFilter) =>
    updateLocation(catalogScopePatch(!heroId && overview.data ? resolveHeroCatalogScope(overview.data, next) : next))
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
  const resources = useQuery({
    queryKey: ["publishing-resources"],
    queryFn: async () => {
      const response = await fetch("/__resources/data/heroes.json", { cache: "no-store" })
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
        throw new Error("Resource import requires the Vite resource endpoint.")
      return ((await response.json()) as { heroes: Hero[] }).heroes
    },
    enabled: showResources,
  })
  const resource = resources.data?.find((hero) => hero.id === resourceId)
  const revision = preview?.revision
  const statPatch = statPatchContext(
    overview.data?.variants ?? [],
    revision,
    heroLocationId(urlParams.get("atPatch")) || filter.variantId || null,
    preview?.content,
  )
  const statDefaults = useStatDefaults(statPatch?.id)
  const writable = canWrite && revision?.state === "DRAFT"
  const translating = view === "translations"
  const locale = translating ? targetLocale : location.readLocale
  const focusedProfile = !translating && section === "PROFILE"
  const editorLocale = locale
  const sectionValue = focusedProfile
    ? replaceProfilePart(
        read.data?.content.PROFILE ?? null,
        preview?.content.PROFILE ?? null,
        profilePart,
        editorLocale,
      )
    : preview?.content[section]
  const sectionDirty = focusedProfile ? !sameDraftValue(sectionValue, read.data?.content.PROFILE) : dirty.has(section)
  const editorTitle =
    focusedProfile && profilePart === "lore" ? "Cốt truyện" : SECTIONS.find(([key]) => key === section)![2]
  const heroName =
    translatedText(preview?.content.PROFILE?.translations ?? [], location.readLocale, ["name"])?.name || "Hồ sơ tướng"
  const issues = preview ? publishIssues(preview.content) : []

  useEffect(() => {
    if (requestedRevision === selectedId) return
    setSelectedId(requestedRevision)
    setEditing(false)
    setResourceId("")
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

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await action()
      setMessage(success)
      await invalidateHeroCatalogs(queryClient)
      await queryClient.invalidateQueries({ queryKey: ["hero-comparison", heroId] })
      await revisions.refetch()
    } catch (failure) {
      setError(errorMessage(failure))
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
    setMessage("")
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
    setEditing(false)
    setError("")
  }
  async function refresh() {
    if (!canLeave()) return
    await run(async () => {
      const fresh = await api.read(heroId, selectedId)
      queryClient.setQueryData(["publishing-preview", heroId, selectedId], fresh)
      setEditing(false)
    }, "Đã tải phiên bản mới nhất.")
  }
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
      rulesetId={revision?.rulesetId}
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
          <header>
            {/* Narrow: name and menu on one line, version and the main action on the next. Wide: one line. */}
            <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-2">
              <div className="flex min-w-0 items-center gap-2 @2xl:contents">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
                  {preview && <HeroReviewNotice skills={preview.content.SKILLS?.skills ?? []} />}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Thao tác tướng" className="@2xl:order-last">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => setManagementOpen(true)}>
                      <Settings2 />
                      Quản lý phiên bản
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={busy} onSelect={() => void refresh()}>
                      <RefreshCw />
                      Tải dữ liệu mới nhất
                    </DropdownMenuItem>
                    {writable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={busy || !!dirty.size}
                          onSelect={() => discardDraft()}
                        >
                          <Trash2 />
                          Hủy bản nháp
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex min-w-0 items-center gap-2 @2xl:contents">
                {revision && (revisions.data?.length ?? 0) > 1 ? (
                  <label className="flex min-w-0 flex-1 items-center text-sm @2xl:flex-none">
                    <span className="sr-only">Phiên bản dữ liệu</span>
                    <select
                      aria-label="Phiên bản dữ liệu"
                      className={`${control} @2xl:w-auto @2xl:max-w-60`}
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
                          Bản #{row.revisionNo} · {STATES[row.state]}
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
                    <span className="inline-flex h-9 min-w-0 flex-1 items-center rounded-md border bg-muted/40 px-3 text-sm whitespace-nowrap @2xl:flex-none">
                      Bản #{revision.revisionNo} · {STATES[revision.state]}
                    </span>
                  )
                )}
                {preview && revision && !translating && (
                  <HeroLanguagePicker
                    content={preview.content}
                    locale={location.readLocale}
                    revisionNo={revision.revisionNo}
                    disabled={busy || editing}
                    onChange={setContentLocale}
                  />
                )}
                {headerAction === "publish" && (
                  <Button disabled={busy} onClick={() => setManagementOpen(true)}>
                    <Send className="size-4" />
                    Xuất bản
                  </Button>
                )}
                {headerAction === "draft" && (
                  <Button variant="outline" disabled={busy} onClick={() => setManagementOpen(true)}>
                    <Plus className="size-4" />
                    Tạo bản nháp
                  </Button>
                )}
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
      {error && (
        <div role="alert" className="space-y-1 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          <p>{error}</p>
          <p>Phần đang sửa vẫn được giữ lại. Nếu có xung đột, hủy chỉnh sửa nhóm này rồi tải dữ liệu mới nhất.</p>
        </div>
      )}
      {message && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          {message}
        </p>
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
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                {/* The version is in the header; only what it does not say stays here. */}
                <span>
                  {[
                    (rulesets.data?.length ?? 0) > 1
                      ? (rulesets.data?.find((row) => row.id === revision.rulesetId)?.code ?? "Bộ quy tắc khác")
                      : "",
                    dirty.size ? `${dirty.size} nhóm chưa lưu` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {writable && <DraftStatus draft={localDraft} disabled={busy} />}
              {revision.state !== "DRAFT" && (editing || translating) && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
                  <p>Đang xem bản chỉ đọc. Tạo bản nháp để chỉnh sửa hoặc thêm bản dịch.</p>
                  {canWrite && (
                    <Button variant="outline" onClick={() => setManagementOpen(true)}>
                      Tạo bản nháp
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
                      setMessage("")
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
                    {!translating && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
                          <ArrowLeft className="size-4" />
                          Xem hồ sơ
                        </Button>
                        <Badge variant="outline">Chỉnh sửa bản nháp</Badge>
                      </div>
                    )}
                    {translating && (
                      <fieldset
                        disabled={busy}
                        className="grid gap-4 rounded-xl border bg-card p-4 @min-[600px]:grid-cols-2"
                      >
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
                    <Box title={editorTitle}>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
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
                        <fieldset
                          disabled={
                            !writable ||
                            busy ||
                            !localDraft.ready ||
                            localDraft.invalid ||
                            localDraft.conflict ||
                            read.isFetching ||
                            (translating && sourceLocale === locale)
                          }
                          className="space-y-5"
                        >
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
                              resource={resource}
                              heroId={heroId}
                              initialSkillKey={heroLocationId(urlParams.get("skill"))}
                              onBusyChange={setBusy}
                            />
                          )}
                          <Field label="Ghi chú thay đổi" value={note} onChange={setNote} />
                          {writable && (
                            <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6">
                              <p className="text-xs text-muted-foreground">
                                {sectionDirty ? "Có thay đổi chưa lưu" : "Chưa có thay đổi trong phần này"}
                              </p>
                              <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={cancelSection}>
                                  <X className="size-4" />
                                  <span className="hidden sm:inline">Hủy chỉnh sửa phần này</span>
                                  <span className="sm:hidden">Hủy</span>
                                </Button>
                                <Button disabled={!sectionDirty}>
                                  <Save className="size-4" />
                                  {busy ? "Đang lưu…" : "Lưu phần này"}
                                </Button>
                              </div>
                            </div>
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
                    {/* The header's publish button opens this sheet, so the publish checks lead. */}
                    {revision.state === "DRAFT" && (
                      <Box title="Kiểm tra trước khi xuất bản">
                        {issues.length ? (
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {issues.map((issue) => (
                              <li key={issue} className="flex gap-2">
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                                {issue}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            Đã đủ nội dung chính. Hệ thống sẽ kiểm tra dữ liệu và ảnh khi xuất bản.
                          </p>
                        )}
                        {dirty.size > 0 && (
                          <p className="text-sm text-amber-600">
                            Lưu {dirty.size} nhóm đang chỉnh sửa trước khi xuất bản.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3">
                          {revision.state === "DRAFT" && canPublish && (
                            <Button
                              disabled={busy || !!dirty.size || !!issues.length}
                              onClick={() =>
                                void run(async () => {
                                  const published = await api.publish(revision, note)
                                  await localDraft.discard()
                                  await openRevision(published)
                                }, "Đã xuất bản phiên bản tướng.")
                              }
                            >
                              Xuất bản tướng
                            </Button>
                          )}
                        </div>
                      </Box>
                    )}
                    {revision.state === "PUBLISHED" && canWrite && (
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
                                locale={locale}
                                onLocaleChange={translating ? setTargetLocale : setContentLocale}
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
                    {revision.cause === "DATA_BASELINE" && (
                      <p className="rounded-xl border bg-card p-4 text-sm leading-6 text-muted-foreground">
                        Đây là mốc dữ liệu đã thu thập. Khi chưa có bản trước để đối chiếu, lịch sử không thể kết luận
                        tướng đã thay đổi gì ở patch này. Bạn có thể bổ sung mốc cũ rồi so sánh sau.
                      </p>
                    )}
                    {writable && revision.cause === "DATA_BASELINE" && !revision.sourceRevisionId && (
                      <BaselineContextForm
                        revision={revision}
                        disabled={busy || !!dirty.size}
                        onBusyChange={setBusy}
                        onMove={async (next) => {
                          await openRevision(next)
                          await invalidateHeroCatalogs(queryClient)
                          await queryClient.invalidateQueries({ queryKey: ["hero-comparison", heroId] })
                          await revisions.refetch()
                          setMessage("Đã chuyển mốc ban đầu, giữ nguyên nội dung và ảnh.")
                        }}
                      />
                    )}
                    {revision.state === "PUBLISHED" &&
                      revision.cause === "GAME_PATCH" &&
                      revision.effectiveFromPatchVariantId &&
                      capabilities.includes("patch:write") && (
                        <PatchChangeForm key={revision.id} revision={revision} locale={locale} />
                      )}
                    {writable && !translating && (
                      <details className="rounded-xl border bg-card p-4">
                        <summary className="cursor-pointer text-sm font-medium">
                          Điền dữ liệu từ tài nguyên tham khảo
                        </summary>
                        <div className="mt-4 space-y-4">
                          <Button variant="outline" onClick={() => setShowResources(!showResources)}>
                            {showResources ? "Đóng danh mục" : "Mở danh mục resources"}
                          </Button>
                          {showResources && (
                            <>
                              {resources.isError && <p role="alert">{errorMessage(resources.error)}</p>}
                              <label className="grid gap-2 text-sm">
                                Tướng nguồn
                                <select
                                  className={control}
                                  value={resourceId}
                                  onChange={(event) => setResourceId(event.target.value)}
                                >
                                  <option value="">Chọn tướng để đối chiếu</option>
                                  {resources.data?.map((hero) => (
                                    <option value={hero.id} key={hero.id}>
                                      {hero.name} · {hero.id}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {resource && (
                                <>
                                  <p className="text-sm text-muted-foreground">
                                    Điền tên, kỹ năng và trang phục vào bản đang sửa. Dữ liệu còn thiếu có thể bổ sung
                                    sau trong bản nháp.
                                  </p>
                                  <Button
                                    disabled={busy || !!dirty.size}
                                    onClick={() => {
                                      localDraft.update({
                                        ...localDraft.value,
                                        content: { ...preview.content, ...resourceContent(resource, locale) },
                                      })
                                      updateLocation({ view: "overview" })
                                      setEditing(true)
                                      setManagementOpen(false)
                                    }}
                                  >
                                    Điền vào bản nháp
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </details>
                    )}
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Mã định danh hệ thống</summary>
                      <dl className="mt-3 space-y-2 break-all font-mono">
                        <div>
                          <dt>Tướng</dt>
                          <dd>{heroId}</dd>
                        </div>
                        <div>
                          <dt>Phiên bản</dt>
                          <dd>{revision.id}</dd>
                        </div>
                      </dl>
                    </details>
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
