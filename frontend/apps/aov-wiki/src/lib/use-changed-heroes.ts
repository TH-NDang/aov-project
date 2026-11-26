import { useQuery } from "@tanstack/react-query"
import { useWikiContext } from "../context/wiki-context"
import { KIND_ORDER } from "./change-kinds"
import { heroCatalogQuery, type HeroListForm, type HeroListItem } from "./hero-api"
import { heroFormPath } from "./hero-forms"
import { parseChangeSummary } from "./wiki-change-format"
import { usePublishedChanges } from "./wiki-patch-changes"

const kindRank = (kind: string) => KIND_ORDER.indexOf(kind) + 1 || 99

/** A hero the version in force changed; `to` and `hero` are missing while the hero has no published profile yet. */
export interface ChangedHero {
  id: string
  name: string
  kind: string
  /** The sentence of the notes that says what changed. */
  summary: string
  /** How many separate changes the notes list. */
  count: number
  hero?: HeroListItem
  shown?: HeroListItem | HeroListForm
  to?: string
}

/**
 * The heroes the version in force changed, with what the notes say about each, in the order readers look for them.
 * Names and pictures come from the hero list; a change recorded for a form opens that form (ADR-024).
 */
export function useChangedHeroes() {
  const scope = useWikiContext()
  const catalog = useQuery(heroCatalogQuery(scope))
  const changes = usePublishedChanges("HERO")
  const published = catalog.data?.items ?? []
  const heroes = new Map(published.map((hero) => [hero.id, hero]))
  const forms = new Map(
    published.flatMap((hero) => (hero.forms ?? []).map((form) => [form.id, { hero, form }] as const)),
  )
  const notes = new Map<string, { summary: string; count: number }>()
  for (const row of changes.patches.flatMap((patch) => patch.rows)) {
    const id = row.heroId ?? row.subject?.id
    if (!id) continue
    const previous = notes.get(id)
    const summary = parseChangeSummary(row.summary).text
    notes.set(id, {
      summary: previous?.summary || summary,
      count: (previous?.count ?? 0) + (row.changes?.length ?? 0),
    })
  }

  const list: ChangedHero[] = []
  for (const subject of changes.subjects.values()) {
    const owner = forms.get(subject.id)
    const hero = heroes.get(subject.id) ?? owner?.hero
    const shown = owner?.form ?? hero
    const name = shown?.name ?? subject.name ?? ""
    if (!name) continue
    list.push({
      id: subject.id,
      name,
      kind: subject.kind,
      summary: notes.get(subject.id)?.summary ?? "",
      count: notes.get(subject.id)?.count ?? 0,
      hero,
      shown,
      to: hero && scope.href(owner ? heroFormPath(hero.code, owner.form.formKey, hero.forms) : `/hero/${hero.code}`),
    })
  }
  list.sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name, scope.locale))

  return {
    heroes: list,
    // Names and pictures come from the hero list, so the rows wait for it instead of showing raw codes first.
    pending: (changes.pending && !list.length) || catalog.isPending,
    failed: changes.failed,
    retry: changes.retry,
  }
}

/** How many heroes each kind of change touched, in the readers' order. */
export function kindTally(heroes: ChangedHero[]) {
  const tally = new Map<string, number>()
  for (const hero of heroes) tally.set(hero.kind, (tally.get(hero.kind) ?? 0) + 1)
  return new Map([...tally].sort(([a], [b]) => kindRank(a) - kindRank(b)))
}
