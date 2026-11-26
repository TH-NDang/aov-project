import type { CSSProperties } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { FoldButton } from "../../../components/fold-button"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText, score } from "../../../lib/feed-words"
import type { Question } from "../../../lib/finder-model"
import { heroTeams, tally, type HeroRecord, type HeroTeam } from "../../../lib/hero-model"
import { namedPlayers } from "../../../lib/hero-page-model"
import { namesOf } from "../../../lib/question-words"
import { statsHref } from "../../../lib/statistics-routes"
import { useFold } from "../../../lib/use-fold"
import { useWidth } from "../../../lib/use-width"
import { cellUnit, GameCells } from "./game-marks"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./hero-teams.css"

type Props = { data: StatsData; record: HeroRecord }
type ListProps = { data: StatsData; hero: HeroRecord["hero"]; teams: HeroTeam[] }
type RowProps = { data: StatsData; hero: HeroRecord["hero"]; team: HeroTeam }

/** Where the list is narrower a team takes two lines, its cells under its name. */
const NARROW = 480
/** Teams listed before the reader asks for all of them; fewer where each takes two lines. */
const PLAYING = 10
const PLAYING_NARROW = 5
const BANNING = 10
/** The fewest games the longest bar of bans stands for, so that a single ban is a short one. */
const LEAST_SCALE = 6
/** In two lines the crest and the record stand beside the cells; in one the name and the players need most of it. */
const BESIDE_NARROW = 116
const WIDEST_CELLS = 190
const CELLS_SHARE = 0.34
/** The room between two cells, which a cell of the list takes with it. */
const CELL_GAP = 1.5

/** Who played the hero for a team, each with the games played; on a wide layout each name opens them. */
function Players({ data, hero, team }: RowProps) {
  const { text, languageTag } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const names = namesOf(data.view, text)
  const { named, unknown } = namedPlayers(team, data.view.content.players)
  if (!named.length) return <span>{text("chưa rõ tuyển thủ", "players unknown")}</span>
  return (
    <>
      {named.map(({ playerId, games }, index) => {
        const player = `${names.player(playerId)} ${games.toLocaleString(languageTag)}`
        const comma = index < named.length - 1 || unknown > 0 ? "," : ""
        return (
          <span key={playerId}>
            {compact ? (
              player
            ) : (
              <Link
                to={statsHref(data.view.id, {
                  question: { team: team.teamId, pick: [hero], player: playerId },
                  scope: data.period?.key,
                })}
              >
                {player}
                <span className="sr-only">{text(" ván", games === 1 ? " game" : " games")}</span>
              </Link>
            )}
            {comma}{" "}
          </span>
        )
      })}
      {unknown > 0 && <span>{text(`chưa rõ ${unknown}`, `unknown ${unknown}`)}</span>}
    </>
  )
}

/** A team and what it won and lost with the hero; the line opens those games. */
function PlayRow({ data, hero, team, unit, longest }: RowProps & { unit: number; longest: number }) {
  const { text, languageTag } = useStreamLocale()
  const club = data.view.content.teams[team.teamId]
  const name = namesOf(data.view, text).team(team.teamId)
  const { wins, losses } = tally(team.picks.map(({ won }) => won))
  const games = gamesText(team.picks.length, text, languageTag)
  return (
    <li className="tn-hh-team">
      <span aria-hidden="true">
        <StreamImage src={club?.logoUrl} darkSrc={club?.logoDarkUrl} logo name={name} />
      </span>
      <span className="tn-hh-team-who">
        <Link
          to={statsHref(data.view.id, {
            question: { team: team.teamId, pick: [hero] },
            scope: data.period?.key,
          })}
          aria-label={text(
            `${name} chơi ${hero.name}: ${games}, thắng ${wins}, thua ${losses}`,
            `${name} played ${hero.name}: ${games}, won ${wins}, lost ${losses}`,
          )}
        >
          {name}
        </Link>{" "}
        <Players data={data} hero={hero} team={team} />
      </span>
      <span className="tn-hh-team-cells">
        <GameCells wins={wins} losses={losses} unit={unit} whole={longest} />
      </span>
      <b aria-hidden="true">{score({ wins, losses })}</b>
    </li>
  )
}

