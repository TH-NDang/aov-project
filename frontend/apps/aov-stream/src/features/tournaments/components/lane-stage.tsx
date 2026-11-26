import { useMemo } from "react"
import { Link } from "react-router"
import type { Lane } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { Stage } from "../../../components/stage"
import { useStreamLocale } from "../../../components/stream-locale"
import { laneHeroes, type LaneHero } from "../../../lib/facts-model"
import { gamesText, laneName, shownText } from "../../../lib/feed-words"
import { heroLine, sortLines, type HeroLine } from "../../../lib/hero-model"
import { heroesHref, playsLane } from "../../../lib/heroes-view"
import { statsHref } from "../../../lib/statistics-routes"
import { LANES } from "../../../lib/tournament-model"
import { cellUnit, GameCells } from "./game-marks"
import { HeroPortrait } from "./hero-portrait"
import type { StatsData } from "./stats-data"
import "./lane-stage.css"

/** Heroes of each lane on the stage, and the heroes in the row of bans. */
const PLAYED = 5
const BANNED = 10

/** The ends of the stage are lit by the first hero of the first lane, of the middle one and of the last. */
const LIGHTS = [
  ["left", 0],
  ["center", 2],
  ["right", 4],
] as const

/**
 * The heroes played most in each of the five lanes, with what they won there, on a stage lit by their own pictures;
 * under a line the heroes banned most. A hero leads to its page, its number to the games the number counts.
 */
export function LaneStage({ data }: { data: StatsData }) {
  const { text } = useStreamLocale()
  const games = data.feed.games.length
  const { played, banned } = useMemo(() => {
    const lanes = laneHeroes(data.records.values())
    const lines = [...data.records.values()].map(heroLine)
    return {
      played: LANES.flatMap((lane) => {
        const heroes = lanes.get(lane) ?? []
        return heroes.length ? [{ lane, heroes, all: lines.filter((line) => playsLane(line, lane)).length }] : []
      }),
      banned: sortLines(
        lines.filter((line) => line.bans > 0),
        "bans",
        games,
      ).slice(0, BANNED),
    }
  }, [data.records, games])
  if (!played.length && !banned.length) return null
  const most = Math.max(1, ...played.map(({ heroes }) => heroes[0]!.games))
  return (
    <Stage
      tint={data.view.content.tournament.name}
      lights={LIGHTS.map(([at, index]) => ({ src: played[index]?.heroes[0]?.hero.iconUrl, at }))}
      shaded
      className="tn-lanes"
    >
      <h2 className="sr-only">
        {played.length
          ? text("Tướng được chơi nhiều nhất ở mỗi đường", "The heroes played most in each lane")
          : text("Tướng bị cấm nhiều nhất", "The heroes banned most")}
      </h2>
      {played.length > 0 && (
        <div className="tn-lanes-row">
          {played.map(({ lane, heroes, all }) => (
            <LaneList key={lane} data={data} lane={lane} heroes={heroes.slice(0, PLAYED)} all={all} most={most} />
          ))}
        </div>
      )}
      {banned.length > 0 && <Bans data={data} banned={banned} alone={!played.length} />}
    </Stage>
  )
}

function LaneList({
  data,
  lane,
  heroes,
  all,
  most,
}: {
  data: StatsData
  lane: Lane
  heroes: LaneHero[]
  all: number
  most: number
}) {
  const { text } = useStreamLocale()
  return (
    <section className="tn-lanes-lane">
      <h3>
        <HeroLaneIcon lane={lane} size={18} />
        {laneName(lane, text)}
      </h3>
      <ol>
        {heroes.map((item, at) => (
          <LaneRow key={item.hero.key} data={data} lane={lane} item={item} lead={at === 0} most={most} />
        ))}
      </ol>
      {all > heroes.length && (
        <Link className="tn-lanes-all" to={heroesHref(data.view.id, { lane }, data.period?.key)}>
          {text(`Cả ${all} tướng`, `All ${all} heroes`)}
        </Link>
      )}
    </section>
  )
}

function LaneRow({
  data,
  lane,
  item: { hero, games, wins, losses },
  lead,
  most,
}: {
  data: StatsData
  lane: Lane
  item: LaneHero
  lead: boolean
  most: number
}) {
  const { text, languageTag } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const scope = data.period?.key
  const played = gamesText(games, text, languageTag)
  const won =
    wins + losses > 0 && text(`thắng ${wins.toLocaleString(languageTag)}`, `won ${wins.toLocaleString(languageTag)}`)
  const figures = [played, won].filter(Boolean).join(", ")
  return (
    <li data-lead={lead || undefined}>
      <Link className="tn-lanes-hero" to={statsHref(data.view.id, { hero, scope })}>
        <HeroPortrait hero={hero} />
        <strong>{hero.name}</strong>
      </Link>
      <Link
        className="tn-lanes-games"
        to={statsHref(data.view.id, { question: { pick: [hero], lane }, scope })}
        aria-label={`${hero.name}, ${laneName(lane, text)}: ${figures}`}
      >
        {lead ? (
          <>
            <span>{figures}</span>
            {won && (
              <GameCells
                wins={wins}
                losses={losses}
                unit={cellUnit(most, compact ? 110 : 120)}
                whole={most}
                height={10}
              />
            )}
          </>
        ) : (
          <>
            <b>{played}</b>
            {won && <span>{won}</span>}
          </>
        )}
      </Link>
    </li>
  )
}

/** The heroes banned most; each leads to the games it was banned in. */
function Bans({ data, banned, alone }: { data: StatsData; banned: HeroLine[]; alone: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const only = shownText(data.counted, text)
  const shown = gamesText(data.counted.shown, text, languageTag)
  return (
    <section className="tn-lanes-bans" data-alone={alone || undefined}>
      <h3>
        {text("Bị cấm nhiều nhất", "Banned most")}
        {only && <small>{text(`trong ${shown}${only}`, `in ${shown}${only}`)}</small>}
      </h3>
      <ol>
        {banned.map(({ hero, bans }) => (
          <li key={hero.key}>
            <Link
              to={statsHref(data.view.id, { hero, list: "bans", scope: data.period?.key })}
              aria-label={text(
                `${hero.name}: bị cấm ${gamesText(bans, text, languageTag)}`,
                `${hero.name}: banned in ${gamesText(bans, text, languageTag)}`,
              )}
              title={hero.name}
            >
              <HeroPortrait hero={hero} banned />
              <b>{bans.toLocaleString(languageTag)}</b>
              <span className="tn-lanes-ban-name">{hero.name}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
