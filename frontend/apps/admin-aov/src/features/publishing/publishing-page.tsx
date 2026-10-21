import { HeroTimeline } from "./hero-timeline"
import { useEffect, useRef, useState, type ComponentProps } from "react"
import { Link, useBeforeUnload, useNavigate, useParams } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileUp,
  GitCompareArrows,
  Languages,
  MoreHorizontal,
  Plus,
  Save,
  Settings2,
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
import { Page, PageHeader } from "@/components/page-header"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { usePageCloseGuard } from "@/app/layout/page-tabs"
import { errorMessage } from "@/lib/api/errors"
import type { Hero } from "@/lib/api/types"
import { languageOptions } from "../users/profile-preference-picker"
import { createPublishingApi, heroPreviewKey } from "./publishing-api"
import { invalidateHeroCatalogs } from "./publishing-cache"
import { BaselineContextForm } from "./baseline-context-form"
import { HeroAsset, HeroContent, localized } from "./hero-content"
import { HeroScrollIdentity } from "./hero-scroll-identity"
import { HeroQuickSwitcher } from "./hero-quick-switcher"
import { selectCatalogRevisions } from "./catalog-data"
import { HeroCatalog } from "./hero-catalog"
import { HeroRevisionHistory } from "./hero-revision-history"
import { HeroTranslationStatus } from "./hero-translation-status"
import { TranslationEditor, type TranslatableSection } from "./translation-editor"
import { DataLanguage } from "./data-language"
import { Box, Field, control } from "./fields"
import { PatchChangeForm } from "./patch-change-form"
import { SectionEditor, emptySection } from "./section-editor"
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

