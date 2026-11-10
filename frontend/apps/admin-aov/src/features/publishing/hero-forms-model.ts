import type { components } from "./generated/hero-api"
import type { Role } from "./types"

export type HeroForms = components["schemas"]["HeroForms"]
export type HeroForm = components["schemas"]["HeroForm"]
export type ReplaceHeroForms = components["schemas"]["ReplaceHeroForms"]

/** One entry of the switcher: the hero that holds the forms ("Chung") or one of its forms (ADR-024). */
export interface HeroFormChoice {
  id: string
  label: string
  role?: Role
  form?: HeroForm
}

const nameIn = (names: { locale: string; name: string }[], locale: string) =>
  (names.find((text) => text.locale === locale) ?? names.find((text) => text.locale === "vi-VN") ?? names[0])?.name

/**
 * The switcher shows the shared part first, then each form by its first role as the game does with class icons. Two
 * forms with the same first role are told apart by their names; a form without a role yet by its name or code.
 */
export function heroFormChoices(view: HeroForms | undefined, locale: string, roleLabels: Record<Role, string>) {
  if (!view?.holder) return []
  const forms = view.forms
  const choices: HeroFormChoice[] = [{ id: view.holder.id, label: "Chung" }]
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
