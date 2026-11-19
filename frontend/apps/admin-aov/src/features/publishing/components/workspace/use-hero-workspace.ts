import { useEffect, useEffectEvent, useId, useRef, useState } from "react"
import { useBeforeUnload } from "react-router"
import { useSession } from "@/app/auth/auth-gate"
import { usePageCloseGuard } from "@/app/layout/page-tabs"
import type { CatalogFilter } from "@/lib/catalog-scope"
import { SECTIONS, type Section } from "@/lib/hero-types"
import { useContentLocale, usePublicationOverview } from "../../api/publication-overview"
import { statPatchContext } from "../../model/assessment/combat-attributes"
import { formsOwnerOf } from "../../model/hero-forms-model"
import { heroLocationId, readHeroLocation } from "../../model/hero-location"
import { translatedText } from "../../model/hero-translation-model"
import {
  canMoveBaseline,
  canRecordPatchChanges,
  changeNoteKey,
  defaultRevision,
  fallbackReadLocale,
} from "../../model/hero-workspace-model"
import { useHeroForms } from "../editing/hero-forms"
import { useStatDefaults } from "../setup/patch-stat-defaults"
import { useHeroCaptures } from "./use-hero-captures"
import { useHeroLocation } from "./use-hero-location"
import { useHeroNavigation } from "./use-hero-navigation"
import { useHeroRevision } from "./use-hero-revision"
import { useHeroRevisionActions } from "./use-hero-revision-actions"
import { useHeroSectionEditor } from "./use-hero-section-editor"
import { useHeroSwitching } from "./use-hero-switching"

/**
 * Everything the page of one hero holds: the version on screen and its working copy, the view and section the address
 * asks for, the section being edited, and the links that lead the page somewhere (a fix, a capture, a review note).
 */
