import { catalogScopePatch, resolveCatalogScope } from "../model/catalog/catalog-scope"
import { useCatalogScopePreference } from "../components/catalog/catalog-scope-memory"
import { HeroTimeline } from "../components/hero-timeline"
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react"
import { revisionSkillReferences } from "../model/skills/revision-skill-references"
import { useHeroSkillImages } from "../components/skills/skill-artwork"
import { Link, Navigate, useBeforeUnload, useLocation, useNavigate, useParams } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, FileUp, Layers, MoreHorizontal, Plus, Save, Trash2, X, ChevronDown } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { replacingPageTab, usePageCloseGuard } from "@/app/layout/page-tabs"
import { errorMessage, isApiError } from "@/lib/api/errors"

import { createPublishingApi, heroPreviewKey } from "../api/publishing-api"
import { invalidateHeroCatalogs } from "../api/publishing-cache"
import { BaselineContextForm } from "../components/import/baseline-context-form"
import { DraftPencil, type NewDraft } from "../../warehouse/components/warehouse-sheet"
import { HeroContent } from "../components/hero-content"
import { HeroAsset } from "@/features/publishing/components/hero-asset"
import { HeroScrollIdentity } from "../components/hero-scroll-identity"
import { HeroQuickSwitcher } from "../components/catalog/hero-quick-switcher"
import { HeroFormSwitcher, HeroFormsDialog, useHeroForms } from "../components/hero-forms"
import { defaultFormOf, formsOwnerOf } from "../model/hero-forms-model"
import { HeroSharedPart } from "../components/hero-shared-part"
import { selectCatalogRevisions } from "../model/catalog/catalog-data"
import { HeroCatalog } from "../components/catalog/hero-catalog"
import { HeroRevisionHistory } from "../components/hero-revision-history"
import { HeroPatchTimeline } from "../components/patch-changes/hero-patch-view"

import { HeroLanguagePicker } from "../components/hero-language-picker"
import { cn } from "@aov/ui/lib/utils"
import { HeroReviewNotice } from "../components/hero-review-notice"
import { reviewTab, type HeroReviewItem } from "../model/import/hero-source-review"
import {
  missingTranslationFields,
  translatedText,
  translationFields,
  type TranslationField,
  type TranslationTarget,
} from "../model/hero-translation-model"
import { TranslationEditor } from "../components/translation-editor"
import { type TranslatableSection } from "@/features/publishing/model/hero-translation-model"
import { Box } from "../components/fields"
import { languageOptions } from "../../users/profile-preference-picker"
import { PatchChangeForm } from "../components/patch-changes/patch-change-form"
import { SectionEditor, emptySection } from "../components/section-editor"
import { statPatchContext } from "../model/assessment/combat-attributes"
import { useStatDefaults } from "../components/setup/patch-stat-defaults"
import { replaceProfilePart, type ProfileEditorPart } from "../components/hero-profile-editor"

import { type CatalogFilter } from "../components/catalog/catalog-context"
import { usePublicationOverview, useContentLocale } from "../api/publication-overview"
import { publicationPatchLink, publishBlockers, usesObservedStats } from "../model/publish-rules"
import {
  SECTIONS,
  type Cause,
  type Content,
  type HeroRow,
  type Preview,
  type Revision,
  type Section,
  type Skill,
} from "../api/types"
import {
  heroLocationId,
  heroPageLocation,
  readHeroLocation,
  switchHeroLocation,
  type HeroContentTab,
  type HeroWorkspaceView,
} from "../model/hero-location"
import { useHeroLocation } from "../components/use-hero-location"
import { HeroNavigationGuard } from "../components/hero-navigation-guard"
import { useLocalDraft } from "@/app/drafts/use-local-draft"
import { DraftStatusControl } from "@/app/drafts/draft-status"
import { HeroDraftChanges, savedHeroSections } from "../components/patch-changes/hero-draft-changes"
import { PublishButton } from "../components/publish-button"
import { ReferenceRulesetProvider } from "../../terminology/catalog"
import { HeroWorkspaceTabs } from "../components/hero-workspace-tabs"
import { captureFocus, type CaptureTarget } from "../model/captures/patch-capture-model"
import { PatchCapturePanel, PatchCaptureToggle } from "../components/captures/patch-capture-panel"
import { PatchCaptureProvider, usePatchCaptureWorkspace, type PatchCaptureWorkspace } from "../api/use-patch-captures"
import {
  dirtyHeroSections,
  emptyHeroContent,
  heroWorkingConflict,
  type HeroWorkingCopy,
  heroWorkingSchema,
  mergeHeroWorkingCopy,
  sameHeroSection,
} from "../model/hero-working-copy"
import { toast } from "sonner"
import { confirmAction } from "@/components/confirm-dialog"
import { CAUSE_NAMES } from "../model/setup/version-causes"
import { VersionFacts } from "../components/setup/version-facts"
import { HeroVersionMenu, REVISION_STATES as STATES } from "../components/hero-version-menu"

