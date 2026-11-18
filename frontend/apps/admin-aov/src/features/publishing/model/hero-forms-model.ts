import type { components } from "../generated/hero-api"
import { retainImageOptions } from "./assets/image-options"
import type { Bindings, MediaRole, Profile, Revision, Role } from "../api/types"
import { pickTranslation } from "@aov/ui/lib/translation-fallback"

export type HeroForms = components["schemas"]["HeroForms"]
export type HeroForm = components["schemas"]["HeroForm"]
export type ReplaceHeroForms = components["schemas"]["ReplaceHeroForms"]

/** One entry of the switcher: one form of the hero (ADR-024). */
export interface HeroFormChoice {
  id: string
  label: string
  role?: Role
  form?: HeroForm
}

const nameIn = (names: { locale: string; name: string }[], locale: string) => pickTranslation(names, locale)?.name

/**
 * The switcher shows each form by its first role, as the game does with class icons. The part the forms share is not
 * an entry of its own: it is edited from every form page. Two forms with the same first role are told apart by their
 * names; a form without a role yet by its name or code.
 */
export function heroFormChoices(view: HeroForms | undefined, locale: string, roleLabels: Record<Role, string>) {
  if (!view?.holder) return []
  const forms = view.forms
  const choices: HeroFormChoice[] = []
  for (const form of forms) {
    const role = form.roles[0] as Role | undefined
    const unique = role && forms.filter((other) => other.roles[0] === role).length === 1
    choices.push({
      id: form.id,
      label: unique ? roleLabels[role] : nameIn(form.names, locale) || form.code,
      role,
      form,
    })
  }
  return choices
}

/** The form a hero that holds forms opens on: the first one, which is also the default form on the Wiki. */
export function defaultFormOf(view: HeroForms | undefined, heroId: string) {
  return view?.holder?.id === heroId ? view.forms[0]?.id : undefined
}

/** The hero whose forms a page manages: the holder when the page shows one of its forms, otherwise the hero itself. */
export function formsOwnerOf(view: HeroForms | undefined) {
  if (!view) return undefined
  return view.formKey && view.holder ? view.holder : { id: view.heroId, code: view.code }
}

/** The shared part is edited on its open draft when there is one, otherwise on its newest published revision. */
export function sharedPartRevision(revisions: readonly Revision[]) {
  return (
    revisions.find((row) => row.state === "DRAFT") ??
    [...revisions].filter((row) => row.state === "PUBLISHED").sort((a, b) => b.revisionNo - a.revisionNo)[0]
  )
}

export interface SharedText {
  name: string
  title: string
}

export function sharedTextOf(profile: Profile | null | undefined, locale: string): SharedText {
  const text = profile?.translations.find((row) => row.locale === locale)
  return { name: text?.name ?? "", title: text?.title ?? "" }
}

/** Writes the shared name and title in one language and leaves every other field and language as it was. */
export function withSharedText(profile: Profile | null | undefined, locale: string, text: SharedText): Profile {
  const base = profile ?? { translations: [], roles: [], positions: [], sources: [] }
  const current = base.translations.find((row) => row.locale === locale)
  const next = {
    ...(current ?? { locale, summary: null, lore: null }),
    name: text.name.trim(),
    title: text.title.trim() || null,
  }
  return {
    ...base,
    translations: current
      ? base.translations.map((row) => (row.locale === locale ? next : row))
      : [...base.translations, next],
  }
}

export type CardImages = Partial<Record<MediaRole, string>>

/** Swaps the card images that changed, keeping the picture choices of the others. */
export function withCardImages(bindings: Bindings | null | undefined, images: CardImages): Bindings {
  const base = bindings ?? { bindings: {}, sources: [] }
  let next = base
  for (const role of ["HEAD", "PORTRAIT", "SPLASH"] as const) {
    const assetId = images[role]
    if (!assetId || assetId === next.bindings[role]) continue
    next = {
      ...next,
      bindings: { ...next.bindings, [role]: assetId },
      images: retainImageOptions(next.images, role, next.bindings[role], assetId),
    }
  }
  return next
}

/** A form's code is the hero code followed by its key, so the key is what follows "<hero code>-". */
export function formKeyFor(holderCode: string, code: string) {
  return code.startsWith(`${holderCode}-`) ? code.slice(holderCode.length + 1) : undefined
}

/** The request that saves an edited list, guarded by the list the editor started from. */
export function replaceFormsBody(
  view: HeroForms,
  holderCode: string,
  next: readonly { id: string; code: string }[],
  changeNote?: string,
): ReplaceHeroForms {
  return {
    expectedForms: view.forms.map((form) => form.id),
    forms: next.map((form) => ({ heroId: form.id, formKey: formKeyFor(holderCode, form.code) ?? form.code })),
    changeNote: changeNote?.trim() || null,
  }
}

/** Heroes that can join as forms: coded "<hero code>-<key>", not the hero itself and not already a form. */
export function formCandidates<T extends { id: string; code: string; holderId?: string | null; formIds?: string[] }>(
  holder: { id: string; code: string },
  rows: readonly T[],
  current: readonly { id: string }[],
) {
  return rows.filter(
    (row) =>
      row.id !== holder.id &&
      !!formKeyFor(holder.code, row.code) &&
      (!row.holderId || row.holderId === holder.id) &&
      !row.formIds?.length &&
      !current.some((form) => form.id === row.id),
  )
}

/** What a hero list row says about forms: which form a hero plays, or how many forms it holds. */
export function heroFormNote(hero: { formKey?: string | null; formIds?: string[] }) {
  if (hero.formKey) return `dạng ${hero.formKey}`
  return hero.formIds?.length ? `${hero.formIds.length} dạng` : null
}
