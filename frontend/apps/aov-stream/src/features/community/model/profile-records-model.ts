import type { CompetitionView, ProfileAchievement, ProfileHistory } from "@aov/community-contracts"
import { achievementRank, readStanding, type AchievementRank } from "@aov/community-contracts/achievements"
import { foldSearchText } from "@aov/ui/lib/search-text"

const fold = (value: string) => foldSearchText(value).trim()

/**
 * Finds the published competition a record of a page speaks of, so its name can open it. Records carry a competition's
 * id only sometimes; a career step names it, and is matched by that name or by sharing both its dates with exactly
 * one competition the page took part in.
 */
export function competitionLinks(views: CompetitionView[]) {
  const names = new Map(views.map((view) => [view.id, view.content.tournament.name]))
  const byName = new Map(views.map((view) => [fold(view.content.tournament.name), view.id]))
  const byDates = new Map<string, string | null>()
  for (const view of views) {
    const { startsOn, endsOn } = view.content.tournament
    if (!startsOn || !endsOn) continue
    const key = `${startsOn.slice(0, 10)}|${endsOn.slice(0, 10)}`
    byDates.set(key, byDates.has(key) ? null : view.id)
  }
  return {
    /** The published name of a competition, when it is one of these. */
    name: (id?: string | null) => (id ? names.get(id) : undefined),
    find: (title: string, startsOn?: string | null, endsOn?: string | null) =>
      byName.get(fold(title)) ??
      (startsOn && endsOn ? (byDates.get(`${startsOn.slice(0, 10)}|${endsOn.slice(0, 10)}`) ?? undefined) : undefined),
  }
}

export type CompetitionLinks = ReturnType<typeof competitionLinks>

export type AchievementGroup = {
  key: string
  title: string
  competitionId?: string
  date?: string | null
  placements: string[]
  /** The rank of every result in the group, stored or read from its wording. */
  ranks: AchievementRank[]
  sourceUrl?: string | null
}

const newestFirst = (groups: AchievementGroup[]) =>
  [...groups].sort((a, b) => (b.date || "").localeCompare(a.date || ""))

/** Whether two groups hold the same place, taken on the same day. */
const sameResult = (one: AchievementGroup, other: AchievementGroup) =>
  !!one.date &&
  one.date.slice(0, 10) === other.date?.slice(0, 10) &&
  one.ranks.some(
    (rank) => rank !== "AWARD" && other.ranks.some((another) => another !== "AWARD" && another.place === rank.place),
  )

/**
 * A page's placements and awards, one entry per competition and newest first. Sources often list the same result
 * twice, under the competition's English and Vietnamese names: an id shared by both makes them one, and so does the
 * same place on the same day where only one of them has an id.
 */
export function achievementGroups(items: ProfileAchievement[], links: CompetitionLinks): AchievementGroup[] {
  const groups = new Map<string, AchievementGroup>()
  for (const item of items) {
    const key = item.tournamentId || `${fold(item.title)}|${item.date || ""}`
    const group = groups.get(key) ?? {
      key,
      title: links.name(item.tournamentId) || item.title,
      competitionId: links.name(item.tournamentId) ? item.tournamentId! : undefined,
      date: item.date,
      placements: [],
      ranks: [],
      sourceUrl: item.sourceUrl,
    }
    if (!group.placements.includes(item.placement)) group.placements.push(item.placement)
    group.ranks.push(achievementRank(item))
    if ((item.date || "") > (group.date || "")) group.date = item.date
    groups.set(key, group)
  }
  const identified = new Set(items.flatMap((item) => item.tournamentId ?? []))
  const all = [...groups.values()]
  return newestFirst(
    all.filter(
      (group) =>
        identified.has(group.key) || !all.some((other) => identified.has(other.key) && sameResult(group, other)),
    ),
  )
}

/** A place a page took in a published competition, as its table or its final gives it. */
export type PublishedPlace = { view: CompetitionView; place: string | null }

/** Places below the fourth are no achievement a page would show. */
const LAST_PLACE = 4

/** The same words in any order are the same competition: "GCS 2026 Spring" and "GCS Spring 2026". */
const wordsOf = (title: string) => fold(title).split(" ").filter(Boolean).sort().join(" ")

/**
 * The record of a page with what published competitions add to it: a result the record does not hold yet becomes an
 * entry of its own, worded by `word`, and one it does hold opens its competition. Qualifiers and the other parts of a
 * competition add nothing.
 */
export function withPublishedPlaces(
  groups: AchievementGroup[],
  places: PublishedPlace[],
  word: (place: string) => string,
): AchievementGroup[] {
  const merged = groups.map((group) => ({ ...group }))
  for (const { view, place } of places) {
    const { tournament } = view.content
    const standing = place ? readStanding(place) : null
    if (!standing || standing.place > LAST_PLACE) continue
    if (tournament.parentTournamentId || tournament.competitionType === "QUALIFIER") continue
    const endsOn = tournament.endsOn?.slice(0, 10)
    const known = merged.find(
      (group) =>
        group.competitionId === view.id ||
        group.key === view.id ||
        wordsOf(group.title) === wordsOf(tournament.name) ||
        (!!endsOn &&
          group.date?.slice(0, 10) === endsOn &&
          group.ranks.some((rank) => rank !== "AWARD" && rank.place === standing.place)),
    )
    if (known) {
      known.competitionId ??= view.id
      known.title = tournament.name
    } else
      merged.push({
        key: view.id,
        title: tournament.name,
        competitionId: view.id,
        date: endsOn ?? null,
        placements: [word(place!)],
        ranks: [standing],
      })
  }
  return newestFirst(merged)
}

/** A competition whose name says it only leads to another one. */
const QUALIFIER = /\b(qualifiers?|road to|vong loai|vong thang hang)\b/

/** Whether a group holds a title: a first place nobody shares, and not of a qualifier. */
export const isTitle = (group: AchievementGroup) =>
  !QUALIFIER.test(fold(group.title)) &&
  group.ranks.some((rank) => rank !== "AWARD" && rank.place === 1 && !rank.placeTo)

/** How many distinct results the groups hold, which is what the page counts as its achievements. */
export const achievementCount = (groups: AchievementGroup[]) =>
  groups.reduce((sum, group) => sum + group.placements.length, 0)

/**
 * A page's history without the steps its sources repeat: the same dates and the same role under a competition's
 * English and Vietnamese names are one step, kept in the form that names its page.
 */
export function distinctHistory(items: ProfileHistory[]) {
  const seen = new Map<string, ProfileHistory>()
  const steps: ProfileHistory[] = []
  for (const item of items) {
    const key = item.startsOn && item.endsOn ? `${item.startsOn}|${item.endsOn}|${fold(item.role || "")}` : null
    const earlier = key ? seen.get(key) : undefined
    if (!earlier) {
      if (key) seen.set(key, item)
      steps.push(item)
    } else if (!earlier.relatedPageId && item.relatedPageId) {
      steps[steps.indexOf(earlier)] = item
      seen.set(key!, item)
    }
  }
  return steps
}
