import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type {
  CompetitionStage,
  CompetitionView,
  Lane,
  RosterMembershipContent,
  TournamentAward,
} from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-lane-icon"
import { LocalMoney, LocalPrizeText } from "@aov/ui/components/local-money"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { StreamImage } from "../../components/stream-image"
import { useStreamLocale } from "../../components/stream-locale"
import { dayRange, hueOf } from "../../components/community-ui"
import { EntityPageLink } from "../../components/public-competitions"
import { CompetitionLogo, StatusBadge } from "../../components/competition-card"
import {
  bracketLanes,
  champion,
  codeName,
  COMPETITION_TYPE_NAMES,
  competitionStatus,
  matchStrip,
  playedOrder,
  STAGE_FORMAT_NAMES,
  TIER_NAMES,
  VENUE_MODE_NAMES,
} from "../../lib/competition-model"
import { CompetitionSchedule } from "./competition-schedule"
import { CompetitionCrew, TeamStaff } from "./competition-people"
import { MatchCard } from "../../components/match-card"
import { awardTeam } from "../../lib/crew-model"
import { competitionMatches, type CompetitionMatch } from "../../lib/match-model"
import { competitionQuery } from "../../lib/tournament-api"
import { LANE_NAMES } from "../../lib/tournament-model"

/** The tabs of a competition, each named in Vietnamese and in English. */
const TABS = [
  ["overview", ["Tổng quan", "Overview"]],
  ["matches", ["Lịch & kết quả", "Schedule & results"]],
  ["standings", ["BXH & nhánh đấu", "Standings & bracket"]],
  ["teams", ["Đội tham dự", "Participating teams"]],
] as const
type Tab = (typeof TABS)[number][0]

const LANE_ORDER: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
const ROSTER_ORDER = ["ACTIVE", "SUBSTITUTE", "UNKNOWN", "INACTIVE"]
const hue = (name: string) => ({ "--hub-hue": hueOf(name) }) as CSSProperties

