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
import { competitionStatus, dayRange, hueOf } from "../community/community-ui"
import { EntityPageLink } from "../community/public-competitions"
import { CompetitionLogo, StatusBadge } from "./competition-card"
import {
  bracketLanes,
  champion,
  competitionTypeLabels,
  matchStrip,
  playedOrder,
  stageFormatLabels,
  tierLabels,
  venueModeLabels,
} from "./competition-model"
import { CompetitionSchedule } from "./competition-schedule"
import { MatchCard } from "./match-card"
import { competitionMatches, type CompetitionMatch } from "./match-model"
import { competitionQuery } from "./tournament-api"
import { LANES } from "./tournament-model"

const TABS = [
  ["overview", "Tổng quan"],
  ["matches", "Lịch & kết quả"],
  ["standings", "BXH & nhánh đấu"],
  ["teams", "Đội tham dự"],
] as const
type Tab = (typeof TABS)[number][0]

const LANE_ORDER: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
const ROSTER_ORDER = ["ACTIVE", "SUBSTITUTE", "UNKNOWN", "INACTIVE"]
const hue = (name: string) => ({ "--hub-hue": hueOf(name) }) as CSSProperties

export function PublicCompetitionPage() {
  const { id = "" } = useParams()
  const query = useQuery(competitionQuery(id))
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab")
  // "bracket" is an address from before the table and the bracket shared a tab.
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
          Tất cả giải đấu
        </Link>
        <div className="hub-state" role={query.isError ? "alert" : "status"}>
          <h1>{query.isError ? query.error.message : "Đang tải giải đấu…"}</h1>
          {query.isLoadingError && (
            <button className="cp-button" onClick={() => void query.refetch()}>
              Thử lại
            </button>
          )}
        </div>
      </StreamShell>
    )
  const view = query.data
  const { tournament, plan, teams, circuit } = view.content
  const matches = competitionMatches([view])
  const won = champion(tournament, teams)
  const status = competitionStatus(tournament)
  const kicker = [tournament.region, tournament.tier && tierLabels[tournament.tier]].filter(Boolean).join(" · ")
  return (
    <StreamShell>
      <title>{`${tournament.name} — AOV Stream`}</title>
      <div className="cp-container tn-comp">
        <Link className="cp-back" to="/competitions">
          <StreamIcon name="back" size={16} />
          Tất cả giải đấu
        </Link>
        <header className="tn-comp-head hub-art" style={hue(tournament.name)}>
          <CompetitionLogo name={tournament.name} url={tournament.logoUrl} className="tn-logo-large" />
          <div className="tn-comp-title">
            <span className="hub-kicker">
              {circuit ? <Link to={`/pages/${circuit.code}`}>{circuit.name}</Link> : plan.circuit || "Giải đấu"}
              {kicker && ` · ${kicker}`}
            </span>
            <h1>{tournament.name}</h1>
            <div className="hub-banner-stats">
              <StatusBadge status={status} />
              <span>
                <StreamIcon name="calendar" size={14} />
                {dayRange(tournament.startsOn, tournament.endsOn)}
              </span>
              {plan.entrants.length > 0 && (
                <span>
                  <StreamIcon name="users" size={14} />
                  {plan.entrants.length} đội
                </span>
              )}
              {plan.prizePool && (
                <span>
                  <StreamIcon name="trophy" size={14} />
                  <LocalPrizeText
                    text={plan.prizePool}
                    currency={plan.currency}
                    on={tournament.endsOn ?? tournament.startsOn}
                  />
                </span>
              )}
            </div>
          </div>
          {won && (
            <div className="tn-champion">
              <small>Nhà vô địch</small>
              <span className="tn-champion-team">
                <StreamImage src={"logoUrl" in won.winner ? won.winner.logoUrl : undefined} name={won.winner.name} />
                <strong>{won.winner.name}</strong>
              </span>
              {won.runnerUp && (
                <span>
                  {won.score ? `Thắng ${won.score} trước ` : "Á quân: "}
                  {won.runnerUp.name}
                </span>
              )}
            </div>
          )}
        </header>
        <nav className="cp-tabs" aria-label="Nội dung giải đấu">
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
              {label}
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
            <h3>Lịch thi đấu chưa được công bố</h3>
            <p>Trận đấu và bảng xếp hạng sẽ xuất hiện tại đây khi ban tổ chức công bố.</p>
            {plan.entrants.length > 0 && (
              <button type="button" className="cp-button" onClick={() => openTab("teams")}>
                Xem {plan.entrants.length} đội tham dự
              </button>
            )}
          </div>
        )}
        {shown.length > 0 && (
          <Block
            title={ahead.length ? "Sắp diễn ra" : "Trận gần nhất"}
            more={{ label: "Lịch & kết quả", open: () => openTab("matches") }}
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
            title="Bảng xếp hạng"
            note={plan.stages.find((stage) => stage.code === table.stageCode)?.name}
            more={
              table.rows.length > 10 || standings.length > 1
                ? { label: "Xem đầy đủ", open: () => openTab("standings") }
                : undefined
            }
          >
            <StandingsTable view={view} table={table} limit={10} />
          </Block>
        )}
        {knockout && (
          <Block title="Nhánh đấu" note={knockout.name}>
            <Bracket stage={knockout} matches={matches} />
          </Block>
        )}
      </div>
      <aside className="tn-overview-side">
        <Facts view={view} />
        <Format view={view} />
        <Awards view={view} />
      </aside>
    </div>
  )
}