const api = createPublishingApi(backendRequest)
const CAUSES: Record<Cause, string> = CAUSE_NAMES
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

/** Whether a box is at least `minimum` pixels wide. An unmeasured box counts as wide, so tests and first paint get the full header. */
function useWideBox(ref: RefObject<HTMLElement | null>, minimum: number) {
  const [wide, setWide] = useState(true)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const width = element.getBoundingClientRect().width
      if (width > 0) setWide(width >= minimum)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, minimum])
  return wide
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
  onClose,
}: {
  heroId: string
  revisionId?: string
  onUnsavedChange?: (unsafe: boolean, busy?: boolean) => void
  translationMode?: boolean
  /** In the drawer: closes it from the header, after the drawer's own guard for unsaved work. */
  onClose?: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("hero:write")
  const canPublish = capabilities.includes("hero:publish")
  const { params: urlParams, update: updateLocation } = useHeroLocation()
  const requestedRevision = revisionId ?? heroLocationId(urlParams.get("revision"))
  const [selectedId, setSelectedId] = useState(requestedRevision)
  const [editing, setEditing] = useState(false)
  const [profilePart, setProfilePart] = useState<ProfileEditorPart>("information")
  // The skin whose own pencil opened the skin editor; the section pencil opens all of them.
  const [skinFocus, setSkinFocus] = useState<string | null>(null)
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [reviewTarget, setReviewTarget] = useState<HeroReviewItem | null>(null)
  // What the capture panel last led the page to, while the page stays on that tab.
  const [capturePin, setCapturePin] = useState<{ tab: HeroContentTab; group: string } | null>(null)
  const [contentReveal, setContentReveal] = useState<{ section: Section; at: number } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [publishFailure, setPublishFailure] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [formsOpen, setFormsOpen] = useState(false)
  const [openedWithoutRevision] = useState(!requestedRevision)
  const heroForms = useHeroForms(heroId || undefined)
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
  // The capture panel can lead the page: picking a group or a part of a screenshot opens what it is the source of.
  const followCapture = (target: CaptureTarget) => {
    if (editing || view !== "overview") return
    setCapturePin(target.tab === "overview" ? { tab: target.tab, group: target.group } : null)
    updateLocation({
      tab: target.tab === "overview" ? null : target.tab,
      ...(target.skill ? { skill: target.skill } : {}),
      ...(target.skin ? { skin: target.skin } : {}),
    })
    setContentReveal(target.section ? { section: target.section, at: Date.now() } : null)
  }
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
      pinned: capturePin?.tab === location.tab ? capturePin.group : undefined,
    }),
    onNavigate: followCapture,
  })
  // Comparing two versions opens on request, or straight away when a link asks for a comparison.
  const [comparing, setComparing] = useState(() => !!urlParams.get("compare"))
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
        holdsForms: !!heroId && heroForms.data?.holder?.id === heroId,
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
  // The content page brings the edited section into view; outside it the editor stands alone and is scrolled to.
  useEffect(() => {
    if (!editing) return
    editorRef.current?.focus({ preventScroll: true })
    if (view !== "overview") editorRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" })
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
    // A hero that holds forms opens on its default form; its shared part is edited from there.
    if (next.formIds?.length) return switchForm(next.formIds[0])
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
  /** Opens another form of the same hero; each form is a hero of its own, so its newest revision opens (ADR-024). */
  function switchForm(nextId: string, replace = false) {
    if (busy || nextId === heroId) return
    const params = switchHeroLocation(urlParams, nextId)
    params.delete("revision")
    if (onUnsavedChange) void navigate({ search: `?${params}` }, { preventScrollReset: true, replace })
    else
      void navigate(heroPageLocation(nextId, params), {
        preventScrollReset: true,
        replace,
        state: replace ? replacingPageTab(pathname) : undefined,
      })
  }
  // Opening the hero that holds forms lands on its default form, as the Wiki does. A link to one of its revisions, such
  // as the shared part's own page or a row of the readiness overview, still opens it.
  const defaultForm = defaultFormOf(heroForms.data, heroId)
  useEffect(() => {
    if (openedWithoutRevision && defaultForm) switchForm(defaultForm, true)
  }, [openedWithoutRevision, defaultForm])
  const formHolder = heroForms.data?.formKey ? heroForms.data.holder : null
  const formsOwner = formsOwnerOf(heroForms.data)
  const formSwitcher = heroId ? (
    <HeroFormSwitcher heroId={heroId} locale={displayLocale} disabled={busy || !preview} onSelect={switchForm} />
  ) : null
  const sharedPart = formHolder ? (
    <HeroSharedPart
      holder={formHolder}
      locale={location.readLocale}
      canWrite={canWrite}
      canPublish={canPublish}
      disabled={busy}
    />
  ) : null
  const quickSwitcher = heroId ? (
    <HeroQuickSwitcher
      heroId={heroId}
      locale={displayLocale}
      rulesetId={revision?.rulesetId}
      disabled={busy || !preview}
      onSelect={switchHero}
      compact
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
  // A language's pencil opens translating into it, read beside another language the hero has.
  function translateInto(target: string) {
    if (busy) return
    updateLocation({
      view: "translations",
      target,
      source: sourceLocale === target ? languageOptions.find((option) => option.value !== target)!.value : sourceLocale,
      ...(!["PROFILE", "SKILLS", "SKINS"].includes(section) ? { section: "PROFILE" } : {}),
      translationKey: null,
      translationField: null,
    })
    setEditing(false)
    setError("")
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
  function openManagement() {
    setError("")
    switchView("history")
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
  // A hero without the account's language opens in English before Vietnamese.
  const profileLocales = read.data?.content.PROFILE?.translations.map((text) => text.locale)
  useEffect(() => {
    if (!profileLocales || urlParams.get("readLocale") || profileLocales.includes(location.readLocale)) return
    const fallback = ["en-US", "vi-VN"].find((code) => profileLocales.includes(code)) ?? profileLocales[0]
    if (fallback) updateLocation({ readLocale: fallback })
  }, [profileLocales?.join(","), location.readLocale])
  // One ruleset holds one draft, so a second one can only fail: offer the one that exists instead.
  const openDraft = revisions.data?.find((row) => row.state === "DRAFT" && row.rulesetId === revision?.rulesetId)
  const startDraftLabel = openDraft ? `Mở bản nháp #${openDraft.revisionNo}` : "Tạo bản nháp"
  function startDraft() {
    if (!openDraft) return forkDraft({ cause: translating ? "TRANSLATION" : "CONTENT_CORRECTION" })
    setSelectedId(openDraft.id)
    updateLocation({ revision: openDraft.id, compare: null, changes: null })
    setEditing(false)
  }
  function forkDraft(request: NewDraft) {
    if (!revision) return
    void run(async () => {
      await openRevision(await api.fork(revision, request.cause as Cause, request.patchVariantId ?? null))
      updateLocation({ view: request.cause === "TRANSLATION" ? "translations" : "overview" })
    }, "Đã tạo bản nháp từ phiên bản đang xem.")
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
  async function discardDraft() {
    if (!revision) return
    const confirmed = await confirmAction({
      title: "Hủy bản nháp này?",
      description: "Bản đã xuất bản vẫn được giữ lại.",
      confirmLabel: "Hủy bản nháp",
      cancelLabel: "Giữ bản nháp",
    })
    if (!confirmed) return

    void run(async () => {
      const discarded = await api.discard(revision)
      await localDraft.discard()
      await openRevision(discarded)
    }, "Đã hủy bản nháp.")
  }

  const headerRef = useRef<HTMLElement>(null)
  const wideHeader = useWideBox(headerRef, 672)
  const [publishOpen, setPublishOpen] = useState(false)
  const unsavedSections = SECTIONS.filter(([key]) => dirty.has(key)).map(([key, , label]) => ({ key, label }))
  const chooseRevision = (next: string) => {
    setSelectedId(next)
    updateLocation({ revision: next, compare: null, changes: null, translationKey: null, translationField: null })
    setEditing(false)
  }
  const publishButton = (triggerClassName?: string) =>
    revision && (
      <PublishButton
        busy={busy}
        publishing={publishing}
        issues={issues}
        unsaved={unsavedSections}
        patch={patchLink && { ...patchLink, canPublish: capabilities.includes("patch:publish") }}
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
        open={triggerClassName ? publishOpen : undefined}
        onOpenChange={triggerClassName ? setPublishOpen : undefined}
        triggerClassName={triggerClassName}
      />
    )
  // The version as "#n"; on a narrow header its menu also holds the reading language and the main action.
  const versionMenu = (narrow: boolean) =>
    revision && (
      <HeroVersionMenu
        revision={revision}
        revisions={revisions.data}
        rulesets={rulesets.data}
        selectedId={selectedId}
        busy={busy}
        narrow={narrow}
        onChoose={chooseRevision}
        language={
          narrow && preview && !translating
            ? {
                content: preview.content,
                locale: location.readLocale,
                disabled: busy || (editing && section !== "SKILLS"),
                onChange: setContentLocale,
              }
            : undefined
        }
        publish={
          narrow && headerAction === "publish"
            ? {
                publishing,
                onSelect: () => {
                  // Gaps open the same list the header button shows; with none, the click publishes.
                  if (issues.length || unsavedSections.length) setTimeout(() => setPublishOpen(true))
                  else publishRevision()
                },
              }
            : undefined
        }
      />
    )
  // The single pencil on a published version: it opens the draft in progress or starts one of the chosen kind.
  const draftPencil = revision && (
    <DraftPencil
      name="tướng"
      rulesetId={revision.rulesetId}
      basePatchVariantId={revision.effectiveFromPatchVariantId}
      openDraft={openDraft ? { revisionNo: openDraft.revisionNo, onOpen: startDraft } : undefined}
      onCreate={canFork ? forkDraft : undefined}
      extraKinds={[
        { cause: "VISUAL_UPDATE", title: CAUSES.VISUAL_UPDATE, note: "Đổi ảnh, giữ nguyên nội dung." },
        { cause: "IMPORT_CORRECTION", title: CAUSES.IMPORT_CORRECTION, note: "Sửa chỗ nhập sai từ nguồn." },
        { cause: "OTHER", title: CAUSES.OTHER, note: "Thay đổi không thuộc các loại trên." },
      ]}
      disabled={busy || !!dirty.size}
    />
  )
  // The drawer closes like every other sheet: a quiet × at the end of the header row, past a divider.
  const closeButton = onClose && (
    <>
      <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        title="Đóng trang tướng"
        aria-label="Đóng trang tướng"
        disabled={busy}
        onClick={onClose}
      >
        <X />
      </Button>
    </>
  )
  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Thao tác tướng" className="shrink-0 bg-background">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {canPublish && heroId && formsOwner && (
          <DropdownMenuItem disabled={busy} onSelect={() => setFormsOpen(true)}>
            <Layers />
            Dạng của tướng
          </DropdownMenuItem>
        )}
        {writable && (
          <DropdownMenuItem variant="destructive" disabled={busy} onSelect={() => void discardDraft()}>
            <Trash2 />
            Hủy bản nháp
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // One editor at a time. On the content page it takes the place of the section it changes; translations keep it in
  // their own view.
  const editorPanel =
    preview && revision && (editing || translating) ? (
      <div
        ref={editorRef}
        tabIndex={-1}
        className="scroll-mt-16 space-y-4 outline-none"
        role="region"
        aria-label="Chỉnh sửa nội dung"
      >
        {translating && (
          <fieldset disabled={busy} className="grid gap-4 admin-section py-4">
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
              <p role="status" className="text-sm text-(--aov-warning) @min-[600px]:col-span-2">
                Chọn ngôn ngữ đích khác nguồn để bắt đầu biên dịch.
              </p>
            )}
          </fieldset>
        )}
        {translating && (
          <div className="flex gap-1 overflow-x-auto" aria-label="Các phần nội dung">
            {SECTIONS.filter(([key]) => ["PROFILE", "SKILLS", "SKINS"].includes(key)).map(([key, , label]) => (
              <Button
                key={key}
                type="button"
                disabled={busy}
                className="shrink-0"
                variant={section === key ? "secondary" : "ghost"}
                onClick={() => setSection(key)}
              >
                {label}
                {dirty.has(key) && <span className="size-1.5 rounded-full bg-(--aov-warning)" aria-label="Chưa lưu" />}
              </Button>
            ))}
          </div>
        )}
        <Box title={editorTitle} unframed={!translating}>
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
                    ? replaceProfilePart(preview.content.PROFILE, saved.content.PROFILE, profilePart, editorLocale)
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
                  sharedTitle={!!formHolder}
                  savedSkillKeys={new Set(read.data?.content.SKILLS?.skills.map((skill) => skill.skillKey) ?? [])}
                  savedSkinKeys={new Set(read.data?.content.SKINS?.skins.map((skin) => skin.skinKey) ?? [])}
                  focusSkinKey={skinFocus}
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
                  onSkillLayoutChange={(layout) => updateLocation({ skillLayout: layout === "flat" ? "flat" : null })}
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
    ) : null

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
      {heroId && view !== "overview" && (
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
              <PageActionsMenu label="Tạo và nhập tướng">
                <DropdownMenuItem asChild>
                  <Link to="/hero/new">
                    <Plus />
                    Tạo tướng
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/hero/import">
                    <FileUp />
                    Nhập tướng
                  </Link>
                </DropdownMenuItem>
              </PageActionsMenu>
            ) : undefined
          }
        />
      ) : (
        // The header and the tab row stay at the top together while the page scrolls, as a sheet's do.
        <div className="sticky top-0 z-20 -mx-1 bg-background px-1 pt-1 [overflow-anchor:none]">
          <header ref={headerRef} className="relative">
            {/* The name and the controls wrap as two whole groups, so no button can end up alone on a line. */}
            <div
              className={
                wideHeader
                  ? "flex flex-wrap items-center justify-end gap-x-4 gap-y-3"
                  : "flex min-w-0 items-center gap-1.5"
              }
            >
              <div className={cn("flex min-w-0 items-center gap-2.5", wideHeader ? "flex-auto" : "flex-1 gap-2")}>
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
                {/* A narrow header gives the name the room; the scrolled name bar still shows the picture. */}
                {wideHeader && (
                  <HeroAsset
                    id={preview?.content.MEDIA_BINDINGS?.bindings.HEAD}
                    alt={`Ảnh tướng ${heroName}`}
                    className="size-9 shrink-0 rounded-full"
                    frameAspectRatio={1}
                  />
                )}
                <div className="min-w-0">
                  {/* Switching hero belongs to the name, so its button follows it on the same line. */}
                  <div className="flex min-w-0 items-center gap-1">
                    <h1 ref={heroHeadingRef} className="truncate text-base font-semibold">
                      {heroName}
                    </h1>
                    {quickSwitcher}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {revision ? CAUSES[revision.cause] : "Đang mở dữ liệu"}
                  </p>
                </div>
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
              {wideHeader ? (
                <div className="flex min-w-0 shrink-0 items-center gap-2">
                  {versionMenu(false)}
                  {preview && revision && !translating && (
                    <HeroLanguagePicker
                      content={preview.content}
                      locale={location.readLocale}
                      revisionNo={revision.revisionNo}
                      disabled={busy}
                      languagesDisabled={editing && section !== "SKILLS"}
                      onChange={setContentLocale}
                      onTranslate={translateInto}
                    />
                  )}
                  {headerAction === "publish" && revision && publishButton()}
                  {headerAction === "draft" && draftPencil}
                  {actionsMenu}
                  {closeButton}
                </div>
              ) : (
                // One row on a narrow header: the version menu also holds the language and the main action.
                <div className="relative flex shrink-0 items-center gap-1.5">
                  {versionMenu(true)}
                  {headerAction === "draft" && draftPencil}
                  {headerAction === "publish" && revision && publishButton("sr-only")}
                  {actionsMenu}
                  {closeButton}
                </div>
              )}
            </div>
            {(formSwitcher || sharedPart) && (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                {formSwitcher}
                {sharedPart}
              </div>
            )}
            {formsOwner && canPublish && (
              <HeroFormsDialog hero={formsOwner} open={formsOpen} onOpenChange={setFormsOpen} />
            )}
          </header>
          {/* The content is one page now, so only the content and history tabs remain. */}
          <HeroWorkspaceTabs view={view} busy={busy} onView={switchView} sticky={false} />
        </div>
      )}
      {[rulesets.error, regions.error, revisions.error, read.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {errorMessage(failure)}
        </p>
      ))}
      {error && (
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
                {view === "overview" && (
                  <HeroContent
                    revision={revision}
                    sharedTitle={!!formHolder}
                    editing={editing && editorPanel ? { section, title: editorTitle, node: editorPanel } : null}
                    variantId={statPatch?.id}
                    statDefaults={statDefaults.data}
                    referenceError={statDefaults.isError}
                    patchCode={statPatch?.patchCode}
                    reviewTarget={reviewTarget}
                    onReviewShown={() => setReviewTarget(null)}
                    reveal={contentReveal}
                    content={preview.content}
                    locale={locale}
                    editable={!!writable}
                    busy={busy}
                    heroId={heroId}
                    selectedSkillKey={heroLocationId(urlParams.get("skill"))}
                    skillLayout={urlParams.get("skillLayout") === "flat" ? "flat" : "focus"}
                    onSkillLayoutChange={(layout) => updateLocation({ skillLayout: layout === "flat" ? "flat" : null })}
                    onSkillChange={(skill) => updateLocation({ skill })}
                    onTranslate={canWrite ? openTranslation : undefined}
                    canWrite={canWrite}
                    issues={writable ? issues : undefined}
                    onEdit={(next, part = "information", focus) => {
                      if (next === "PROFILE") {
                        const fields =
                          part === "lore"
                            ? (["lore"] as const)
                            : formHolder
                              ? (["name", "summary"] as const)
                              : (["name", "title", "summary"] as const)
                        const missing = missingTranslationFields(
                          preview.content.PROFILE?.translations ?? [],
                          location.readLocale,
                          fields,
                        )[0]
                        if (missing) return openTranslation({ ...missing, section: "PROFILE", key: "profile" })
                      }
                      // Closing the editor reopens the content page on the section that was edited.
                      const editedTab = reviewTab(next)
                      if (editedTab !== location.tab)
                        updateLocation({ tab: editedTab === "overview" ? null : editedTab })
                      setSection(next)
                      setProfilePart(part)
                      setSkinFocus(next === "SKINS" ? (focus ?? null) : null)
                      setEditing(true)
                      setError("")
                    }}
                  />
                )}
                {view === "history" && (
                  // Where this version sits and how the hero changed: the version on screen with what can be done to it
                  // as a whole, then the change notes patch by patch, then any two versions side by side.
                  <div className="min-w-0 space-y-6">
                    <section className="space-y-4 rounded-xl border bg-muted/20 p-4" aria-label="Phiên bản đang mở">
                      <h2 className="type-section-title">Phiên bản đang mở</h2>
                      <VersionFacts
                        version={`Bản ${revision.revisionNo} · ${STATES[revision.state]}`}
                        cause={revision.cause}
                        patch={
                          publicationPatch
                            ? [publicationPatch.patchTitle, publicationPatch.patchCode]
                                .filter((part, index, parts) => part && parts.indexOf(part) === index)
                                .join(" · ")
                            : "Chưa rõ patch"
                        }
                      />
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
                            toast.success("Đã đổi patch, giữ nguyên nội dung và ảnh.")
                          }}
                        />
                      )}
                      {canRecordChanges && <PatchChangeForm key={revision.id} revision={revision} locale={locale} />}
                    </section>
                    <HeroPatchTimeline
                      heroId={heroId}
                      revision={revision}
                      revisions={revisions.data ?? []}
                      content={preview.content}
                      locale={locale}
                      canRecord={capabilities.includes("patch:write")}
                    />
                    {/* Comparing is a tool for when it is needed: folded, it costs no scrolling past every picture. */}
                    <details
                      className="group rounded-xl border"
                      open={comparing}
                      onToggle={(event) => setComparing(event.currentTarget.open)}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                        <span className="grid gap-0.5">
                          <span className="type-section-title">So sánh hai bản</span>
                          <span className="type-meta">Chọn hai bản đã lưu để xem chỗ khác nhau.</span>
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      {comparing && (
                        <div className="border-t px-4 pb-4">
                          <HeroRevisionHistory
                            heroId={heroId}
                            revision={revision}
                            revisions={revisions.data ?? []}
                            locale={locale}
                            content={preview.content}
                            disabled={busy}
                            onOpenRevision={(next) => void run(() => openRevision(next), "Đã mở phiên bản.")}
                          />
                        </div>
                      )}
                    </details>
                  </div>
                )}
                {view !== "overview" && editorPanel}
              </div>
              {/* A sheet keeps publishing next to the page instead of below every section. */}
            </>
          )}
        </>
      )}
    </PublishingFrame>
  )
}