export function PublishingPage({ translationMode = false }: { translationMode?: boolean }) {
  const { heroId = "" } = useParams()
  return <PublishingWorkspace key={`${heroId}:${translationMode}`} heroId={heroId} translationMode={translationMode} />
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
  const [managementOpen, setManagementOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [cause, setCause] = useState<Cause>(translationMode ? "TRANSLATION" : "CONTENT_CORRECTION")
  const [importContext, setImportContext] = useState<ImportContext | null>(null)
  const [resourceId, setResourceId] = useState("")
  const [showResources, setShowResources] = useState(false)
  const filter: CatalogFilter = {
    seasonId: heroLocationId(urlParams.get("season")),
    variantId: heroLocationId(urlParams.get("patch")),
  }
  const setFilter = (next: CatalogFilter) => updateLocation({ season: next.seasonId, patch: next.variantId })
  const editorRef = useRef<HTMLDivElement>(null)
  const managementRef = useRef<HTMLDivElement>(null)
  const heroHeadingRef = useRef<HTMLHeadingElement>(null)
  const overview = usePublicationOverview()
  const displayLocale = useContentLocale()
  const location = readHeroLocation(urlParams, translationMode, displayLocale)
  const { view, section, targetLocale, sourceLocale } = location
  const setSection = (value: Section) => updateLocation({ section: value })
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
  const note = localDraft.value.notes[section] ?? ""
  const setNote = (value: string) => {
    const notes = { ...localDraft.value.notes }
    if (value) notes[section] = value
    else delete notes[section]
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
  const writable = canWrite && revision?.state === "DRAFT"
  const translating = view === "translations"
  const locale = translating ? targetLocale : location.readLocale
  const heroName = localized(preview?.content.PROFILE?.translations, displayLocale)?.name || "Hồ sơ tướng"
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
  useEffect(() => {
    if (managementOpen) managementRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" })
  }, [managementOpen])
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
    delete notes[section]
    localDraft.update({
      content: { ...localDraft.value.content, [section]: structuredClone(read.data?.content[section]) },
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
          actions={
            canWrite ? (
              <>
                <Button variant="outline" asChild>
                  <Link to="/hero/import">
                    <FileUp className="size-4" />
                    Import
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/hero/new">
                    <Plus className="size-4" />
                    Tạo tướng
                  </Link>
                </Button>
              </>
            ) : undefined
          }
        />
      ) : (
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
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
                <p className="text-[11px] text-muted-foreground">
                  {revision ? CAUSES[revision.cause] : "Đang mở dữ liệu"}
                </p>
              </div>
              {quickSwitcher}
              {revision && (
                <Badge variant={revision.state === "DRAFT" ? "secondary" : "outline"}>{STATES[revision.state]}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {revision && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">Phiên bản dữ liệu</span>
                  <select
                    aria-label="Phiên bản dữ liệu"
                    className={`${control} max-w-60`}
                    value={selectedId}
                    disabled={busy}
                    onChange={(event) => {
                      setSelectedId(event.target.value)
                      updateLocation({ revision: event.target.value, compare: null, changes: null })
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
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Thao tác tướng">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setManagementOpen(true)}>
                    <Settings2 />
                    Quản lý phiên bản & xuất bản
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={busy} onSelect={() => void refresh()}>
                    Tải dữ liệu mới nhất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Không gian quản lý tướng">
            {(
              [
                ["overview", BookOpen, "Thông tin tướng"],
                ["translations", Languages, "Bản dịch"],
                ["history", GitCompareArrows, "Lịch sử & so sánh"],
              ] as const
            ).map(([key, Icon, label]) => (
              <Button
                key={key}
                role="tab"
                aria-selected={view === key}
                aria-controls={`workspace-${key}`}
                disabled={busy}
                variant="ghost"
                className={`shrink-0 rounded-b-none border-b-2 ${view === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                onClick={() => switchView(key)}
              >
                <Icon className="size-4" />
                {label}
              </Button>
            ))}
          </div>
        </header>
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
          <HeroCatalog ruleset="" locale={displayLocale} overview={overview.data} filter={filter} />
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
                <span>
                  {rulesets.data?.find((row) => row.id === revision.rulesetId)?.code || "Bộ quy tắc gameplay"} · Bản #
                  {revision.revisionNo}
                  {dirty.size ? ` · ${dirty.size} nhóm chưa lưu` : ""}
                </span>
                {!translating && !editing && (
                  <label className="flex items-center gap-2">
                    <Languages className="size-3.5" />
                    <span className="sr-only">Ngôn ngữ hiển thị nội dung</span>
                    <select
                      aria-label="Ngôn ngữ hiển thị nội dung"
                      className="max-w-44 rounded-md border bg-background px-2 py-1.5 text-xs"
                      value={locale}
                      disabled={busy}
                      onChange={(event) => setContentLocale(event.target.value)}
                    >
                      {languageOptions.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
                    onEdit={(next) => {
                      setSection(next)
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
                        <label className="grid gap-2 text-sm">
                          <span className="flex items-center gap-2">
                            <BookOpen className="size-4 text-muted-foreground" />
                            Ngôn ngữ nguồn
                          </span>
                          <select
                            aria-label="Ngôn ngữ nguồn"
                            className={control}
                            value={sourceLocale}
                            onChange={(event) => setSourceLocale(event.target.value)}
                          >
                            {languageOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <DataLanguage value={targetLocale} onChange={setTargetLocale} />
                        {sourceLocale === locale && (
                          <p role="status" className="text-sm text-amber-600 @min-[600px]:col-span-2">
                            Chọn ngôn ngữ đích khác nguồn để bắt đầu biên dịch.
                          </p>
                        )}
                      </fieldset>
                    )}
                    <div className="flex gap-1 overflow-x-auto" aria-label="Các phần nội dung">
                      {SECTIONS.filter(([key]) => !translating || ["PROFILE", "SKILLS", "SKINS"].includes(key)).map(
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
                    <Box title={SECTIONS.find((row) => row[0] === section)![2]}>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          void run(async () => {
                            const value = preview.content[section] ?? emptySection(section, locale)
                            const next = await api.save(revision, section, value, note)
                            const saved = await api.read(heroId, revision.id)
                            queryClient.setQueryData(["publishing-preview", heroId, revision.id], saved)
                            const notes = { ...localDraft.value.notes }
                            delete notes[section]
                            localDraft.rebase(
                              { content: { ...preview.content, [section]: saved.content[section] }, notes },
                              { content: saved.content, notes: {} },
                              next.version,
                            )
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
                            />
                          ) : (
                            <SectionEditor
                              section={section}
                              value={preview.content[section]}
                              locale={locale}
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
                                {dirty.has(section) ? "Có thay đổi chưa lưu" : "Chưa có thay đổi trong nhóm này"}
                              </p>
                              <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={cancelSection}>
                                  <X className="size-4" />
                                  <span className="hidden sm:inline">Hủy chỉnh sửa nhóm này</span>
                                  <span className="sm:hidden">Hủy</span>
                                </Button>
                                <Button disabled={!dirty.has(section)}>
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
              {managementOpen && (
                <section
                  ref={managementRef}
                  className="scroll-mt-16 space-y-5 rounded-2xl border bg-muted/10 p-4 @min-[650px]:p-6"
                  aria-label="Quản lý phiên bản"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Quản lý phiên bản</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Bản #{revision.revisionNo} · {STATES[revision.state]} · {CAUSES[revision.cause]}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Đóng quản lý phiên bản"
                      onClick={() => setManagementOpen(false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
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
                      <p className="text-sm text-amber-600">Lưu {dirty.size} nhóm đang chỉnh sửa trước khi xuất bản.</p>
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
                      {writable && (
                        <Button
                          variant="outline"
                          disabled={busy || !!dirty.size}
                          onClick={() => {
                            if (window.confirm("Hủy bản nháp này? Bản đã xuất bản vẫn được giữ lại."))
                              void run(async () => {
                                const discarded = await api.discard(revision)
                                await localDraft.discard()
                                await openRevision(discarded)
                              }, "Đã hủy bản nháp.")
                          }}
                        >
                          Hủy bản nháp
                        </Button>
                      )}
                    </div>
                  </Box>
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
                                  Điền tên, kỹ năng và trang phục vào bản đang sửa. Dữ liệu còn thiếu có thể bổ sung sau
                                  trong bản nháp.
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
                </section>
              )}
            </>
          )}
        </>
      )}
    </PublishingFrame>
  )
}