function Standings({ view, matches }: { view: CompetitionView; matches: CompetitionMatch[] }) {
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
        <h3>Giải chưa có bảng xếp hạng hoặc nhánh đấu</h3>
      </div>
    )
  return (
    <div className="tn-stack">
      {standings.map((table) => (
        <Block
          key={table.stageCode}
          title={plan.stages.find((stage) => stage.code === table.stageCode)?.name ?? "Bảng xếp hạng"}
          note={table.complete ? "Đã hoàn tất" : "Tạm tính"}
        >
          <StandingsTable view={view} table={table} />
        </Block>
      ))}
      {knockouts.map((stage) => (
        <Block key={stage.code} title={stage.name} note={stageFormatLabels[stage.format]}>
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
            <th scope="col">Đội</th>
            <th scope="col" className="tn-wide-only">
              Trận
            </th>
            <th scope="col">
              <abbr title="Trận thắng – trận thua">T–B</abbr>
            </th>
            <th scope="col" className="tn-wide-only">
              <abbr title="Ván thắng – ván thua">Ván</abbr>
            </th>
            <th scope="col">
              <abbr title="Hiệu số ván">HS</abbr>
            </th>
            <th scope="col">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const team = teams[row.teamId]
            const name = team?.name || "Đội chưa có thông tin"
            const difference = row.gameWins - row.gameLosses
            return (
              <tr key={row.teamId} data-qualified={row.qualified || undefined}>
                <td className="tn-rank">
                  {row.rank}
                  {row.tied && <span title="Đồng hạng">=</span>}
                  {row.qualified && <span className="sr-only">, đã giành suất đi tiếp</span>}
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
          Đã giành suất đi tiếp
        </p>
      )}
    </div>
  )
}

const LANE_TITLES = { upper: "Nhánh thắng", lower: "Nhánh thua", final: "Chung kết tổng" } as const

/**
 * An elimination stage read from left to right. Rounds share their columns across the lanes, so a match of the lower
 * lane stands under the upper-lane round played at the same point, and the final closes the row on its own.
 */
function Bracket({ stage, matches }: { stage: CompetitionStage; matches: CompetitionMatch[] }) {
  const entries = matches.filter((entry) => entry.match.stageCode === stage.code)
  const byKey = new Map(entries.map((entry) => [entry.match.key, entry]))
  const lanes = bracketLanes(entries.map((entry) => entry.match))
  const rounds = [...new Set(entries.map((entry) => entry.match.round))].sort((a, b) => a - b)
  const laned = lanes.some((lane) => lane.key !== "rounds")
  return (
    <div className="tn-bracket" tabIndex={0} role="group" aria-label={`Nhánh đấu ${stage.name}`}>
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
                      ? "Chung kết"
                      : `Vòng ${column + 1}`}
                  </h3>
                )}
                <div className="tn-bracket-round" data-lane={lane.key} style={{ gridColumn: column + 1 }}>
                  {laned && index === 0 && <h3 className="tn-bracket-title">{LANE_TITLES[lane.key as "upper"]}</h3>}
                  {list.map((match) => (
                    <MatchCard key={match.key} entry={byKey.get(match.key)!} brief />
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
  const { plan, teams, players, rosters } = view.content
  if (!plan.entrants.length)
    return (
      <div className="hub-state">
        <h3>Chưa có đội tham dự được công bố</h3>
      </div>
    )
  const order = (row: RosterMembershipContent) =>
    ROSTER_ORDER.indexOf(row.status ?? "UNKNOWN") * 10 + (row.lane ? LANE_ORDER.indexOf(row.lane) : 9)
  const withoutRoster = plan.entrants.filter((entrant) => !rosters.some((row) => row.teamId === entrant.teamId)).length
  return (
    <div className="tn-stack">
      {withoutRoster > 0 && (
        <p className="cp-muted tn-teams-note">
          {withoutRoster === plan.entrants.length
            ? "Đội hình của các đội chưa được công bố."
            : `${withoutRoster} trong ${plan.entrants.length} đội chưa công bố đội hình.`}
        </p>
      )}
      <div className="tn-team-grid">
        {plan.entrants.map((entrant) => {
          const team = teams[entrant.teamId]
          const name = team?.name || "Đội chưa có thông tin"
          const roster = rosters.filter((row) => row.teamId === entrant.teamId).sort((a, b) => order(a) - order(b))
          return (
            <section className="tn-team-card" key={entrant.teamId}>
              <h2>
                <StreamImage src={team?.logoUrl} name={team?.shortName || name} />
                <EntityPageLink kind="TEAM" id={entrant.teamId} name={name} />
                {entrant.status === "WITHDRAWN" && <span className="cp-badge">Đã rút lui</span>}
              </h2>
              {roster.length > 0 && (
                <ul>
                  {roster.map((row) => (
                    <li key={row.playerId} data-bench={(row.status && row.status !== "ACTIVE") || undefined}>
                      <span className="tn-lane" title={row.lane ? LANES[row.lane] : "Chưa rõ vị trí"}>
                        {row.lane ? <HeroLaneIcon lane={row.lane} size={18} label={LANES[row.lane]} /> : "?"}
                      </span>
                      <EntityPageLink
                        kind="PLAYER"
                        id={row.playerId}
                        name={players[row.playerId]?.nickname || "Tuyển thủ"}
                      />
                      <small>
                        {row.status === "SUBSTITUTE"
                          ? "Dự bị"
                          : row.status === "INACTIVE"
                            ? "Không thi đấu"
                            : row.status === "ACTIVE"
                              ? row.lane
                                ? LANES[row.lane]
                                : ""
                              : "Chưa xác nhận"}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Facts({ view }: { view: CompetitionView }) {
  const { tournament, plan, organizer } = view.content
  const venues = plan.venues.filter((venue) => venue.name || venue.city)
  const rows: [string, ReactNode][] = [
    [
      "Đơn vị tổ chức",
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
      "Quỹ giải thưởng",
      plan.prizePool && (
        <LocalPrizeText text={plan.prizePool} currency={plan.currency} on={tournament.endsOn ?? tournament.startsOn} />
      ),
    ],
    [
      "Hình thức",
      [
        tournament.competitionType && competitionTypeLabels[tournament.competitionType],
        tournament.venueMode && venueModeLabels[tournament.venueMode],
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      "Địa điểm",
      venues.length > 0 &&
        venues.map((venue, index) => <div key={index}>{[venue.name, venue.city].filter(Boolean).join(", ")}</div>),
    ],
    ["Múi giờ của lịch", plan.timezone],
  ]
  const links = [
    ...(tournament.links ?? []),
    ...(plan.sourceUrl && !(tournament.links ?? []).some((link) => link.url === plan.sourceUrl)
      ? [{ label: "Nguồn kiểm chứng", url: plan.sourceUrl }]
      : []),
  ]
  return (
    <section className="tn-side-card">
      <h2>Thông tin</h2>
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
        Cập nhật: <LocalTime value={view.publishedAt} />
      </p>
    </section>
  )
}

const TIE_BREAKERS: Record<string, string> = {
  HEAD_TO_HEAD: "đối đầu",
  GAME_DIFF: "hiệu số ván",
  GAME_WINS: "số ván thắng",
}

function Format({ view }: { view: CompetitionView }) {
  const { plan } = view.content
  if (!plan.stages.length) return null
  return (
    <section className="tn-side-card">
      <h2>Thể thức</h2>
      <ol className="tn-stages">
        {playedOrder(plan.stages, plan.matches).map((stage) => (
          <li key={stage.code}>
            <strong>{stage.name}</strong>
            <span>
              {[
                stageFormatLabels[stage.format] ?? "Lịch riêng",
                `BO${stage.bestOf}`,
                stage.format === "ROUND_ROBIN" && stage.legs > 1 && `${stage.legs} lượt`,
                stage.format === "ROUND_ROBIN" && stage.advance > 0 && `${stage.advance} đội đi tiếp`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {stage.format === "ROUND_ROBIN" && stage.tieBreakers.length > 0 && (
              <small>Xếp hạng phụ: {stage.tieBreakers.map((rule) => TIE_BREAKERS[rule] || rule).join(" → ")}</small>
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
  const { tournament } = view.content
  const [open, setOpen] = useState(false)
  const groups = new Map<string, TournamentAward[]>()
  for (const award of tournament.awards ?? []) groups.set(award.title, [...(groups.get(award.title) ?? []), award])
  if (!groups.size) return null
  const all = [...groups]
  const shown = open ? all : all.slice(0, 4)
  return (
    <section className="tn-side-card">
      <h2>Giải thưởng cá nhân</h2>
      <dl className="tn-awards">
        {shown.map(([title, awards]) => (
          <div key={title}>
            <dt>{title}</dt>
            {awards.map((award, index) => (
              <dd key={index}>
                <strong>
                  {award.playerId ? (
                    <EntityPageLink kind="PLAYER" id={award.playerId} name={award.recipientName} />
                  ) : (
                    award.recipientName
                  )}
                </strong>
                {award.teamName && <span>{award.teamName}</span>}
                {(award.prizeUsd != null || award.prizeLocal != null) && (
                  <LocalMoney
                    amounts={[
                      { amount: award.prizeUsd, currency: "USD" },
                      { amount: award.prizeLocal, currency: tournament.localCurrency },
                    ]}
                    on={tournament.endsOn ?? tournament.startsOn}
                    compact
                  />
                )}
              </dd>
            ))}
          </div>
        ))}
      </dl>
      {all.length > 4 && (
        <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Thu gọn" : `Xem thêm ${all.length - 4} giải thưởng`}
        </button>
      )}
    </section>
  )
}
