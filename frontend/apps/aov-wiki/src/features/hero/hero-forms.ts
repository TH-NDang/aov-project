import type { HeroDetail, HeroFormDetail, HeroListForm, HeroListItem } from "./hero-api"
import type { HeroRole } from "./hero-classifications"

/**
 * Heroes with forms (ADR-024): Flowborn is one hero whose forms (marksman, mage, …) each have their own roles,
 * skills and stats. The hero page lives at /hero/<hero>; every other form at /hero/<hero>/<form key>, so each form
 * has a static page of its own and a canonical address without a query string.
 */
export function heroFormPath(heroCode: string, formKey?: string | null, forms: readonly { formKey: string }[] = []) {
  const isDefault = !formKey || forms[0]?.formKey === formKey
  return isDefault ? `/hero/${heroCode}` : `/hero/${heroCode}/${formKey}`
}

export type HeroRoute =
  { kind: "hero"; hero: HeroListItem; form?: HeroListForm } | { kind: "redirect"; path: string } | { kind: "missing" }

/**
 * What /hero/<param>[/<form key>] shows. A form's own code or id, as old links and rich text still use, leads to
 * its place on the hero page; an unknown form key falls back to the hero's default form.
 */
export function resolveHeroRoute(items: readonly HeroListItem[], param?: string, formKey?: string): HeroRoute {
  if (!param) return { kind: "missing" }
  const hero = items.find((item) => item.code === param || item.id === param)
  if (hero) {
    const forms = hero.forms ?? []
    if (!formKey) return { kind: "hero", hero, form: forms[0] }
    const form = forms.find((candidate) => candidate.formKey === formKey)
    if (!form) return { kind: "redirect", path: `/hero/${hero.code}` }
    return { kind: "hero", hero, form }
  }
  for (const holder of items)
    for (const form of holder.forms ?? [])
      if (form.code === param || form.id === param)
        return { kind: "redirect", path: heroFormPath(holder.code, form.formKey, holder.forms) }
  return { kind: "missing" }
}

/**
 * The page reads one form as one hero: gameplay, its skills' media and its own revision for history and videos,
 * under the shared name, title and lore of the hero that holds it.
 */
export function heroWithForm(hero: HeroDetail, form?: HeroFormDetail): HeroDetail {
  if (!form) return hero
  const shared = hero.content.profile
  const own = form.content.profile
  return {
    ...form,
    context: hero.context,
    content: {
      ...form.content,
      profile: {
        name: shared?.name ?? own?.name ?? form.code,
        title: shared?.title ?? own?.title,
        summary: own?.summary || shared?.summary,
        lore: shared?.lore || own?.lore,
        roles: own?.roles ?? [],
      },
    },
  }
}

/** The detail of the form being read, matched by key; the first form when none or an unknown key is asked for. */
export function selectedForm(hero: HeroDetail, formKey?: string | null) {
  const forms = hero.forms ?? []
  return forms.find((form) => form.formKey === formKey) ?? forms[0]
}

/**
 * The switcher names a form by its first role, as the game shows a class icon; two forms sharing that role are told
 * apart by their own names instead.
 */
export function formLabelRole(form: { roles: readonly HeroRole[] }, forms: readonly { roles: readonly HeroRole[] }[]) {
  const role = form.roles[0]
  if (!role) return undefined
  return forms.filter((other) => other.roles[0] === role).length === 1 ? role : undefined
}

/** Searching the hero library also finds a hero by the names and codes of its forms. */
export function heroSearchTexts(hero: HeroListItem) {
  return [hero.name, hero.code, ...(hero.forms ?? []).flatMap((form) => [form.name, form.code])]
}
