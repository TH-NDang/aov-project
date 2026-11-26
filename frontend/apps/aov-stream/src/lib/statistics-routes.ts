import { QUESTION_KEYS, writeQuestion, type GameOrder, type Question } from "./finder-model.ts"
import type { FeedHero } from "./game-feed.ts"

/** The parts of a competition's statistics; the address leaves out the first. */
const STATS_PARTS = ["heroes", "teams", "highlights", "games"] as const
export type StatsPart = (typeof STATS_PARTS)[number]

/** What an address of the statistics opens: a part, or one hero or one team on a page of its own. */
export type StatsPlace = {
  part: StatsPart
  hero?: string | null
  team?: string | null
  /** The games of a hero or a team opened in its place: those it was picked or banned in, or those it played. */
  list?: StatsList | null
  /** The game chosen in the season of a team. */
  game?: string | null
  /** The period counted, when it is not the whole competition. */
  scope?: string | null
}
export type StatsList = "picks" | "bans" | "games"
const LISTS: StatsList[] = ["picks", "bans", "games"]

/** Every key of the address the statistics own. */
export const STATS_KEYS: string[] = [
  "view",
  "hero",
  "club",
  "list",
  "rel",
  "game",
  "in",
  "by",
  "as",
  "sort",
  ...QUESTION_KEYS,
]

export function statsPlace(params: URLSearchParams): StatsPlace {
  const view = params.get("view")
  const part = STATS_PARTS.find((item) => item === view) ?? "heroes"
  const hero = params.get("hero")
  const team = part === "teams" && !hero ? params.get("club") : null
  return {
    // A hero has a page of its own, which stands among the heroes; a team has one among the teams.
    part: hero ? "heroes" : part,
    hero,
    team,
    list: LISTS.find((item) => item === params.get("list")) ?? null,
    game: team ? params.get("game") : null,
    scope: params.get("in"),
  }
}

type Target = Partial<Omit<StatsPlace, "hero">> & {
  /** `team` opens a team's page; a question about a team names it in the question. */
  hero?: Pick<FeedHero, "key"> | string | null
  question?: Partial<Question>
  sort?: GameOrder
}

/** The address of a place in the statistics of a competition. */
export function statsHref(competitionId: string, { part, hero, team, list, game, scope, question, sort }: Target = {}) {
  const params = new URLSearchParams({ tab: "stats" })
  const opened = question ? "games" : part
  if (opened && opened !== "heroes" && !hero) params.set("view", opened)
  if (hero) params.set("hero", typeof hero === "string" ? hero : hero.key)
  if (team && opened === "teams") params.set("club", team)
  if (list && (hero || team)) params.set("list", list)
  if (game && params.has("club")) params.set("game", game)
  for (const [key, value] of question ? writeQuestion(question) : []) params.set(key, value)
  if (sort && sort !== "new") params.set("sort", sort)
  if (scope) params.set("in", scope)
  return `/competitions/${encodeURIComponent(competitionId)}?${params}`
}