export function PublicCompetitionPage() {
  const { text, languageTag } = useStreamLocale()
  const { id = "" } = useParams()
  const query = useQuery(competitionQuery(id))
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab")
  // The bracket stands on the standings tab, so `?tab=bracket` opens that tab.
  const tab: Tab = requested === "bracket" ? "standings" : (TABS.find(([key]) => key === requested)?.[0] ?? "overview")
  const tabButtons = useRef(new Map<Tab, HTMLButtonElement>())
  const focusTab = useRef<Tab | null>(null)
  useEffect(() => {
    if (focusTab.current !== tab) return
    focusTab.current = null
    tabButtons.current.get(tab)?.focus()
  }, [tab])
  const openTab = (next: Tab) => {
    focusTab.current = next
    setTab(next)
  }
  const setTab = (next: Tab) =>
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (next === "overview") updated.delete("tab")
      else updated.set("tab", next)
      // Filters of the schedule belong to that tab only.
      for (const key of ["scope", "stage", "team", "date"]) if (next !== "matches") updated.delete(key)
      return updated
    })
  if (!query.data)
    return (
      <StreamShell>
        <Link className="cp-back" to="/competitions">
          <StreamIcon name="back" size={16} />
          {text("Tất cả giải đấu", "All tournaments")}
        </Link>
        <div className="hub-state" role={query.isError ? "alert" : "status"}>
          <h1>{query.isError ? query.error.message : text("Đang tải giải đấu…", "Loading tournament…")}</h1>
          {query.isLoadingError && (
            <button className="cp-button" onClick={() => void query.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          )}
        </div>
      </StreamShell>
    )
  const view = query.data
  const { tournament, plan, teams, circuit } = view.content
  const matches = competitionMatches([view])
  const won = champion(tournament, teams)
  const status = competitionStatus(view.content)
  const kicker = [tournament.region, codeName(TIER_NAMES, tournament.tier, text)].filter(Boolean).join(" · ")
  return (
    <StreamShell>
      <title>{`${tournament.name} — AOV Stream`}</title>
      <div className="cp-container tn-comp">
        <Link className="cp-back" to="/competitions">
          <StreamIcon name="back" size={16} />
          {text("Tất cả giải đấu", "All tournaments")}
        </Link>
        <header className="tn-comp-head hub-art" style={hue(tournament.name)}>
          <CompetitionLogo name={tournament.name} url={tournament.logoUrl} className="tn-logo-large" />
          <div className="tn-comp-title">
            <span className="hub-kicker">
              {circuit ? (
                <Link to={`/pages/${circuit.code}`}>{circuit.name}</Link>
              ) : (
                plan.circuit || text("Giải đấu", "Tournament")
              )}
              {kicker && ` · ${kicker}`}
            </span>
            <h1>{tournament.name}</h1>
            <div className="hub-banner-stats">
              <StatusBadge status={status} tone="banner" />
              <span>
                <StreamIcon name="calendar" size={14} />
                {dayRange(tournament.startsOn, tournament.endsOn)}
              </span>
              {plan.entrants.length > 0 && (
                <span>
                  <StreamIcon name="users" size={14} />
                  {text(
                    `${plan.entrants.length} đội`,
                    `${plan.entrants.length} ${plan.entrants.length === 1 ? "team" : "teams"}`,
                  )}
                </span>
              )}
              {plan.prizePool && (
                <span>
                  <StreamIcon name="trophy" size={14} />
                  <LocalPrizeText
                    text={plan.prizePool}
                    currency={plan.currency}
                    on={tournament.endsOn ?? tournament.startsOn}
                    locale={languageTag}
                  />
                </span>
              )}
            </div>
          </div>
          {won && (
            <div className="tn-champion">
              <small>{text("Nhà vô địch", "Champion")}</small>
              <span className="tn-champion-team">
                <StreamImage src={"logoUrl" in won.winner ? won.winner.logoUrl : undefined} name={won.winner.name} />
                <strong>{won.winner.name}</strong>
              </span>
              {won.runnerUp && (
                <span>
                  {won.score
                    ? text(`Thắng ${won.score} trước `, `Won ${won.score} against `)
                    : text("Á quân: ", "Runner-up: ")}
                  {won.runnerUp.name}
                </span>
              )}
            </div>
          )}
        </header>
        <nav className="cp-tabs" aria-label={text("Nội dung giải đấu", "Tournament content")}>
          {TABS.map(([key, label]) => (
            <button
              key={key}
              ref={(button) => {
                if (button) tabButtons.current.set(key, button)
                else tabButtons.current.delete(key)
              }}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
              {text(label[0], label[1])}
            </button>
          ))}
        </nav>
        {tab === "overview" && <Overview view={view} matches={matches} openTab={openTab} />}
        {tab === "matches" && <CompetitionSchedule entries={matches} />}
        {tab === "standings" && <Standings view={view} matches={matches} />}
        {tab === "teams" && <Teams view={view} />}
      </div>
    </StreamShell>
  )
}

