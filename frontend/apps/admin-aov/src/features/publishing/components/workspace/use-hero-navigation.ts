import { useState } from "react"
import type { Preview, Section } from "@/lib/hero-types"
import { languageOptions } from "@/features/users/profile-preference-picker"
import type { HeroWorkspaceView, readHeroLocation } from "../../model/hero-location"
import { missingTranslationFields, type TranslationTarget } from "../../model/hero-translation-model"
import { profileEditFields, translatableSections } from "../../model/hero-workspace-model"
import { reviewTab, type HeroReviewItem } from "../../model/import/hero-source-review"
import type { ProfileEditorPart } from "../editing/hero-profile-editor"

/**
 * Which part of the hero the page shows and edits, and the moves between them: a section's pencil, translating a
 * text, switching between content and history, and following a review note. The address keeps the view and the
 * section; whether that section is open in the editor is held here.
 */
export function useHeroNavigation({
  busy,
  setError,
  location,
  updateLocation,
  preview,
  sharedTitle,
}: {
  busy: boolean
  setError: (message: string) => void
  location: ReturnType<typeof readHeroLocation>
  updateLocation: (patch: Record<string, string | null | undefined>) => void
  preview: Preview | null
  /** The hero is a form, whose title is the shared one of the hero that holds it. */
  sharedTitle: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [profilePart, setProfilePart] = useState<ProfileEditorPart>("information")
  // The skin whose own pencil opened the skin editor; the section pencil opens all of them.
  const [skinFocus, setSkinFocus] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<HeroReviewItem | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const { section, sourceLocale } = location
  const setSection = (value: Section) =>
    updateLocation({ section: value, translationKey: null, translationField: null })

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
      ...(next === "translations" && !translatableSections.includes(section) ? { section: "PROFILE" } : {}),
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
      ...(!translatableSections.includes(section) ? { section: "PROFILE" } : {}),
      translationKey: null,
      translationField: null,
    })
    setEditing(false)
    setError("")
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

  /** A section's pencil; a profile without its text in the reading language opens translating it instead. */
  function editSection(next: Section, part: ProfileEditorPart = "information", focus?: string) {
    if (next === "PROFILE") {
      const translations = preview?.content.PROFILE?.translations ?? []
      const missing = missingTranslationFields(translations, location.readLocale, profileEditFields(part, sharedTitle))
      if (missing[0]) return openTranslation({ ...missing[0], section: "PROFILE", key: "profile" })
    }
    // Closing the editor reopens the content page on the section that was edited.
    const editedTab = reviewTab(next)
    if (editedTab !== location.tab) updateLocation({ tab: editedTab === "overview" ? null : editedTab })
    setSection(next)
    setProfilePart(part)
    setSkinFocus(next === "SKINS" ? (focus ?? null) : null)
    setEditing(true)
    setError("")
  }

  function reviewSkills() {
    updateLocation({ view: "overview", section: "SKILLS", tab: "skills" })
    setEditing(true)
    setReviewOpen(true)
  }

  function showReviewItem(item: HeroReviewItem) {
    if (!item.section) return
    setEditing(false)
    setReviewTarget(item)
    updateLocation({ view: "overview", section: item.section, tab: reviewTab(item.section), skill: item.skillKey })
  }

  return {
    editing,
    setEditing,
    profilePart,
    setProfilePart,
    skinFocus,
    reviewTarget,
    setReviewTarget,
    reviewOpen,
    setReviewOpen,
    setSection,
    setContentLocale: (value: string) => updateLocation({ readLocale: value }),
    setTargetLocale: (value: string) => updateLocation({ target: value }),
    openTranslation,
    switchView,
    translateInto,
    openManagement,
    openUnsavedSection,
    editSection,
    reviewSkills,
    showReviewItem,
  }
}
