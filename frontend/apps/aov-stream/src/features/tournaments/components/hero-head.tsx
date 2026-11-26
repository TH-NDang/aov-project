import { Link } from "react-router"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { GoLink } from "../../../components/go-link"
import { Stage } from "../../../components/stage"
import { useStreamLocale } from "../../../components/stream-locale"
import { WIKI_URL } from "../../../components/stream-shell"
import { gamesText, laneName } from "../../../lib/feed-words"
import { laneCounts, type HeroRecord } from "../../../lib/hero-model"
import { verdict, type HeroFate } from "../../../lib/hero-page-model"
import { statsHref } from "../../../lib/statistics-routes"
import { wikiEntryUrl } from "../../../lib/wiki-links"
import { FateBar, FateLegend } from "./fate-bar"
import { HeroPortrait } from "./hero-portrait"
import type { StatsData } from "./stats-data"
import "./hero-head.css"

type Props = { data: StatsData; record: HeroRecord; fate: HeroFate }

/** Where the numbers of a hero lead: the games it was picked and banned in, and of those picked the won and the lost. */
function waysOf({ view, period }: StatsData, { hero }: HeroRecord) {
  const scope = period?.key
  const asked = (won: boolean) => statsHref(view.id, { question: { pick: [hero], won }, scope })
  return {
    picks: statsHref(view.id, { hero, list: "picks", scope }),
    bans: statsHref(view.id, { hero, list: "bans", scope }),
    won: asked(true),
    lost: asked(false),
  }
}

/** The lanes a hero was played in, the usual one first; each opens its games there. */
function Lanes({ data, record }: Omit<Props, "fate">) {
  const { text, languageTag } = useStreamLocale()
  const lanes = laneCounts(record.picks)
  if (!lanes.length) return null
  return (
    <ul className="tn-hh-lanes">
      {lanes.map(({ lane, games }) => (
        <li key={lane}>
          <Link
            to={statsHref(data.view.id, { question: { pick: [record.hero], lane }, scope: data.period?.key })}
            title={laneName(lane, text)}
            aria-label={`${laneName(lane, text)}: ${gamesText(games, text, languageTag)}`}
          >
            <HeroLaneIcon lane={lane} size={15} />
            <span>{laneName(lane, text)}</span>
            <b>{games.toLocaleString(languageTag)}</b>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Words of a sentence that never part from the number beside them. */
const glued = (words: string) => words.replace(/^ | $/g, "\u00a0")

/** What became of the hero, in a sentence whose numbers open the games they count. */
function Verdict({ data, record, fate }: Props) {
  const { text, languageTag } = useStreamLocale()
  const to = waysOf(data, record)
  return (
    <p className="tn-hh-verdict">
      {verdict(fate, record.hero.name, text).map((part, index) =>
        typeof part === "string" ? (
          glued(part)
        ) : part.count > 0 ? (
          <Link key={index} to={to[part.of]}>
            {part.count.toLocaleString(languageTag)}
          </Link>
        ) : (
          <b key={index}>{part.count}</b>
        ),
      )}
    </p>
  )
}

/** What became of the hero as one bar, each part of which opens the games it counts. */
function FateDoors({ data, record, fate }: Props) {
  const { text, languageTag } = useStreamLocale()
  const to = waysOf(data, record)
  const [won, lost, banned] = [fate.wins, fate.losses, fate.bans].map((count) => gamesText(count, text, languageTag))
  return (
    <div className="tn-hh-fate">
      <FateBar
        fate={fate}
        numbers
        links={{
          won: { to: to.won, label: text(`${won} thắng`, `Won ${won}`) },
          lost: { to: to.lost, label: text(`${lost} thua`, `Lost ${lost}`) },
          banned: { to: to.bans, label: text(`${banned} bị cấm`, `Banned in ${banned}`) },
        }}
      />
    </div>
  )
}

/**
 * A hero on its stage: its name, which leads to the Wiki, the lanes it was played in, and what became of it, in a
 * sentence and as a bar as long as all games counted.
 */
export function HeroHead({ data, record, fate }: Props) {
  const { text, languageTag } = useStreamLocale()
  const { hero } = record
  const games = gamesText(fate.games, text, languageTag)
  return (
    <Stage tint={hero.name} lights={[{ src: hero.iconUrl, at: "left" }]} shaded className="tn-hh">
      <span className="tn-hh-art">
        <HeroPortrait hero={hero} />
      </span>
      <div className="tn-hh-name">
        <h2>
          {hero.code ? (
            <GoLink to={wikiEntryUrl(WIKI_URL, "heroes", { id: hero.id ?? hero.code, code: hero.code }, languageTag)}>
              {hero.name}
            </GoLink>
          ) : (
            hero.name
          )}
        </h2>
        <Lanes data={data} record={record} />
      </div>
      <Verdict data={data} record={record} fate={fate} />
      <FateDoors data={data} record={record} fate={fate} />
      <div className="tn-hh-foot">
        <FateLegend counted={fate} />
        <p>{text(`cả thanh là ${games}`, `the whole bar is ${games}`)}</p>
      </div>
    </Stage>
  )
}