/** A section of the competition page: a title, an optional link to the tab that has all of it, then the content. */
function Block({
  title,
  note,
  more,
  children,
}: {
  title: string
  note?: ReactNode
  more?: { label: string; open: () => void }
  children: ReactNode
}) {
  return (
    <section className="tn-block">
      <div className="tn-heading">
        <h2>
          {title} {note && <small>{note}</small>}
        </h2>
        {more && (
          <button type="button" onClick={more.open}>
            {more.label}
            <StreamIcon name="arrow" size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

/** The main stage of each kind: the table with the most matches and the last elimination stage played. */
function mainStages(view: CompetitionView) {
  const { plan, standings } = view.content
  const count = (code: string) => plan.matches.filter((match) => match.stageCode === code).length
  const table = [...standings].sort((a, b) => count(b.stageCode) - count(a.stageCode))[0]
  const knockout = playedOrder(plan.stages, plan.matches)
    .filter((stage) => stage.format !== "ROUND_ROBIN" && count(stage.code) > 0)
    .at(-1)
  return { table, knockout }
}

/**
 * What a reader wants first: the matches around now, where the table stands, how the knockout went, and the facts of
 * the competition beside them. The other tabs hold each of these in full.
 */
function Overview({
  view,
  matches,
  openTab,
}: {
  view: CompetitionView
  matches: CompetitionMatch[]
  openTab: (tab: Tab) => void
}) {
  const { text } = useStreamLocale()
  const { plan, standings } = view.content
  const { table, knockout } = mainStages(view)
  const strip = matchStrip(matches, Date.now(), 4, 4)
  const ahead = strip.filter((entry) => entry.result?.scoreA == null)
  const shown = (ahead.length ? ahead : strip).slice(0, 4)
  const empty = !shown.length && !table && !knockout
  return (
    <div className="tn-overview">
      <div className="tn-overview-main">
        {empty && (
          <div className="hub-state">
            <h2>{text("Lịch thi đấu chưa được công bố", "The schedule has not been announced")}</h2>
            <p>
              {text(
                "Trận đấu và bảng xếp hạng sẽ xuất hiện tại đây khi ban tổ chức công bố.",
                "Matches and standings will appear here once the organizer announces them.",
              )}
            </p>
            {plan.entrants.length > 0 && (
              <button type="button" className="cp-button" onClick={() => openTab("teams")}>
                {text(`Xem ${plan.entrants.length} đội tham dự`, `See the ${plan.entrants.length} teams taking part`)}
              </button>
            )}
          </div>
        )}
        {shown.length > 0 && (
          <Block
            title={ahead.length ? text("Sắp diễn ra", "Upcoming") : text("Trận gần nhất", "Latest matches")}
            more={{ label: text("Lịch & kết quả", "Schedule & results"), open: () => openTab("matches") }}
          >
            <div className="tn-match-grid">
              {shown.map((entry) => (
                <MatchCard key={entry.match.key} entry={entry} />
              ))}
            </div>
          </Block>
        )}
        {table && (
          <Block
            title={text("Bảng xếp hạng", "Standings")}
            note={plan.stages.find((stage) => stage.code === table.stageCode)?.name}
            more={
              table.rows.length > 10 || standings.length > 1
                ? { label: text("Xem đầy đủ", "See all"), open: () => openTab("standings") }
                : undefined
            }
          >
            <StandingsTable view={view} table={table} limit={10} />
          </Block>
        )}
        {knockout && (
          <Block title={text("Nhánh đấu", "Bracket")} note={knockout.name}>
            <Bracket stage={knockout} matches={matches} />
          </Block>
        )}
      </div>
      <aside className="tn-overview-side">
        <Facts view={view} />
        <Format view={view} />
        <Awards view={view} />
        <CompetitionCrew view={view} />
      </aside>
    </div>
  )
}

function Standings({ view, matches }: { view: CompetitionView; matches: CompetitionMatch[] }) {
  const { text } = useStreamLocale()
  const { plan } = view.content
  const stages = playedOrder(plan.stages, plan.matches)
  const position = (code: string) => stages.findIndex((stage) => stage.code === code)
  const standings = [...view.content.standings].sort((a, b) => position(a.stageCode) - position(b.stageCode))
  const knockouts = stages.filter(
    (stage) => stage.format !== "ROUND_ROBIN" && plan.matches.some((match) => match.stageCode === stage.code),
  )
  if (!standings.length && !knockouts.length)
    return (
      <div className="hub-state">
        <h2>{text("Giải chưa có bảng xếp hạng hoặc nhánh đấu", "The tournament has no standings or bracket yet")}</h2>
      </div>
    )
  return (
    <div className="tn-stack">
      {standings.map((table) => (
        <Block
          key={table.stageCode}
          title={
            plan.stages.find((stage) => stage.code === table.stageCode)?.name ?? text("Bảng xếp hạng", "Standings")
          }
          note={table.complete ? text("Đã hoàn tất", "Final") : text("Tạm tính", "Provisional")}
        >
          <StandingsTable view={view} table={table} />
        </Block>
      ))}
      {knockouts.map((stage) => (
        <Block key={stage.code} title={stage.name} note={codeName(STAGE_FORMAT_NAMES, stage.format, text)}>
          <Bracket stage={stage} matches={matches} />
        </Block>
      ))}
    </div>
  )
}

function StandingsTable({
  view,
  table,
  limit,
}: {
  view: CompetitionView
  table: CompetitionView["content"]["standings"][number]
  limit?: number
}) {
  const { text } = useStreamLocale()
  const { teams } = view.content
  const rows = limit ? table.rows.slice(0, limit) : table.rows
  const anyQualified = table.rows.some((row) => row.qualified)
  return (
    <div className="tn-table-wrap">
      <table className="tn-table">
        <thead>
          <tr>
            <th scope="col" className="tn-rank">
              #
            </th>
            <th scope="col">{text("Đội", "Team")}</th>
            <th scope="col" className="tn-wide-only">
              {text("Trận", "Matches")}
            </th>
            <th scope="col">
              <abbr title={text("Trận thắng – trận thua", "Matches won – lost")}>{text("T–B", "W–L")}</abbr>
            </th>
            <th scope="col" className="tn-wide-only">
              <abbr title={text("Ván thắng – ván thua", "Games won – lost")}>{text("Ván", "Games")}</abbr>
            </th>
            <th scope="col">
              <abbr title={text("Hiệu số ván", "Game difference")}>HS</abbr>
            </th>
            <th scope="col">{text("Điểm", "Points")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const team = teams[row.teamId]
            const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
            const difference = row.gameWins - row.gameLosses
            return (
              <tr key={row.teamId} data-qualified={row.qualified || undefined}>
                <td className="tn-rank">
                  {row.rank}
                  {row.tied && <span title={text("Đồng hạng", "Tied")}>=</span>}
                  {row.qualified && (
                    <span className="sr-only">{text(", đã giành suất đi tiếp", ", secured a spot to advance")}</span>
                  )}
                </td>
                <th scope="row">
                  <span className="tn-team">
                    <StreamImage src={team?.logoUrl} name={team?.shortName || name} />
                    <EntityPageLink kind="TEAM" id={row.teamId} name={name} />
                  </span>
                </th>
                <td className="tn-wide-only">{row.played}</td>
                <td>
                  {row.won}–{row.lost}
                </td>
                <td className="tn-wide-only">
                  {row.gameWins}–{row.gameLosses}
                </td>
                <td>{difference > 0 ? `+${difference}` : difference}</td>
                <td>
                  <strong>{row.points}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {anyQualified && (
        <p className="tn-table-note">
          <i aria-hidden="true" />
          {text("Đã giành suất đi tiếp", "Secured a spot to advance")}
        </p>
      )}
    </div>
  )
}

/** The lanes of a double elimination, in Vietnamese and in English. */
const LANE_TITLES = {
  upper: ["Nhánh thắng", "Upper bracket"],
  lower: ["Nhánh thua", "Lower bracket"],
  final: ["Chung kết tổng", "Grand final"],
} as const

/**
 * An elimination stage read from left to right. Rounds share their columns across the lanes, so a match of the lower
 * lane stands under the upper-lane round played at the same point, and the final closes the row on its own.
 */
function Bracket({ stage, matches }: { stage: CompetitionStage; matches: CompetitionMatch[] }) {
  const { text } = useStreamLocale()
  const entries = matches.filter((entry) => entry.match.stageCode === stage.code)
  const byKey = new Map(entries.map((entry) => [entry.match.key, entry]))
  const lanes = bracketLanes(entries.map((entry) => entry.match))
  const rounds = [...new Set(entries.map((entry) => entry.match.round))].sort((a, b) => a - b)
  const laned = lanes.some((lane) => lane.key !== "rounds")
  return (
    <div
      className="tn-bracket"
      tabIndex={0}
      role="group"
      aria-label={text(`Nhánh đấu ${stage.name}`, `${stage.name} bracket`)}
    >
      <div
        className="tn-bracket-grid"
        data-laned={laned || undefined}
        style={{ "--bracket-rounds": rounds.length } as CSSProperties}
      >
        {lanes.map((lane) =>
          lane.rounds.map(({ round, matches: list }, index) => {
            const column = rounds.indexOf(round)
            return (
              <Fragment key={`${lane.key}:${round}`}>
                {!laned && (
                  <h3 className="tn-bracket-title" style={{ gridColumn: column + 1 }}>
                    {rounds.length > 1 && column === rounds.length - 1 && list.length === 1
                      ? text("Chung kết", "Final")
                      : text(`Vòng ${column + 1}`, `Round ${column + 1}`)}
                  </h3>
                )}
                <div className="tn-bracket-round" data-lane={lane.key} style={{ gridColumn: column + 1 }}>
                  {laned && index === 0 && (
                    <h3 className="tn-bracket-title">{text(...LANE_TITLES[lane.key as "upper"])}</h3>
                  )}
                  {list.map((match) => (
                    <MatchCard key={match.key} entry={byKey.get(match.key)!} brief final={lane.key === "final"} />
                  ))}
                </div>
              </Fragment>
            )
          }),
        )}
      </div>
    </div>
  )
}

function Teams({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const { tournament, plan, teams, players, rosters, people } = view.content
  if (!plan.entrants.length)
    return (
      <div className="hub-state">
        <h2>{text("Chưa có đội tham dự được công bố", "No participating teams published yet")}</h2>
      </div>
    )
  const order = (row: RosterMembershipContent) =>
    ROSTER_ORDER.indexOf(row.status ?? "UNKNOWN") * 10 + (row.lane ? LANE_ORDER.indexOf(row.lane) : 9)
  const withoutRoster = plan.entrants.filter((entrant) => !rosters.some((row) => row.teamId === entrant.teamId)).length
  return (
    <div className="tn-stack">
      {withoutRoster > 0 && (
        <p className="cp-muted">
          {withoutRoster === plan.entrants.length
            ? text("Đội hình của các đội chưa được công bố.", "The teams' rosters have not been published yet.")
            : text(
                `${withoutRoster} trong ${plan.entrants.length} đội chưa công bố đội hình.`,
                `${withoutRoster} of ${plan.entrants.length} teams have not published a roster yet.`,
              )}
        </p>
      )}
      <div className="tn-team-grid">
        {plan.entrants.map((entrant) => {
          const team = teams[entrant.teamId]
          const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
          const roster = rosters.filter((row) => row.teamId === entrant.teamId).sort((a, b) => order(a) - order(b))
          return (
            <section className="tn-team-card" key={entrant.teamId}>
              <h2>
                <StreamImage src={team?.logoUrl} name={team?.shortName || name} />
                <EntityPageLink kind="TEAM" id={entrant.teamId} name={name} />
                {entrant.status === "WITHDRAWN" && <span className="cp-badge">{text("Đã rút lui", "Withdrawn")}</span>}
              </h2>
              {roster.length > 0 && (
                <ul>
                  {roster.map((row) => (
                    <li key={row.playerId} data-bench={(row.status && row.status !== "ACTIVE") || undefined}>
                      <span
                        className="tn-lane"
                        title={
                          row.lane
                            ? text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1])
                            : text("Chưa rõ vị trí", "Unknown position")
                        }
                      >
                        {row.lane ? (
                          <HeroLaneIcon
                            lane={row.lane}
                            size={18}
                            label={text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1])}
                          />
                        ) : (
                          "?"
                        )}
                      </span>
                      <EntityPageLink
                        kind="PLAYER"
                        id={row.playerId}
                        name={players[row.playerId]?.nickname || text("Tuyển thủ", "Player")}
                      />
                      <small>
                        {row.status === "SUBSTITUTE"
                          ? text("Dự bị", "Substitute")
                          : row.status === "INACTIVE"
                            ? text("Không thi đấu", "Inactive")
                            : row.status === "ACTIVE"
                              ? row.lane
                                ? text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1])
                                : ""
                              : text("Chưa xác nhận", "Unconfirmed")}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
              <TeamStaff staff={tournament.staff} teamId={entrant.teamId} people={people} />
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Facts({ view }: { view: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament, plan, organizer } = view.content
  const venues = plan.venues.filter((venue) => venue.name || venue.city)
  const rows: [string, ReactNode][] = [
    [
      text("Đơn vị tổ chức", "Organizer"),
      organizer ? (
        <Link className="cp-organizer" to={`/pages/${organizer.code}`}>
          {organizer.logoUrl && <img src={organizer.logoUrl} alt="" />}
          {organizer.name}
        </Link>
      ) : (
        plan.organizer
      ),
    ],
    [
      text("Quỹ giải thưởng", "Prize pool"),
      plan.prizePool && (
        <LocalPrizeText
          text={plan.prizePool}
          currency={plan.currency}
          on={tournament.endsOn ?? tournament.startsOn}
          locale={languageTag}
        />
      ),
    ],
    [
      text("Hình thức", "Format"),
      [
        codeName(COMPETITION_TYPE_NAMES, tournament.competitionType, text),
        codeName(VENUE_MODE_NAMES, tournament.venueMode, text),
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      text("Địa điểm", "Venue"),
      venues.length > 0 &&
        venues.map((venue, index) => <div key={index}>{[venue.name, venue.city].filter(Boolean).join(", ")}</div>),
    ],
    [text("Múi giờ của lịch", "Schedule time zone"), plan.timezone],
  ]
  const links = [
    ...(tournament.links ?? []),
    ...(plan.sourceUrl && !(tournament.links ?? []).some((link) => link.url === plan.sourceUrl)
      ? [{ label: text("Nguồn kiểm chứng", "Verification source"), url: plan.sourceUrl }]
      : []),
  ]
  return (
    <section className="tn-side-card">
      <h2>{text("Thông tin", "Information")}</h2>
      <dl className="tn-facts">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {links.length > 0 && (
        <ul className="tn-links">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noreferrer noopener">
                {link.label}
                <StreamIcon name="external" size={13} />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="cp-meta">
        {text("Cập nhật:", "Updated:")} <LocalTime value={view.publishedAt} locale={languageTag} />
      </p>
    </section>
  )
}

/** The rules that order teams level on points, in Vietnamese and in English. */
const TIE_BREAKERS: Record<string, readonly [string, string]> = {
  HEAD_TO_HEAD: ["đối đầu", "head-to-head"],
  GAME_DIFF: ["hiệu số ván", "game difference"],
  GAME_WINS: ["số ván thắng", "game wins"],
}

function Format({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const { plan } = view.content
  if (!plan.stages.length) return null
  return (
    <section className="tn-side-card">
      <h2>{text("Thể thức", "Format")}</h2>
      <ol className="tn-stages">
        {playedOrder(plan.stages, plan.matches).map((stage) => (
          <li key={stage.code}>
            <strong>{stage.name}</strong>
            <span>
              {[
                codeName(STAGE_FORMAT_NAMES, stage.format, text) ?? text("Lịch riêng", "Custom schedule"),
                `BO${stage.bestOf}`,
                stage.format === "ROUND_ROBIN" && stage.legs > 1 && text(`${stage.legs} lượt`, `${stage.legs} legs`),
                stage.format === "ROUND_ROBIN" &&
                  stage.advance > 0 &&
                  text(
                    `${stage.advance} đội đi tiếp`,
                    `${stage.advance} ${stage.advance === 1 ? "team advances" : "teams advance"}`,
                  ),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {stage.format === "ROUND_ROBIN" && stage.tieBreakers.length > 0 && (
              <small>
                {text("Xếp hạng phụ:", "Tiebreakers:")}{" "}
                {stage.tieBreakers.map((rule) => (TIE_BREAKERS[rule] ? text(...TIE_BREAKERS[rule]) : rule)).join(" → ")}
              </small>
            )}
            {stage.patchNote && <small>{stage.patchNote}</small>}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Awards grouped by title, since a weekly award names several players. The first few show; the rest unfold. */
function Awards({ view }: { view: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament, teams } = view.content
  const [open, setOpen] = useState(false)
  const groups = new Map<string, TournamentAward[]>()
  for (const award of tournament.awards ?? []) groups.set(award.title, [...(groups.get(award.title) ?? []), award])
  if (!groups.size) return null
  const all = [...groups]
  const shown = open ? all : all.slice(0, 4)
  return (
    <section className="tn-side-card">
      <h2>{text("Giải thưởng cá nhân", "Individual awards")}</h2>
      <dl className="tn-awards">
        {shown.map(([title, awards]) => (
          <div key={title}>
            <dt>{title}</dt>
            {awards.map((award, index) => {
              const team = awardTeam(award, teams)
              return (
                <dd key={index}>
                  <strong>
                    {award.playerId ? (
                      <EntityPageLink kind="PLAYER" id={award.playerId} name={award.recipientName} />
                    ) : (
                      award.recipientName
                    )}
                  </strong>
                  {team && (
                    <span>{team.id ? <EntityPageLink kind="TEAM" id={team.id} name={team.name} /> : team.name}</span>
                  )}
                  {(award.prizeUsd != null || award.prizeLocal != null) && (
                    <LocalMoney
                      amounts={[
                        { amount: award.prizeUsd, currency: "USD" },
                        { amount: award.prizeLocal, currency: tournament.localCurrency },
                      ]}
                      on={tournament.endsOn ?? tournament.startsOn}
                      locale={languageTag}
                      compact
                    />
                  )}
                </dd>
              )
            })}
          </div>
        ))}
      </dl>
      {all.length > 4 && (
        <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open
            ? text("Thu gọn", "Show less")
            : text(
                `Xem thêm ${all.length - 4} giải thưởng`,
                `Show ${all.length - 4} more ${all.length - 4 === 1 ? "award" : "awards"}`,
              )}
        </button>
      )}
    </section>
  )
}
