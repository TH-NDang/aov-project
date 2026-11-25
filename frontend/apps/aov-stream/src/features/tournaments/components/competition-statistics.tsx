import { useDeferredValue, useState, type CSSProperties } from "react"
import { Link } from "react-router"
import type { CompetitionStatistics, CompetitionView } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { EntityPageLink } from "../../../components/go-link"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  enoughPicks,
  heroHref,
  heroLeaders,
  heroLines,
  percent,
  sortHeroes,
  type HeroLine,
  type HeroSort,
} from "../../../lib/statistics-model"
import { clock } from "../../../lib/tournament-model"
import { HeroGames } from "./hero-games"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import "./competition-statistics.css"

/** Heroes listed before the reader scrolls for more. */
const HEROES = 30

/**
 * What the published games of a competition add up to: the heroes that lead it, how the two sides and the length of
 * games came out, every hero in a table, and the players with the most MVPs. `hero` opens the games of one hero.
 */
export function CompetitionStatisticsTab({
  view,
  statistics,
  hero,
}: {
  view: CompetitionView
  statistics: CompetitionStatistics
  hero: string | null
}) {
  const { text } = useStreamLocale()
  const lines = heroLines(statistics)
  const chosen = hero ? lines.find((line) => line.id === hero) : undefined
  if (chosen) return <HeroGames competitionId={view.id} hero={chosen} heroes={lines} games={statistics.games} />
  return (
    <div className="tn-stats">
      <Leaders view={view} lines={lines} games={statistics.games} />
      <div className="tn-stats-figures">
        <Sides statistics={statistics} />
        <Lengths statistics={statistics} />
      </div>
      <div className="tn-stats-body">
        <Heroes view={view} lines={lines} games={statistics.games} />
        {statistics.mvps.length > 0 && (
          <aside>
            <Section title={text("MVP nhiều nhất", "Most MVPs")}>
              <Mvps view={view} statistics={statistics} />
            </Section>
          </aside>
        )}
      </div>
    </div>
  )
}

/** The three heroes a competition is remembered by, on one stage lit by their own pictures. */
function Leaders({ view, lines, games }: { view: CompetitionView; lines: HeroLine[]; games: number }) {
  const { text } = useStreamLocale()
  const { picked, banned, winning } = heroLeaders(lines, games)
  const rate = (line: HeroLine) => `${percent(line.wins, line.picks)}%`
  const shown = [
    picked && {
      hero: picked,
      title: text("Chọn nhiều nhất", "Most picked"),
      value: text(`${picked.picks} ván`, `${picked.picks} games`),
      note: text(`thắng ${rate(picked)}`, `won ${rate(picked)}`),
    },
    banned && {
      hero: banned,
      title: text("Cấm nhiều nhất", "Most banned"),
      value: text(`${banned.bans} lượt`, `${banned.bans} bans`),
      note: text(`${percent(banned.bans, games)}% số ván`, `${percent(banned.bans, games)}% of games`),
    },
    winning && {
      hero: winning,
      title: text("Thắng nhiều nhất", "Highest win rate"),
      value: rate(winning),
      note: text(`trong ${winning.picks} ván`, `of ${winning.picks} games`),
    },
  ].filter((leader) => !!leader)
  if (!shown.length) return null
  const ends = ["left", "center", "right"] as const
  return (
    <Stage
      tint={view.content.tournament.name}
      lights={shown.map(({ hero }, at) => ({ src: hero.iconUrl, at: ends[at]! }))}
      className="tn-leaders"
    >
      {shown.map(({ hero, title, value, note }) => {
        const content = (
          <>
            <HeroPortrait hero={hero} />
            <span className="tn-leader-text">
              <span>{title}</span>
              <strong>{hero.name}</strong>
              <span>
                <b>{value}</b>
                {note}
              </span>
            </span>
          </>
        )
        return hero.id ? (
          <Link key={title} className="tn-leader" to={heroHref(view.id, hero)}>
            {content}
          </Link>
        ) : (
          <div key={title} className="tn-leader">
            {content}
          </div>
        )
      })}
    </Stage>
  )
}

