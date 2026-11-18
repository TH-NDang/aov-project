import type { components } from "../generated/hero-api"
import type { PublicationOverview, Variant } from "../api/publication-overview"
import {
  publicationPatchLink,
  publishBlockers,
  type PublishBlocker,
  type PublishBlockerKey,
  type PublishContent,
} from "./publish-rules"
import type { Revision } from "../api/types"
import { normalize } from "@/lib/text"
import { pickTranslation } from "@aov/ui/lib/translation-fallback"

export type HeroPublishReadiness = Omit<components["schemas"]["HeroPublishReadiness"], "revisions"> & {
  revisions: Revision[]
}
export type Draft = components["schemas"]["HeroPublishDraft"]

export type ReadinessStatus = "READY" | "BLOCKED" | "NO_DRAFT"
export interface ReadinessRow {
  rowKey: string
  heroId: string
  code: string
  name: string
  headUrl: string | null
  revisions: Revision[]
  rulesetId: string | null
  published?: Revision
  publishedPatch?: Variant
  draft?: Revision
  draftPatch?: Variant
  /** What the publish rules read from the draft. */
  facts?: Draft
  status: ReadinessStatus
  blockers: PublishBlocker[]
  /** Set when the draft is waiting for its patch to be published. */
  patchLink?: { to: string; code: string }
}

const draftContent = (draft: Draft): PublishContent => ({
  PROFILE: draft.profile,
  OVERVIEW_RATINGS: draft.overviewRatings,
  COMBAT_STATS: draft.combatStats,
  SKILLS: draft.skills,
  SKINS: draft.skinsSaved ? {} : null,
  MEDIA_BINDINGS: draft.mediaBindings,
})

const localName = (hero: HeroPublishReadiness, locale: string) => pickTranslation(hero.names, locale)?.name ?? hero.code

/** One row for each ruleset a hero has data in, judged with the same rules as the header publish button. */
export function readinessRows(
  heroes: HeroPublishReadiness[],
  overview: Pick<PublicationOverview, "variants">,
  locale: string,
): ReadinessRow[] {
  const variant = (id?: string | null) => overview.variants.find((row) => row.id === id)
  return heroes.flatMap((hero) => {
    const base = {
      heroId: hero.id,
      code: hero.code,
      name: localName(hero, locale),
      headUrl: hero.headUrl,
      revisions: hero.revisions,
    }
    const rulesets = [...new Set(hero.revisions.map((revision) => revision.rulesetId))]
    if (!rulesets.length)
      return [{ ...base, rowKey: hero.id, rulesetId: null, status: "NO_DRAFT" as const, blockers: [] }]
    return rulesets.map((rulesetId): ReadinessRow => {
      const scoped = hero.revisions.filter((revision) => revision.rulesetId === rulesetId)
      const published = scoped
        .filter((revision) => revision.state === "PUBLISHED")
        .sort((a, b) => b.revisionNo - a.revisionNo)[0]
      const draft = scoped.find((revision) => revision.state === "DRAFT")
      const facts = draft && hero.drafts.find((row) => row.revisionId === draft.id)
      const draftPatch = variant(draft?.effectiveFromPatchVariantId)
      const blockers =
        draft && facts
          ? publishBlockers({
              revision: draft,
              content: draftContent(facts),
              patch: draftPatch,
              patchLoading: false,
              observedStats: facts.observedStats,
              holdsForms: !!hero.formIds?.length,
            })
          : []
      return {
        ...base,
        rowKey: `${hero.id}:${rulesetId}`,
        rulesetId,
        published,
        publishedPatch: variant(published?.effectiveFromPatchVariantId),
        draft,
        draftPatch,
        facts: facts || undefined,
        status: !draft ? "NO_DRAFT" : blockers.length ? "BLOCKED" : "READY",
        blockers,
        patchLink: draft ? publicationPatchLink(draft, draftPatch) : undefined,
      }
    })
  })
}

export type DraftFilter = "ready" | "blocked" | ""
export interface ReadinessFilter {
  q: string
  unpublished: boolean
  draft: DraftFilter
  /** Only heroes with source images still to capture, most useful first. */
  captures: boolean
}

export function readinessFilter(params: URLSearchParams): ReadinessFilter {
  const draft = params.get("draft")
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    unpublished: params.get("published") === "false",
    draft: draft === "ready" || draft === "blocked" ? draft : "",
    captures: params.get("captures") === "missing",
  }
}

export function matchesReadinessSearch(row: ReadinessRow, q: string) {
  const search = normalize(q.trim())
  return !search || normalize(row.name).includes(search) || normalize(row.code).includes(search)
}

/** Both filters narrow together: not yet published and ready is what can go public next. */
export function filterReadinessRows(
  rows: readonly ReadinessRow[],
  filter: Pick<ReadinessFilter, "q" | "unpublished" | "draft">,
) {
  return rows.filter(
    (row) =>
      matchesReadinessSearch(row, filter.q) &&
      (!filter.unpublished || !row.published) &&
      (filter.draft === "" || row.status === (filter.draft === "ready" ? "READY" : "BLOCKED")),
  )
}

export function readinessSummary(rows: readonly ReadinessRow[]) {
  const blockers = new Map<string, { key: PublishBlockerKey; message: string; count: number }>()
  for (const row of rows)
    for (const blocker of row.blockers) {
      const entry = blockers.get(blocker.message)
      if (entry) entry.count++
      else blockers.set(blocker.message, { ...blocker, count: 1 })
    }
  return {
    total: rows.length,
    unpublished: rows.filter((row) => !row.published).length,
    ready: rows.filter((row) => row.status === "READY").length,
    readyUnpublished: rows.filter((row) => row.status === "READY" && !row.published).length,
    blocked: rows.filter((row) => row.status === "BLOCKED").length,
    noDraft: rows.filter((row) => row.status === "NO_DRAFT").length,
    blockers: [...blockers.values()].sort((a, b) => b.count - a.count || a.message.localeCompare(b.message, "vi")),
  }
}