export function useHeroWorkspace({
  heroId,
  revisionId,
  onUnsavedChange,
  translationMode,
}: {
  heroId: string
  revisionId?: string
  onUnsavedChange?: (unsafe: boolean, busy?: boolean) => void
  translationMode: boolean
}) {
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("hero:write")
  const canPublish = capabilities.includes("hero:publish")
  const { params: urlParams, update: updateLocation } = useHeroLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // Comparing two versions opens on request, or straight away when a link asks for a comparison.
  const [comparing, setComparing] = useState(() => !!urlParams.get("compare"))
  const heroForms = useHeroForms(heroId || undefined)
  const formHolder = heroForms.data?.formKey ? heroForms.data.holder : null
  const filter: CatalogFilter = {
    seasonId: heroLocationId(urlParams.get("season")),
    variantId: heroLocationId(urlParams.get("patch")),
  }
  const editorRef = useRef<HTMLDivElement>(null)
  const sectionFormId = useId()
  const heroHeadingRef = useRef<HTMLHeadingElement>(null)
  const overview = usePublicationOverview()
  const displayLocale = useContentLocale()
  const location = readHeroLocation(urlParams, translationMode, displayLocale)
  const { view, section } = location

  const hero = useHeroRevision({ heroId, revisionId, canWrite, urlParams })
  const { requestedRevision, selectedId, setSelectedId, revisions, read, preview, revision, localDraft } = hero
  const navigation = useHeroNavigation({
    busy,
    setError,
    location,
    updateLocation,
    preview,
    sharedTitle: !!formHolder,
  })
  const { editing, setEditing, setProfilePart, setReviewTarget } = navigation
  const statPatch = statPatchContext(
    overview.data?.variants ?? [],
    revision,
    heroLocationId(urlParams.get("atPatch")) || filter.variantId || null,
    preview?.content,
  )
  const statDefaults = useStatDefaults(statPatch?.id)
  const translating = view === "translations"
  const locale = translating ? location.targetLocale : location.readLocale
  const noteKey = changeNoteKey(editing, section, navigation.profilePart)
  const note = localDraft.value.notes[noteKey] ?? ""
  const actions = useHeroRevisionActions({
    heroId,
    hero,
    overview,
    holdsForms: !!heroId && heroForms.data?.holder?.id === heroId,
    canWrite,
    canPublish,
    translating,
    note,
    updateLocation,
    setBusy,
    setError,
    setEditing,
  })
  const editor = useHeroSectionEditor({
    heroId,
    hero,
    section,
    profilePart: navigation.profilePart,
    noteKey,
    note,
    translating,
    locale,
    sourceLocale: location.sourceLocale,
    busy,
    run: actions.run,
    onSaved: () => setEditing(false),
  })
  const heroName =
    translatedText(preview?.content.PROFILE?.translations ?? [], location.readLocale, ["name"])?.name || "Hồ sơ tướng"
  const { captures, contentReveal } = useHeroCaptures({
    heroId,
    heroName,
    preview,
    patchCode: statPatch?.patchCode,
    ready: !!preview && !overview.isPending,
    location,
    editing,
    skillKey: heroLocationId(urlParams.get("skill")),
    updateLocation,
  })

  // The address decides when it changes. A revision chosen on the page is put in the address right after; until it
  // arrives there, the old address must not take the choice back.
  const selectedNow = useEffectEvent(() => selectedId)
  useEffect(() => {
    if (requestedRevision === selectedNow()) return
    setSelectedId(requestedRevision)
    setEditing(false)
    setError("")
  }, [heroId, requestedRevision, setSelectedId, setEditing])
  useEffect(() => {
    if (!selectedId && !requestedRevision && revisions.data?.length) {
      const chosen = defaultRevision(revisions.data)
      if (chosen) {
        setSelectedId(chosen.id)
        updateLocation({ revision: chosen.id })
      }
    }
  }, [revisions.data, selectedId, requestedRevision, updateLocation, setSelectedId])
  useEffect(() => {
    onUnsavedChange?.(busy, busy)
  }, [busy, onUnsavedChange])
  // The content page brings the edited section into view; outside it the editor stands alone and is scrolled to.
  // Both happen when editing starts, not again when the view changes during it.
  const standsAlone = useEffectEvent(() => view !== "overview")
  useEffect(() => {
    if (!editing) return
    editorRef.current?.focus({ preventScroll: true })
    if (standsAlone()) editorRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" })
  }, [editing])
  useBeforeUnload((event) => {
    if (busy) {
      event.preventDefault()
      event.returnValue = ""
    }
  })
  const canLeave = () => !busy
  usePageCloseGuard(canLeave, !!heroId && !onUnsavedChange)

  const { switchHero, switchForm } = useHeroSwitching({
    heroId,
    busy,
    drawer: !!onUnsavedChange,
    revision,
    urlParams,
    overview: overview.data,
    filter,
    forms: heroForms.data,
    openedWithoutRevision: hero.openedWithoutRevision,
  })

  // A hero without the account's language opens in English before Vietnamese.
  const profileTranslations = read.data?.content.PROFILE?.translations
  const requestedReadLocale = urlParams.get("readLocale")
  useEffect(() => {
    if (!profileTranslations || requestedReadLocale) return
    const fallback = fallbackReadLocale(
      profileTranslations.map((text) => text.locale),
      location.readLocale,
    )
    if (fallback) updateLocation({ readLocale: fallback })
  }, [profileTranslations, requestedReadLocale, location.readLocale, updateLocation])

  const canMove = !!hero.writable && canMoveBaseline(revision, revisions.data)
  // A link from the overview of all heroes lands on the part to fix, once the draft is here to open it.
  const fix = urlParams.get("fix")
  const fixReady = !!fix && !!preview && !revisions.isPending && (!hero.writable || localDraft.ready)
  // The link is followed once, when it becomes ready, as the page stands at that moment.
  const followFix = useEffectEvent(() => {
    updateLocation({ fix: null })
    if (fix === "PATCH") {
      if (canMove) navigation.openManagement()
    } else if (SECTIONS.some(([key]) => key === fix)) {
      if (hero.writable) {
        setProfilePart("information")
        setEditing(true)
      } else setReviewTarget({ note: "", section: fix as Section })
    }
  })
  useEffect(() => {
    if (fixReady) followFix()
  }, [fixReady])

  return {
    ...hero,
    ...navigation,
    ...actions,
    ...editor,
    heroId,
    capabilities,
    canWrite,
    canPublish,
    urlParams,
    updateLocation,
    location,
    view,
    section,
    locale,
    translating,
    displayLocale,
    overview,
    busy,
    setBusy,
    error,
    note,
    comparing,
    setComparing,
    editorRef,
    sectionFormId,
    heroHeadingRef,
    statPatch,
    statDefaults,
    heroName,
    captures,
    contentReveal,
    canLeave,
    switchHero,
    switchForm,
    formHolder,
    formsOwner: formsOwnerOf(heroForms.data),
    canMove,
    canRecordChanges: canRecordPatchChanges(revision) && capabilities.includes("patch:write"),
    cancelSection: () => {
      setEditing(false)
      setError("")
      editor.revertSection()
    },
  }
}

export type HeroWorkspaceState = ReturnType<typeof useHeroWorkspace>
