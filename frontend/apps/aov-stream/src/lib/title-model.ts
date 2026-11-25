import type { CompetitionView, TournamentContent } from "@aov/community-contracts"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { competitionChampion, type ChampionTeam } from "./champion-model.ts"
import { isArea } from "./competition-filters.ts"
import { competitionStatus } from "./competition-model.ts"
import { circuitIdOf, seasonRows } from "./directory-model.ts"
import { teamMatches } from "./participant-model.ts"
import { seasonName } from "./season-name.ts"
import { teamRecord, type TeamRecord } from "./standings-model.ts"

const DAY = 86_400_000
/** Teams of this many countries make a competition an international one, unless one country sends most of them. */
const COUNTRIES = 3
const MOST = 0.6
/** A champion older than this many days is nobody's reigning one. */
const REIGN = 550
/** Seasons whose ends are further apart than this, in days, leave room for one that is not published. */
const APART = { LEAGUE: 270, CUP: 460 }
/** As many titles as stand on one shelf, whatever they are. */
const ONE_SHELF = 5
/** Matches a team wins before not having lost any says something. */
const UNBEATEN = 5

/**
 * What a title's trophy looks like: the world's, an international league's, a national league's, a national cup's, a
 * lower division's, and a show match's.
 */
export type TrophyForm = "globe" | "orbit" | "cup" | "goblet" | "shield" | "crystal"
const FORMS: TrophyForm[] = ["globe", "orbit", "cup", "goblet", "shield", "crystal"]

function isInternational({ tournament, teams }: CompetitionView["content"]) {
  if (isArea(tournament.region)) return true
  const sent = new Map<string, number>()
  for (const { country } of Object.values(teams)) if (country) sent.set(country, (sent.get(country) ?? 0) + 1)
  const counts = [...sent.values()]
  const all = counts.reduce((sum, count) => sum + count, 0)
  return counts.length >= COUNTRIES && Math.max(...counts) < all * MOST
}

/** The trophy of a competition, by its tier, its kind and where its teams come from. */
export function trophyForm({ content }: CompetitionView): TrophyForm {
  const { tier, competitionType } = content.tournament
  if (competitionType === "SHOWMATCH") return "crystal"
  if (tier === "S") return "globe"
  if (isInternational(content)) return competitionType === "LEAGUE" ? "orbit" : "globe"
  if (tier === "B" || tier === "C" || tier === "D") return "shield"
  return competitionType === "CUP" ? "goblet" : "cup"
}

/** A title as a page's record or a team's seasons give it. */
export type TitleEntry = { key: string; title: string; date?: string | null; competitionId?: string }

export type Title = {
  key: string
  /** The competition's name without the year, and the same with its circuit in short. */
  name: string
  short: string
  year: string | null
  form: TrophyForm
  /** The competition when it is published here. */
  competition: Pick<TournamentContent, "logoUrl" | "logoDarkUrl" | "startsOn" | "endsOn"> | null
  competitionId: string | null
  winner: ChampionTeam | null
  final: { score: string | null; opponent: ChampionTeam } | null
  record: TeamRecord | null
  /** The winner lost no match. */
  unbeaten: boolean
  /** How many seasons of the circuit were won in a row up to this one; 1 for those another one followed. */
  streak: number
  /** The latest season of its circuit. */
  reigning: boolean
}

const endOf = ({ content: { tournament } }: CompetitionView) =>
  Date.parse(`${(tournament.endsOn || tournament.startsOn || "").slice(0, 10)}T00:00:00Z`) || null

/** The finished seasons of a circuit that have a champion, the oldest first; parts of a season are none. */
const wonSeasons = (views: CompetitionView[], now: number) =>
  seasonRows(views)
    .filter(({ view, part }) => !part && !view.content.tournament.parentTournamentId)
    .map(({ view }) => view)
    .filter((view) => endOf(view) != null && competitionStatus(view.content, now) === "FINISHED")
    .filter((view) => competitionChampion(view))
    .sort((a, b) => endOf(a)! - endOf(b)!)

/** Whether nothing lies between two seasons of a circuit. */
const follows = (before: CompetitionView, after: CompetitionView) => {
  const apart = after.content.tournament.competitionType === "LEAGUE" ? APART.LEAGUE : APART.CUP
  return endOf(after)! - endOf(before)! <= apart * DAY
}

/** Whether the season after `view` was won too. */
function seasonAfter(view: CompetitionView, seasons: CompetitionView[], won: Set<string>) {
  const after = seasons[seasons.findIndex(({ id }) => id === view.id) + 1]
  return !!after && won.has(after.id) && follows(view, after)
}

