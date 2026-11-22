import { difficultyBand, difficultyLevel, type DifficultyBand } from "./hero-difficulty.ts"

/** The orders the library can be read in. Tier and win rate need a confirmed ranking; difficulty needs the ratings. */
export const HERO_SORTS = ["name", "difficulty", "tier", "winRate"] as const
export type HeroSort = (typeof HERO_SORTS)[number]

export function heroSortOf(value: string | null): HeroSort {
  return HERO_SORTS.find((sort) => sort === value) ?? "name"
}

/** A hero's place in the latest confirmed ranking of its market. */
export interface HeroStanding {
  tier: string | null
  winRate: number | null
  pickRate: number | null
  banRate: number | null
}

/** What ordering needs from a hero. */
export interface OrderedHero {
  id: string
  code: string
  name: string
  difficulty?: number | null
}

/**
 * One run of the library: the heroes that share a letter, a tier or a difficulty, behind an index card that names it.
 * `label` is null for a run that needs no card, such as the heroes ordered by win rate.
 */
export interface HeroRun<Hero> {
  key: string
  label: string | null
  /** The kind of label the card draws: one big letter, or a short word. */
  labelKind: "letter" | "word"
  heroes: Hero[]
}

/** Tiers from the strongest. A tier outside this list sorts after it, in alphabetical order. */
const TIER_ORDER = ["SS", "S+", "S", "S-", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"]

function tierRank(tier: string | null | undefined) {
  if (!tier) return Number.POSITIVE_INFINITY
  const upper = tier.trim().toUpperCase()
  const index = TIER_ORDER.indexOf(upper)
  if (index >= 0) return index
  // Tiers written T0, T1… read from the strongest too.
  const numbered = /^T(\d+)$/.exec(upper)
  return numbered ? TIER_ORDER.length + Number(numbered[1]) : TIER_ORDER.length + 100
}

/**
 * The letter a name files under: its first letter without accents, the crossed d filed with D, so a reader finds a hero
 * under the letter of the name they see. Anything but a letter files under "#".
 */
export function heroNameLetter(name: string) {
  const first = name.trim().charAt(0).normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/u, "D").toUpperCase()
  return /^\p{L}$/u.test(first) ? first : "#"
}

/** Names in the reader's language order, filed by their letter first so the runs and the order agree. */
function nameOrder(locale: string) {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true })
  return (a: OrderedHero, b: OrderedHero) =>
    heroNameLetter(a.name).localeCompare(heroNameLetter(b.name)) || collator.compare(a.name, b.name)
}

/** The difficulty band of a hero rated on a scale of `maximum`, or undefined when it has no rating. */
export function heroDifficultyBand(hero: OrderedHero, maximum: number): DifficultyBand | undefined {
  return typeof hero.difficulty === "number" ? difficultyBand(difficultyLevel(hero.difficulty, maximum)) : undefined
}

function runsBy<Hero extends OrderedHero>(
  heroes: readonly Hero[],
  keyOf: (hero: Hero) => string,
  labelOf: (key: string) => string | null,
  labelKind: "letter" | "word",
) {
  const runs: HeroRun<Hero>[] = []
  for (const hero of heroes) {
    const key = keyOf(hero)
    const last = runs.at(-1)
    if (last?.key === key) last.heroes.push(hero)
    else runs.push({ key, label: labelOf(key), labelKind, heroes: [hero] })
  }
  return runs
}

/**
 * The library in runs for one order. Heroes the order cannot place (no rating, no ranking) close the list in a run of
 * their own, labelled by `unplaced`. Names are ordered and filed as the reader sees them, not by their codes.
 */
export function heroRuns<Hero extends OrderedHero>(
  heroes: readonly Hero[],
  sort: HeroSort,
  options: {
    standings: ReadonlyMap<string, HeroStanding>
    difficultyMaximum: number
    bandLabel: (band: DifficultyBand) => string
    unplaced: string
    /** The reader's language, which orders the names. */
    locale: string
  },
): HeroRun<Hero>[] {
  const byName = nameOrder(options.locale)
  const alphabetical = [...heroes].sort(byName)
  if (sort === "name")
    return runsBy(
      alphabetical,
      (hero) => heroNameLetter(hero.name),
      (key) => key,
      "letter",
    )

  if (sort === "difficulty") {
    const band = (hero: Hero) => heroDifficultyBand(hero, options.difficultyMaximum)
    const order: DifficultyBand[] = ["easy", "medium", "hard"]
    const placed = alphabetical
      .filter((hero) => band(hero))
      .sort((a, b) => (a.difficulty ?? 0) - (b.difficulty ?? 0) || byName(a, b))
    const runs = runsBy(
      placed.sort((a, b) => order.indexOf(band(a)!) - order.indexOf(band(b)!)),
      (hero) => band(hero)!,
      (key) => options.bandLabel(key as DifficultyBand),
      "word",
    )
    return withUnplaced(
      runs,
      alphabetical.filter((hero) => !band(hero)),
      options.unplaced,
    )
  }

  const standing = (hero: Hero) => options.standings.get(hero.id)
  if (sort === "tier") {
    const placed = alphabetical
      .filter((hero) => standing(hero)?.tier)
      .sort(
        (a, b) =>
          tierRank(standing(a)?.tier) - tierRank(standing(b)?.tier) ||
          (standing(b)?.winRate ?? 0) - (standing(a)?.winRate ?? 0) ||
          byName(a, b),
      )
    const runs = runsBy(
      placed,
      (hero) => standing(hero)!.tier!.trim().toUpperCase(),
      (key) => key,
      "letter",
    )
    return withUnplaced(
      runs,
      alphabetical.filter((hero) => !standing(hero)?.tier),
      options.unplaced,
    )
  }

  const placed = alphabetical
    .filter((hero) => typeof standing(hero)?.winRate === "number")
    .sort((a, b) => standing(b)!.winRate! - standing(a)!.winRate! || byName(a, b))
  const runs: HeroRun<Hero>[] = placed.length ? [{ key: "ranked", label: null, labelKind: "word", heroes: placed }] : []
  return withUnplaced(
    runs,
    alphabetical.filter((hero) => typeof standing(hero)?.winRate !== "number"),
    options.unplaced,
  )
}

function withUnplaced<Hero>(runs: HeroRun<Hero>[], unplaced: Hero[], label: string) {
  return unplaced.length ? [...runs, { key: "unplaced", label, labelKind: "word" as const, heroes: unplaced }] : runs
}