/** How often each side won, as two parts of one bar. */
function Sides({ statistics: { decided, blueWins } }: { statistics: CompetitionStatistics }) {
  const { text } = useStreamLocale()
  if (!decided) return null
  const blue = percent(blueWins, decided)
  return (
    <section className="tn-figure" aria-labelledby="stats-sides">
      <h3 id="stats-sides">{text("Bên nào thắng nhiều hơn", "Which side won more")}</h3>
      <div className="tn-figure-sides" aria-hidden="true">
        <span data-side="BLUE" style={{ "--part": blueWins } as CSSProperties} />
        <span data-side="RED" style={{ "--part": decided - blueWins } as CSSProperties} />
      </div>
      <p>
        <span data-side="BLUE">
          <i aria-hidden="true" />
          {text("Bên xanh", "Blue side")} <b>{blue}%</b>
          <small>{text(`${blueWins} ván`, `${blueWins} games`)}</small>
        </span>
        <span data-side="RED">
          <i aria-hidden="true" />
          {text("Bên đỏ", "Red side")} <b>{100 - blue}%</b>
          <small>{text(`${decided - blueWins} ván`, `${decided - blueWins} games`)}</small>
        </span>
      </p>
    </section>
  )
}

/** The length of games on one scale: the shortest, the average and the longest, the two ends open their games. */
function Lengths({ statistics: { averageSeconds, shortest, longest } }: { statistics: CompetitionStatistics }) {
  const { text } = useStreamLocale()
  if (!averageSeconds || !shortest || !longest) return null
  const span = longest.seconds - shortest.seconds
  return (
    <section
      className="tn-figure"
      aria-labelledby="stats-length"
      style={{ "--average": span > 0 ? (averageSeconds - shortest.seconds) / span : 0.5 } as CSSProperties}
    >
      <h3 id="stats-length">{text("Một ván kéo dài bao lâu", "How long a game lasts")}</h3>
      <div className="tn-figure-length" aria-hidden="true">
        <span />
      </div>
      <p className="tn-figure-ends">
        <Link to={`/games/${shortest.id}`}>
          <small>{text("Nhanh nhất", "Shortest")}</small> <b>{clock(shortest.seconds)}</b>
        </Link>
        <span>
          <small>{text("Trung bình", "Average")}</small> <b>{clock(averageSeconds)}</b>
        </span>
        <Link to={`/games/${longest.id}`}>
          <small>{text("Dài nhất", "Longest")}</small> <b>{clock(longest.seconds)}</b>
        </Link>
      </p>
    </section>
  )
}