/** How many of `seasons` up to `view` are in `won`, one after the other. */
function streakOf(view: CompetitionView, seasons: CompetitionView[], won: Set<string>) {
  let at = seasons.findIndex(({ id }) => id === view.id)
  let streak = 1
  while (at > 0 && won.has(seasons[at - 1]!.id) && follows(seasons[at - 1]!, seasons[at]!)) {
    streak += 1
    at -= 1
  }
  return streak
}

/**
 * The circuits whose latest season a title may be: those of titles won lately. Their seasons say whether it is.
 */
export function circuitsToAsk(entries: TitleEntry[], views: CompetitionView[], now: number) {
  const won = new Set(entries.flatMap((entry) => entry.competitionId ?? []))
  return [
    ...new Set(
      views
        .filter((view) => won.has(view.id) && now - (endOf(view) ?? 0) <= REIGN * DAY)
        .flatMap((view) => circuitIdOf(view) ?? []),
    ),
  ]
}

/**
 * Titles with what is known of each. `views` are published competitions that may hold them; `circuits` the seasons of
 * the circuits that were read whole, the only ones that can say who reigns.
 */
export function titleList(
  entries: TitleEntry[],
  views: CompetitionView[],
  circuits: Map<string, CompetitionView[]>,
  now: number,
): Title[] {
  const known = new Map(views.map((view) => [view.id, view]))
  const won = new Set(entries.flatMap((entry) => entry.competitionId ?? []))
  // A title that is not published here has the trophy and the short name of its circuit, which its name starts with.
  const named = views
    .flatMap((view) => {
      const { circuit, plan } = view.content
      const name = circuit?.name || plan.circuit
      return name ? [{ name, folded: foldSearchText(name), short: circuit?.shortName, form: trophyForm(view) }] : []
    })
    .sort((a, b) => b.name.length - a.name.length)
  const titles = entries
    .map(({ key, title, date, competitionId }): Title & { date: string } => {
      const year = date?.slice(0, 4) || null
      const view = competitionId ? known.get(competitionId) : undefined
      const timeless = (text: string) =>
        year ? text.replace(new RegExp(`\\s*\\b${year}\\b\\s*`), " ").trim() || text : text
      const whole = view?.content.tournament.name ?? title
      const circuitOf = named.find(({ folded }) => foldSearchText(whole).startsWith(folded))
      const season = circuitOf ? seasonName(whole, circuitOf.name) : whole
      const base = {
        key,
        name: timeless(whole),
        short: timeless(circuitOf?.short && season !== whole ? `${circuitOf.short} ${season}` : whole),
        year,
        date: date ?? "",
        competitionId: competitionId ?? null,
      }
      if (!view)
        return {
          ...base,
          form: circuitOf?.form ?? "cup",
          competition: null,
          winner: null,
          final: null,
          record: null,
          unbeaten: false,
          streak: 1,
          reigning: false,
        }
      const champion = competitionChampion(view)
      const winner = champion?.winner ?? null
      const record = winner?.id ? teamRecord(teamMatches(view, winner.id), winner.id) : null
      const circuit = circuitIdOf(view)
      const asked = circuit ? circuits.get(circuit) : undefined
      const seasons = wonSeasons(asked ?? views.filter((other) => circuit && circuitIdOf(other) === circuit), now)
      return {
        ...base,
        form: trophyForm(view),
        competition: view.content.tournament,
        winner,
        final: champion?.runnerUp ? { score: champion.score, opponent: champion.runnerUp } : null,
        record: record?.played ? record : null,
        unbeaten: !!record && record.lost === 0 && record.won >= UNBEATEN,
        streak: seasonAfter(view, seasons, won) ? 1 : streakOf(view, seasons, won),
        reigning: !!asked && seasons.at(-1)?.id === view.id && now - endOf(view)! <= REIGN * DAY,
      }
    })
    .sort((a, b) => FORMS.indexOf(a.form) - FORMS.indexOf(b.form) || b.date.localeCompare(a.date))
  return titles.map(({ date: _, ...title }) => title)
}

export type Shelf = { key: "INTERNATIONAL" | "NATIONAL" | "OTHER" | null; titles: Title[] }

const SHELVES: { key: NonNullable<Shelf["key"]>; forms: TrophyForm[] }[] = [
  { key: "INTERNATIONAL", forms: ["globe", "orbit"] },
  { key: "NATIONAL", forms: ["cup", "goblet"] },
  { key: "OTHER", forms: ["shield", "crystal"] },
]

/** Titles on their shelves, the greatest on top; a few of them keep together on one that needs no name. */
export function titleShelves(titles: Title[]): Shelf[] {
  const shelves = SHELVES.map(({ key, forms }): Shelf => ({
    key,
    titles: titles.filter(({ form }) => forms.includes(form)),
  })).filter((shelf) => shelf.titles.length > 0)
  return titles.length > ONE_SHELF && shelves.length > 1 ? shelves : [{ key: null, titles }]
}
