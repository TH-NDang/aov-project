import type { CatalogFilter } from "@/lib/catalog-scope"
import { SECTIONS, type HeroRow, type Revision, type Section } from "@/lib/hero-types"
import type { PublicationOverview, Variant } from "../api/publication-overview"
import { selectCatalogRevisions } from "./catalog/catalog-data"
import type { HeroWorkingCopy } from "./hero-working-copy"

type Notes = HeroWorkingCopy["notes"]
type NoteKey = keyof Notes
type ProfilePart = "information" | "lore"

/** The parts of a hero that are written per language; translating offers only these. */
export const translatableSections: readonly Section[] = ["PROFILE", "SKILLS", "SKINS"]

/** The name of a section, as the editor and the list of unsaved sections show it. */
export const sectionLabel = (section: Section) => SECTIONS.find(([key]) => key === section)![2]

/** A hero opened without a version shows its draft, else its published version, else the first one listed. */
export function defaultRevision(revisions: readonly Revision[]) {
  return (
    revisions.find((row) => row.state === "DRAFT") ?? revisions.find((row) => row.state === "PUBLISHED") ?? revisions[0]
  )
}

/**
 * The version another hero opens on: the one the catalog scope shows, otherwise its newest version that is not
 * discarded, in the same ruleset when one is given.
 */
export function switchedHeroRevision(
  hero: Pick<HeroRow, "revisions">,
  overview: PublicationOverview | undefined,
  filter: CatalogFilter,
  rulesetId: string,
): Revision | undefined {
  return (
    selectCatalogRevisions(hero.revisions, overview, filter, rulesetId)[0] ??
    [...hero.revisions]
      .filter((row) => row.state !== "DISCARDED" && (!rulesetId || row.rulesetId === rulesetId))
      .sort((a, b) => b.revisionNo - a.revisionNo)[0]
  )
}

/** A hero without the reading language opens in English before Vietnamese; undefined when it has that language. */
export function fallbackReadLocale(profileLocales: readonly string[], readLocale: string) {
  if (profileLocales.includes(readLocale)) return undefined
  return ["en-US", "vi-VN"].find((code) => profileLocales.includes(code)) ?? profileLocales[0]
}

/** The lore keeps a change note of its own, apart from the rest of the profile. */
export const changeNoteKey = (editing: boolean, section: Section, profilePart: ProfilePart): NoteKey =>
  editing && section === "PROFILE" && profilePart === "lore" ? "PROFILE_LORE" : section

/** `notes` with the note under `key` set to `value`, or taken out when `value` is empty. */
export function withChangeNote(notes: Notes, key: NoteKey, value: string): Notes {
  const next = { ...notes }
  if (value) next[key] = value
  else delete next[key]
  return next
}

/** The profile fields an edit of `part` needs in the reading language; a form shares its title with its holder. */
export function profileEditFields(part: ProfilePart, sharedTitle: boolean) {
  if (part === "lore") return ["lore"] as const
  return sharedTitle ? (["name", "summary"] as const) : (["name", "title", "summary"] as const)
}

/** An imported baseline may move to another patch until a version of its ruleset is published. */
export function canMoveBaseline(revision: Revision | undefined, revisions: readonly Revision[] | undefined) {
  return (
    revision?.cause === "DATA_BASELINE" &&
    !revision.sourceRevisionId &&
    !revisions?.some((row) => row.state === "PUBLISHED" && row.rulesetId === revision.rulesetId)
  )
}

/** Gameplay changes are recorded on a published version that a game patch brought. */
export function canRecordPatchChanges(revision: Revision | undefined) {
  return revision?.state === "PUBLISHED" && revision.cause === "GAME_PATCH" && !!revision.effectiveFromPatchVariantId
}

/** The one action the header offers for a version; the rest stays in its menu. */
export function headerActionOf(revision: Revision | undefined, canPublish: boolean, canWrite: boolean) {
  if (revision?.state === "DRAFT" && canPublish) return "publish" as const
  if (revision?.state === "PUBLISHED" && canWrite) return "draft" as const
  return null
}

/** The patch of a version as its title and its code, each named once. */
export function versionPatchLabel(patch: Pick<Variant, "patchTitle" | "patchCode"> | undefined) {
  if (!patch) return "Chưa rõ patch"
  return [patch.patchTitle, patch.patchCode]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(" · ")
}