/** Every hero that was picked or banned, with how its games ended as one bar and the same in numbers. */
function Heroes({ view, lines, games }: { view: CompetitionView; lines: HeroLine[]; games: number }) {
  const { text, languageTag } = useStreamLocale()
  const [sort, setSort] = useState<HeroSort>("presence")
  const [q, setQ] = useState("")
  const search = useDeferredValue(foldSearchText(q.trim()))
  const found = sortHeroes(lines, sort, games).filter((line) => !search || foldSearchText(line.name).includes(search))
  const { rows, loader } = useRevealedRows(found, `${sort}:${search}`, HEROES)
  const most = Math.max(1, ...lines.map((line) => line.presence))
  const columns: [HeroSort, string][] = [
    ["presence", text("Có mặt", "Presence")],
    ["picks", text("Chọn", "Picked")],
    ["wins", text("Thắng", "Won")],
    ["bans", text("Cấm", "Banned")],
  ]
  return (
    <Section
      title={text("Các tướng", "Heroes")}
      note={text(
        `${lines.length} tướng trong ${games.toLocaleString(languageTag)} ván`,
        `${lines.length} heroes in ${games.toLocaleString(languageTag)} games`,
      )}
    >
      <div className="tn-heroes-bar">
        <label className="tn-heroes-search">
          <StreamIcon name="search" size={16} />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={text("Tìm tướng", "Find a hero")}
            aria-label={text("Tìm tướng", "Find a hero")}
          />
        </label>
        <ul className="tn-heroes-legend">
          <li data-part="won">{text("chọn và thắng", "picked and won")}</li>
          <li data-part="lost">{text("chọn và thua", "picked and lost")}</li>
          <li data-part="banned">{text("bị cấm", "banned")}</li>
        </ul>
      </div>
      {found.length ? (
        <table className="tn-heroes">
          <thead>
            <tr>
              <th scope="col">{text("Tướng", "Hero")}</th>
              {columns.map(([key, name]) => (
                <th key={key} scope="col" aria-sort={sort === key ? "descending" : "none"}>
                  <button type="button" onClick={() => setSort(key)}>
                    {name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((line) => (
              <HeroRow key={line.key} competitionId={view.id} line={line} games={games} most={most} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="tn-heroes-none">{text("Không có tướng nào mang tên này.", "No hero goes by that name.")}</p>
      )}
      {sort === "wins" && (
        <p className="tn-heroes-none">
          {text(
            `Tướng có dưới ${enoughPicks(games)} lượt chọn xếp sau.`,
            `Heroes picked fewer than ${enoughPicks(games)} times come last.`,
          )}
        </p>
      )}
      <InfiniteScroll
        query={loader}
        label={text("Đang tải thêm tướng", "Loading more heroes")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </Section>
  )
}

function HeroRow({
  competitionId,
  line,
  games,
  most,
}: {
  competitionId: string
  line: HeroLine
  games: number
  most: number
}) {
  const { text } = useStreamLocale()
  const { id, name, picks, wins, bans, presence } = line
  const parts = { "--won": wins / most, "--lost": (picks - wins) / most, "--banned": bans / most } as CSSProperties
  return (
    <tr data-linked={id ? "" : undefined}>
      <th scope="row">
        <HeroPortrait hero={line} />
        {id ? <Link to={heroHref(competitionId, line)}>{name}</Link> : <span>{name}</span>}
      </th>
      <td data-column="presence">
        <span
          className="tn-hero-bar"
          style={parts}
          title={text(
            `${wins} thắng, ${picks - wins} thua, ${bans} cấm`,
            `${wins} won, ${picks - wins} lost, ${bans} banned`,
          )}
        >
          <i data-part="won" />
          <i data-part="lost" />
          <i data-part="banned" />
        </span>
        <b>{percent(presence, games)}%</b>
      </td>
      <td data-column="picks">{picks}</td>
      <td data-column="wins">
        {picks > 0 ? (
          <>
            <b>{percent(wins, picks)}%</b>
            <small>
              {wins}–{picks - wins}
            </small>
          </>
        ) : (
          <span aria-hidden="true">–</span>
        )}
      </td>
      <td data-column="bans">
        <span className="tn-heroes-ban" title={text("Lượt cấm", "Bans")}>
          <StreamIcon name="ban" size={14} />
        </span>
        {bans}
      </td>
    </tr>
  )
}

/** The players named the best of a game most often, with the team they played for. */
function Mvps({ view, statistics: { mvps } }: { view: CompetitionView; statistics: CompetitionStatistics }) {
  const { text } = useStreamLocale()
  const { players, rosters, teams } = view.content
  return (
    <ol className="tn-mvps">
      {mvps.map(({ playerId, games }) => {
        const player = players[playerId]
        const teamId = rosters.find((row) => row.playerId === playerId)?.teamId
        const team = teamId ? teams[teamId] : undefined
        if (!player) return null
        return (
          <li key={playerId}>
            <StreamImage
              src={team?.logoUrl}
              darkSrc={team?.logoDarkUrl}
              logo
              name={team?.shortName || player.nickname}
            />
            <span>
              <strong>
                <EntityPageLink kind="PLAYER" id={playerId} name={player.nickname} />
              </strong>
              {team && <span>{team.name}</span>}
            </span>
            <b>{text(`${games} ván`, `${games} ${games === 1 ? "game" : "games"}`)}</b>
          </li>
        )
      })}
    </ol>
  )
}
