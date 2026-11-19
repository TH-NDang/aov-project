import { useQueryClient } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import type { Content, Section } from "@/lib/hero-types"
import { sameHeroSection, type HeroWorkingCopy } from "../../model/hero-working-copy"
import { sectionLabel, withChangeNote } from "../../model/hero-workspace-model"
import { replaceProfilePart, type ProfileEditorPart } from "../editing/hero-profile-editor"
import { emptySection } from "../editing/section-editor"
import type { HeroRevision } from "./use-hero-revision"

const api = createPublishingApi(backendRequest)

/**
 * The one section open in the editor: its value as edited, its change note, and how to change, save or revert it.
 * On the content page the profile is edited a part at a time, so only that part counts as changed.
 */
export function useHeroSectionEditor({
  heroId,
  hero,
  section,
  profilePart,
  noteKey,
  note,
  translating,
  locale,
  sourceLocale,
  busy,
  run,
  onSaved,
}: {
  heroId: string
  hero: HeroRevision
  section: Section
  profilePart: ProfileEditorPart
  noteKey: keyof HeroWorkingCopy["notes"]
  note: string
  translating: boolean
  locale: string
  sourceLocale: string
  busy: boolean
  run: (action: () => Promise<unknown>, success: string) => Promise<void>
  onSaved: () => void
}) {
  const queryClient = useQueryClient()
  const { read, preview, revision, localDraft, dirty, writable } = hero
  const focusedProfile = !translating && section === "PROFILE"
  const editorDisabled =
    !writable ||
    busy ||
    !localDraft.ready ||
    localDraft.invalid ||
    localDraft.conflict ||
    read.isFetching ||
    (translating && sourceLocale === locale)
  const sectionValue = focusedProfile
    ? replaceProfilePart(read.data?.content.PROFILE ?? null, preview?.content.PROFILE ?? null, profilePart, locale)
    : preview?.content[section]
  const sectionDirty = focusedProfile
    ? !sameHeroSection("PROFILE", sectionValue, read.data?.content.PROFILE)
    : dirty.has(section)
  const editorTitle = focusedProfile && profilePart === "lore" ? "Cốt truyện" : sectionLabel(section)

  function setNote(value: string) {
    localDraft.update({ ...localDraft.value, notes: withChangeNote(localDraft.value.notes, noteKey, value) })
  }

  function updateSection(value: NonNullable<Content[Section]>) {
    localDraft.update({ ...localDraft.value, content: { ...localDraft.value.content, [section]: value } })
  }

  /** Puts the section back as it was read and drops its change note. */
  function revertSection() {
    if (!sectionDirty && !note) return
    localDraft.update({
      content: {
        ...localDraft.value.content,
        [section]: focusedProfile
          ? replaceProfilePart(
              localDraft.value.content.PROFILE,
              read.data?.content.PROFILE ?? null,
              profilePart,
              locale,
            )
          : structuredClone(read.data?.content[section]),
      },
      notes: withChangeNote(localDraft.value.notes, noteKey, ""),
    })
  }

  function saveSection() {
    if (!sectionDirty || editorDisabled || !revision || !preview) return
    void run(async () => {
      const value = sectionValue ?? emptySection(section, locale)
      const next = await api.save(revision, section, value, note)
      const saved = await api.read(heroId, revision.id)
      queryClient.setQueryData(publishingKeys.preview(heroId, revision.id), saved)
      const notes = withChangeNote(localDraft.value.notes, noteKey, "")
      const content = {
        ...preview.content,
        [section]: focusedProfile
          ? replaceProfilePart(preview.content.PROFILE, saved.content.PROFILE, profilePart, locale)
          : saved.content[section],
      }
      localDraft.rebase({ content, notes }, { content: saved.content, notes: {} }, next.version)
      if (!translating) onSaved()
    }, "Đã lưu nội dung vào bản nháp.")
  }

  return {
    focusedProfile,
    editorDisabled,
    sectionValue,
    sectionDirty,
    editorTitle,
    setNote,
    updateSection,
    revertSection,
    saveSection,
  }
}
