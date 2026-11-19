import type { HeroDetail, HeroFormDetail, HeroListForm, HeroListItem } from "./hero-api"
import type { HeroRole } from "./hero-classifications"
import type { WikiCatalogScope } from "./wiki-catalog"

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

/** The scope of today's data: what the page shows outside the abilities, whichever patch is chosen. */
export function currentScope<T extends WikiCatalogScope>(scope: T): WikiCatalogScope {
  return { region: scope.region, locale: scope.locale, seasonId: "", patchVariantId: "", includeUnscoped: false }
}

/**
 * The hero as read at a past patch: today's profile, stats, artwork and skins with that patch's abilities. Older data
 * of the other parts is often missing or only worded differently, and real changes there are told by the patch notes
 * (ADR-016). A skill picture missing from the past keeps today's.
 */
export function heroAtPatch(current: HeroDetail, past: HeroDetail): HeroDetail {
  const pastForms = new Map(past.forms?.map((form) => [form.formKey, form]))
  return {
    ...current,
    ...skillsOf(current, past),
    context: past.context,
    laterObservation: past.laterObservation,
    forms: current.forms?.map((form) => {
      const old = pastForms.get(form.formKey)
      return old ? { ...form, ...skillsOf(form, old), laterObservation: old.laterObservation } : form
    }),
  }
}

function skillsOf<T extends Pick<HeroDetail, "content" | "skillMedia" | "skillStateMedia">>(current: T, past: T) {
  return {
    skillMedia: { ...current.skillMedia, ...past.skillMedia },
    skillStateMedia: { ...current.skillStateMedia, ...past.skillStateMedia },
    content: { ...current.content, skills: past.content.skills ?? current.content.skills },
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