/** The teams that play the hero, the one that plays it most first. */
function PlayList({ data, hero, teams }: ListProps) {
  const { text } = useStreamLocale()
  const { ref, width } = useWidth<HTMLUListElement>()
  const narrow = width < NARROW
  const fold = useFold(teams, narrow ? PLAYING_NARROW : PLAYING, `plays:${hero.key}`)
  const longest = Math.max(...teams.map(({ picks }) => picks.length))
  const room = narrow ? width - BESIDE_NARROW : Math.min(WIDEST_CELLS, width * CELLS_SHARE)
  const unit = cellUnit(longest, room)
  const cells = unit < 3 ? room : longest * (unit + CELL_GAP)
  return (
    <>
      <ul className="tn-hh-plays" ref={ref} style={{ "--cells": `${Math.max(0, cells)}px` } as CSSProperties}>
        {fold.rows.map((team) => (
          <PlayRow key={team.teamId} data={data} hero={hero} team={team} unit={unit} longest={longest} />
        ))}
      </ul>
      <FoldButton fold={fold} more={text(`Xem cả ${teams.length} đội`, `Show all ${teams.length} teams`)} />
    </>
  )
}

/** A team in the middle of two bars: the games it banned the hero in, and those the hero was banned against it in. */
function BanRow({ data, hero, team, most }: RowProps & { most: number }) {
  const { text, languageTag } = useStreamLocale()
  const name = namesOf(data.view, text).team(team.teamId)
  const scope = data.period?.key
  const half = (key: "own" | "against", count: number, question: Partial<Question>, label: string) => {
    const content = (
      <>
        <span>{count.toLocaleString(languageTag)}</span>
        <i style={{ "--share": count / most } as CSSProperties} aria-hidden="true" />
      </>
    )
    return count > 0 ? (
      <Link data-half={key} to={statsHref(data.view.id, { question, scope })} aria-label={label}>
        {content}
      </Link>
    ) : (
      <span data-half={key}>{content}</span>
    )
  }
  const [own, against] = [team.bans, team.bannedAgainst].map((count) => gamesText(count, text, languageTag))
  return (
    <li className="tn-hh-ban">
      {half(
        "own",
        team.bans,
        { team: team.teamId, banA: [hero] },
        text(`${name} cấm ${hero.name}: ${own}`, `${name} banned ${hero.name}: ${own}`),
      )}
      <Link data-team="" to={statsHref(data.view.id, { part: "teams", team: team.teamId, scope })}>
        {name}
      </Link>
      {half(
        "against",
        team.bannedAgainst,
        { team: team.teamId, banB: [hero] },
        text(`${hero.name} bị cấm khi gặp ${name}: ${against}`, `${hero.name} banned against ${name}: ${against}`),
      )}
    </li>
  )
}

/** The teams that ban the hero or meet its bans, the one that bans it most first. */
function BanList({ data, hero, teams }: ListProps) {
  const { text } = useStreamLocale()
  const fold = useFold(teams, BANNING, `bans:${hero.key}`)
  const most = Math.max(LEAST_SCALE, ...teams.flatMap(({ bans, bannedAgainst }) => [bans, bannedAgainst]))
  return (
    <>
      <p className="tn-hh-ban-heads" aria-hidden="true">
        <span>{text("đội này cấm", "banned by the team")}</span>
        <span>{text("bị cấm khi gặp đội này", "banned against the team")}</span>
      </p>
      <ul className="tn-hh-bans">
        {fold.rows.map((team) => (
          <BanRow key={team.teamId} data={data} hero={hero} team={team} most={most} />
        ))}
      </ul>
      <FoldButton fold={fold} more={text(`Xem cả ${teams.length} đội`, `Show all ${teams.length} teams`)} />
    </>
  )
}

/** The teams that play a hero with who plays it for them, and beside them the teams that ban it and meet its bans. */
export function HeroTeams({ data, record }: Props) {
  const { text } = useStreamLocale()
  const teams = heroTeams(record)
  const playing = teams.filter(({ picks }) => picks.length > 0)
  const banning = teams
    .filter(({ bans, bannedAgainst }) => bans + bannedAgainst > 0)
    .sort((x, y) => y.bans - x.bans || y.bannedAgainst - x.bannedAgainst)
  if (!teams.length) return null
  return (
    <div className="tn-hh-sides" data-alone={!playing.length || !banning.length || undefined}>
      {playing.length > 0 && (
        <Section
          title={text("Đội nào chơi", "Who plays it")}
          note={text("mỗi vạch một ván, vạch cao là thắng", "one mark a game, tall ones won")}
        >
          <PlayList data={data} hero={record.hero} teams={playing} />
        </Section>
      )}
      {banning.length > 0 && (
        <Section title={text("Đội nào cấm", "Who bans it")}>
          <BanList data={data} hero={record.hero} teams={banning} />
        </Section>
      )}
    </div>
  )
}
