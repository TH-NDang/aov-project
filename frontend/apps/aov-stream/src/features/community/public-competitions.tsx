import type { CSSProperties } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { type CommunityProfile, type CompetitionView, type PageSlice } from "@aov/community-contracts"
import { LocalPrizeText } from "@aov/ui/components/local-money"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import {
  competitionStatus,
  competitionStatusLabels,
  competitionsFeedQuery,
  dayRange,
  hueOf,
  type CompetitionStatus,
} from "./community-ui"
import { competitionQuery } from "../tournaments/tournament-api"
import { MatchRow } from "../tournaments/match-components"
import { competitionMatches, competitionMatchHref } from "../tournaments/match-model"
import { CompetitionSchedule } from "../tournaments/competition-schedule"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { LocalTime } from "@aov/ui/components/local-time"
import { nextPageOf } from "@aov/ui/lib/page-slice"

const hue = (name: string) => ({ "--hub-hue": hueOf(name) }) as CSSProperties
const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]!.toUpperCase())
    .join("")

function StatusBadge({ status }: { status: CompetitionStatus | null }) {
  // The status names are read in the reader's language, so the badge follows a change of language.
  useStreamLocale()
  return status ? (
    <span className="hub-status" data-status={status}>
      {competitionStatusLabels()[status]}
    </span>
  ) : null
}

export function CompetitionList({ profile }: { profile?: CommunityProfile }) {
  const { text } = useStreamLocale()
  const filter: Record<string, string> = profile
    ? profile.kind === "CIRCUIT"
      ? { circuitPageId: profile.id }
      : profile.kind === "ORGANIZATION"
        ? { organizerPageId: profile.id }
        : profile.kind === "TEAM"
          ? { teamId: profile.entityId || "" }
          : { playerId: profile.entityId || "" }
    : {}
  const query = useInfiniteQuery(competitionsFeedQuery(filter))
  const competitions = query.data?.pages.flatMap((page) => page.items) ?? []
  const body = query.isPending ? (
    <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải giải đấu", "Loading tournaments")} />
  ) : query.isLoadingError ? (
    <div className="hub-state" role="alert">
      <StreamIcon name="reset" size={28} />
      <h3>{query.error.message}</h3>
      <button className="cp-button" onClick={() => void query.refetch()}>
        {text("Thử lại", "Retry")}
      </button>
    </div>
  ) : !competitions.length ? (
    <div className="hub-state">
      <StreamIcon name="calendar" size={28} />
      <h3>
        {profile?.kind === "CIRCUIT"
          ? text("Chưa có mùa giải được công bố", "No seasons published yet")
          : text("Chưa có giải đã công bố", "No tournaments published yet")}
      </h3>
      <p>
        {text(
          "Lịch và thông tin sẽ xuất hiện khi được biên tập xong.",
          "The schedule and information will appear once they have been edited.",
        )}
      </p>
    </div>
  ) : (
    <>
      <div className="hub-event-list">
        {competitions.map((entry) => (
          <CompetitionEvent key={entry.id} entry={entry} />
        ))}
      </div>
      <InfiniteScroll
        query={query}
        label={text("Đang tải thêm giải đấu", "Loading more tournaments")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </>
  )
  if (!profile) return body
  return (
    <section className="cp-section">
      <h2>
        {profile.kind === "CIRCUIT"
          ? text("Các mùa giải", "Seasons")
          : profile.kind === "ORGANIZATION"
            ? text("Giải đấu tổ chức", "Tournaments organized")
            : text("Giải đấu đã tham gia", "Tournaments played")}
      </h2>
      {profile.kind === "ORGANIZATION" && (
        <p className="cp-meta">
          {text(
            "Các mùa giải đã công bố có liên kết với tổ chức này.",
            "Published seasons linked to this organization.",
          )}
        </p>
      )}
      {body}
    </section>
  )
}

export function CompetitionEvent({ entry }: { entry: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament, plan } = entry.content
  return (
    <Link className="hub-event" to={`/competitions/${entry.id}`}>
      <span className="hub-event-cover hub-art" style={hue(tournament.name)}>
        {tournament.logoUrl ? <img src={tournament.logoUrl} alt="" /> : <b>{monogram(tournament.name)}</b>}
        <StatusBadge status={competitionStatus(tournament)} />
      </span>
      <span className="hub-event-body">
        <span className="hub-kicker">
          {[tournament.region, plan.circuit].filter(Boolean).join(" · ") || text("Giải đấu", "Tournament")}
        </span>
        <h3>{tournament.name}</h3>
        <p>
          {text(
            `${plan.entrants.length} đội · ${plan.matches.length} trận`,
            `${plan.entrants.length} ${plan.entrants.length === 1 ? "team" : "teams"} · ${plan.matches.length} ${plan.matches.length === 1 ? "match" : "matches"}`,
          )}
          {plan.organizer ? ` · ${plan.organizer}` : ""}
        </p>
        <span className="hub-event-chips">
          <span className="hub-chip">
            <StreamIcon name="calendar" size={14} />
            {dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}
          </span>
          {plan.prizePool && (
            <span className="hub-chip">
              <StreamIcon name="trophy" size={14} />
              <LocalPrizeText
                text={plan.prizePool}
                currency={plan.currency}
                on={tournament.endsOn ?? tournament.startsOn}
                locale={languageTag}
              />
            </span>
          )}
        </span>
      </span>
    </Link>
  )
}

export function EntityPageLink({ kind, id, name }: { kind: "TEAM" | "PLAYER"; id: string; name: string }) {
  const page = useQuery({
    queryKey: ["entity-page", kind, id],
    queryFn: () => communityApi<CommunityProfile>(`/pages/by-entity/${kind}/${id}`),
    retry: false,
    staleTime: 60000,
  })
  return page.data ? <Link to={`/pages/${page.data.code}`}>{name}</Link> : <span>{name}</span>
}

const competitionTabs = [
  ["matches", ["Lịch & kết quả", "Schedule & results"]],
  ["standings", ["BXH & nhánh đấu", "Standings & bracket"]],
  ["teams", ["Đội tham dự", "Participating teams"]],
  ["overview", ["Thông tin", "Information"]],
] as const

export function PublicCompetitionPage() {
  const { text, languageTag } = useStreamLocale()
  const { id = "" } = useParams()
  const query = useQuery(competitionQuery(id))
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab")
  const tab =
    requested === "bracket" ? "standings" : competitionTabs.some(([key]) => key === requested) ? requested : "matches"
  const setTab = (next: string) =>
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set("tab", next)
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
          <StreamIcon name={query.isError ? "info" : "clock"} size={28} />
          <h1>{query.isError ? query.error.message : text("Đang tải giải đấu…", "Loading tournament…")}</h1>
          {query.isLoadingError && (
            <button className="cp-button" onClick={() => void query.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          )}
        </div>
      </StreamShell>
    )
  const { tournament, plan, teams, players, rosters, standings, organizer, circuit } = query.data.content
  const team = (teamId?: string | null) =>
    teamId ? (
      <EntityPageLink
        kind="TEAM"
        id={teamId}
        name={teams[teamId]?.name || text("Đội chưa có thông tin", "No team information yet")}
      />
    ) : null
  const matches = competitionMatches([query.data])
  const fixture = (key: string) => {
    const entry = matches.find((entry) => entry.match.key === key)
    return entry ? <MatchRow key={key} entry={entry} /> : null
  }
  return (
    <StreamShell>
      <title>{`${tournament.name} — AOV Stream`}</title>
      <div className="cp-container">
        <Link className="cp-back" to="/competitions">
          <StreamIcon name="back" size={16} />
          {text("Tất cả giải đấu", "All tournaments")}
        </Link>
        <header className="hub-card cp-page-header">
          <div className="cp-competition-cover hub-art" style={hue(tournament.name)}>
            <span className="cp-competition-logo">
              {tournament.logoUrl ? <img src={tournament.logoUrl} alt="" /> : monogram(tournament.name)}
            </span>
            <div className="cp-competition-title">
              <StatusBadge status={competitionStatus(tournament)} />
              <span className="hub-kicker">
                {circuit ? (
                  <Link to={`/pages/${circuit.code}`}>{circuit.name}</Link>
                ) : (
                  plan.circuit || text("Giải đấu", "Tournament")
                )}
                {tournament.region && ` · ${tournament.region}`}
              </span>
              <h1>{tournament.name}</h1>
              <div className="hub-banner-stats">
                <span>
                  <StreamIcon name="calendar" size={14} />
                  {dayRange(tournament.startsOn, tournament.endsOn)}
                </span>
                <span>
                  <StreamIcon name="users" size={14} />
                  {text(
                    `${plan.entrants.length} đội`,
                    `${plan.entrants.length} ${plan.entrants.length === 1 ? "team" : "teams"}`,
                  )}
                </span>
                <span>
                  <StreamIcon name="gamepad" size={14} />
                  {text(
                    `${plan.matches.length} trận`,
                    `${plan.matches.length} ${plan.matches.length === 1 ? "match" : "matches"}`,
                  )}
                </span>
              </div>
            </div>
          </div>
          <nav className="cp-tabs cp-header-tabs" aria-label={text("Nội dung giải đấu", "Tournament content")}>
            {competitionTabs.map(([key, label]) => (
              <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>
                {text(label[0], label[1])}
              </button>
            ))}
          </nav>
        </header>
        {tab === "overview" && (
          <div className="cp-columns">
            <div className="cp-main-column">
              <section className="cp-section">
                <h2>{text("Giới thiệu", "About")}</h2>
                <p className="cp-prose">
                  {plan.notes ||
                    tournament.note ||
                    text("Chưa có giới thiệu bổ sung.", "No additional introduction yet.")}
                </p>
              </section>
              <section className="cp-section">
                <h2>{text("Thể thức", "Format")}</h2>
                {plan.stages.map((stage) => (
                  <article className="cp-stage" key={stage.code}>
                    <span className="cp-stage-icon" aria-hidden="true">
                      <StreamIcon name={stage.format === "ROUND_ROBIN" ? "table" : "bracket"} size={20} />
                    </span>
                    <div>
                      <h3>{stage.name}</h3>
                      <p>
                        BO{stage.bestOf} ·{" "}
                        {stage.format === "ROUND_ROBIN"
                          ? text(
                              `Vòng tròn ${stage.legs} lượt · ${stage.advance} đội đi tiếp`,
                              `Round robin, ${stage.legs} ${stage.legs === 1 ? "leg" : "legs"} · ${stage.advance} ${stage.advance === 1 ? "team advances" : "teams advance"}`,
                            )
                          : stage.format === "DOUBLE_ELIMINATION"
                            ? text("Nhánh thắng / nhánh thua", "Upper bracket / lower bracket")
                            : text("Loại trực tiếp / lịch riêng", "Single elimination / custom schedule")}
                      </p>
                      {stage.format === "ROUND_ROBIN" && (
                        <p className="cp-meta">
                          {text(
                            `Thắng ${stage.winPoints} điểm · Thua ${stage.lossPoints} điểm · Tiêu chí phụ:`,
                            `Win: ${stage.winPoints} ${stage.winPoints === 1 ? "point" : "points"} · Loss: ${stage.lossPoints} ${stage.lossPoints === 1 ? "point" : "points"} · Tiebreakers:`,
                          )}{" "}
                          {stage.tieBreakers
                            .map(
                              (rule) =>
                                ({
                                  HEAD_TO_HEAD: text("đối đầu", "head-to-head"),
                                  GAME_DIFF: text("hiệu số ván", "game difference"),
                                  GAME_WINS: text("số ván thắng", "game wins"),
                                })[rule] || rule,
                            )
                            .join(" → ") || text("chưa phân hạng", "none yet")}
                        </p>
                      )}
                      {stage.patchNote && <p>{stage.patchNote}</p>}
                      {stage.sourceUrl && (
                        <a className="cp-source" href={stage.sourceUrl} target="_blank" rel="noreferrer">
                          {text("Điều lệ", "Rules")}
                          <StreamIcon name="external" size={12} />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            </div>
            <aside className="cp-side-column">
              <section className="cp-section">
                <h2>{text("Thông tin", "Information")}</h2>
                <dl className="cp-facts">
                  <div>
                    <dt>{text("Đơn vị tổ chức", "Organizer")}</dt>
                    <dd>
                      {organizer ? (
                        <Link className="cp-organizer" to={`/pages/${organizer.code}`}>
                          {organizer.logoUrl && <img src={organizer.logoUrl} alt="" />}
                          {organizer.name}
                        </Link>
                      ) : plan.organizerPageId ? (
                        <Link to={`/pages/${plan.organizerPageId}`}>{plan.organizer}</Link>
                      ) : (
                        plan.organizer || text("Chưa cập nhật", "Not updated yet")
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{text("Quỹ giải thưởng", "Prize pool")}</dt>
                    <dd>
                      {plan.prizePool ? (
                        <LocalPrizeText
                          text={plan.prizePool}
                          currency={plan.currency}
                          on={tournament.endsOn ?? tournament.startsOn}
                          locale={languageTag}
                        />
                      ) : (
                        text("Chưa công bố", "Not announced yet")
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{text("Múi giờ", "Time zone")}</dt>
                    <dd>{plan.timezone}</dd>
                  </div>
                  {plan.venues.map((venue, index) => (
                    <div key={index}>
                      <dt>{venue.stageCode || text("Địa điểm", "Venue")}</dt>
                      <dd>
                        {venue.name} · {venue.city}
                      </dd>
                    </div>
                  ))}
                </dl>
                <a className="cp-source" href={plan.sourceUrl} target="_blank" rel="noreferrer">
                  {text("Nguồn kiểm chứng", "Verification source")}
                  <StreamIcon name="external" size={12} />
                </a>
                <p className="cp-meta">
                  {text("Cập nhật:", "Updated:")} <LocalTime value={query.data.publishedAt} locale={languageTag} />
                </p>
              </section>
            </aside>
          </div>
        )}
        {tab === "teams" && (
          <div className="cp-directory">
            {plan.entrants.map((entrant) => (
              <section className="cp-section cp-team-card" key={entrant.teamId}>
                <h2>
                  <span className="cp-team-logo" style={hue(teams[entrant.teamId]?.name || entrant.teamId)}>
                    {teams[entrant.teamId]?.logoUrl ? (
                      <img src={teams[entrant.teamId]!.logoUrl} alt="" />
                    ) : (
                      (teams[entrant.teamId]?.name || "?").slice(0, 1).toUpperCase()
                    )}
                  </span>
                  {team(entrant.teamId)}
                </h2>
                {entrant.status === "WITHDRAWN" && <span className="cp-badge">{text("Đã rút lui", "Withdrawn")}</span>}
                {rosters
                  .filter((row) => row.teamId === entrant.teamId)
                  .map((row) => (
                    <div className="cp-roster-row" key={row.playerId}>
                      <EntityPageLink
                        kind="PLAYER"
                        id={row.playerId}
                        name={players[row.playerId]?.nickname || text("Tuyển thủ", "Player")}
                      />
                      <span className="cp-meta">
                        {row.lane || text("Chưa rõ vị trí", "Unknown position")} ·{" "}
                        {row.status === "SUBSTITUTE"
                          ? text("Dự bị", "Substitute")
                          : row.status === "ACTIVE"
                            ? text("Chính thức", "Main roster")
                            : text("Chưa xác nhận", "Unconfirmed")}
                      </span>
                    </div>
                  ))}
                {!rosters.some((row) => row.teamId === entrant.teamId) && (
                  <p className="cp-muted">{text("Chưa công bố đội hình.", "Roster not announced yet.")}</p>
                )}
              </section>
            ))}
            {!plan.entrants.length && (
              <div className="hub-state">
                <StreamIcon name="users" size={28} />
                <h3>{text("Chưa có đội tham dự được công bố", "No participating teams published yet")}</h3>
              </div>
            )}
          </div>
        )}
        {tab === "matches" && (
          <section className="cp-section">
            <h2>{text("Lịch & kết quả", "Schedule & results")}</h2>
            <CompetitionSchedule entries={matches} />
          </section>
        )}
        {tab === "standings" && (
          <>
            {!standings.length && (
              <div className="hub-state">
                <StreamIcon name="table" size={28} />
                <h3>
                  {text("Giải chưa có bảng xếp hạng vòng tròn.", "This tournament has no round-robin standings yet.")}
                </h3>
              </div>
            )}
            {standings.map((table) => (
              <section className="cp-section" key={table.stageCode}>
                <h2>{plan.stages.find((stage) => stage.code === table.stageCode)?.name}</h2>
                <p className="cp-meta">
                  {table.complete
                    ? text("Kết quả giai đoạn đã hoàn tất", "Stage results are complete")
                    : text(
                        "Bảng tạm tính · chưa xác nhận suất đi tiếp",
                        "Provisional standings · advancing spots not confirmed yet",
                      )}
                </p>
                <div className="cp-table-scroll">
                  <table className="cp-table">
                    <thead>
                      <tr>
                        {[
                          text("Hạng", "Rank"),
                          text("Đội", "Team"),
                          text("Trận", "Matches"),
                          text("Thắng", "Wins"),
                          text("Thua", "Losses"),
                          text("Ván", "Games"),
                          text("Điểm", "Points"),
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row) => (
                        <tr key={row.teamId} data-qualified={row.qualified || undefined}>
                          <td>
                            <span className="cp-rank">
                              {row.rank}
                              {row.tied && "="}
                            </span>
                          </td>
                          <td>
                            {team(row.teamId)}
                            {row.qualified && (
                              <span
                                className="cp-qualified"
                                title={text("Đã giành suất đi tiếp", "Secured a spot to advance")}
                              >
                                <StreamIcon name="check" size={14} />
                                <span className="sr-only">
                                  {text("Đã giành suất đi tiếp", "Secured a spot to advance")}
                                </span>
                              </span>
                            )}
                          </td>
                          <td>{row.played}</td>
                          <td>{row.won}</td>
                          <td>{row.lost}</td>
                          <td>
                            {row.gameWins}–{row.gameLosses}
                          </td>
                          <td>
                            <strong>{row.points}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}
        {tab === "standings" && (
          <>
            {!plan.stages.some((stage) => stage.format !== "ROUND_ROBIN") && (
              <div className="hub-state">
                <StreamIcon name="bracket" size={28} />
                <h3>{text("Giải chưa có nhánh đấu.", "This tournament has no bracket yet.")}</h3>
              </div>
            )}
            {plan.stages
              .filter((stage) => stage.format !== "ROUND_ROBIN")
              .map((stage) => (
                <section className="cp-section" key={stage.code}>
                  <h2>{stage.name}</h2>
                  <div className="cp-bracket">
                    {[
                      ...new Set(
                        plan.matches.filter((match) => match.stageCode === stage.code).map((match) => match.round),
                      ),
                    ]
                      .sort((a, b) => a - b)
                      .map((round) => (
                        <div className="cp-bracket-round" key={round}>
                          <h3>{text(`Vòng ${round}`, `Round ${round}`)}</h3>
                          {plan.matches
                            .filter((match) => match.stageCode === stage.code && match.round === round)
                            .map((match) => fixture(match.key))}
                        </div>
                      ))}
                  </div>
                </section>
              ))}
          </>
        )}
      </div>
    </StreamShell>
  )
}
export function ProfileCompetitionSummary({ profile }: { profile: CommunityProfile }) {
  const { text } = useStreamLocale()
  const filter = profile.kind === "TEAM" ? `teamId=${profile.entityId}` : `playerId=${profile.entityId}`
  const query = useInfiniteQuery({
    queryKey: ["profile-results", profile.id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi<PageSlice<CompetitionView>>(`/competitions?${filter}&size=10&page=${pageParam}`),
    getNextPageParam: nextPageOf,
    enabled: !!profile.entityId,
  })
  if (profile.kind === "ORGANIZATION" || profile.kind === "CIRCUIT") return <CompetitionList profile={profile} />
  const matches = (query.data?.pages.flatMap((page) => page.items) || []).flatMap((entry) => {
    const ids =
      profile.kind === "TEAM"
        ? [profile.entityId]
        : entry.content.rosters.filter((row) => row.playerId === profile.entityId).map((row) => row.teamId)
    return entry.content.resolved
      .filter((row) => ids.includes(row.teamAId) || ids.includes(row.teamBId))
      .map((row) => ({ entry, row }))
  })
  return (
    <>
      <section className="cp-section">
        <h2>{text("Lịch & kết quả", "Schedule & results")}</h2>
        <p className="cp-meta">
          {profile.kind === "PLAYER"
            ? text(
                "Các trận của đội có tuyển thủ trong danh sách đăng ký mùa giải. Danh sách này không khẳng định tuyển thủ đã ra sân từng trận.",
                "Matches of the teams that registered the player for the season. This list does not confirm that the player played in each match.",
              )
            : text("Theo các bản công bố của từng mùa giải.", "Based on the published version of each season.")}
        </p>
        {query.isPending && profile.entityId && (
          <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải kết quả", "Loading results")} />
        )}
        {query.isError && (
          <p className="cp-error" role="alert">
            {query.error.message}
          </p>
        )}
        {!(query.isPending && profile.entityId) && !matches.length && (
          <p className="cp-muted">
            {text("Chưa có lịch hoặc kết quả được công bố.", "No schedule or results published yet.")}
          </p>
        )}
        {matches.map(({ entry, row }) => (
          <div key={`${entry.id}:${row.key}`} className="cp-result-row">
            <Link className="cp-result-event" to={`/competitions/${entry.id}`}>
              {entry.content.tournament.name}
            </Link>
            <Link className="cp-result-teams" to={competitionMatchHref(entry.id, row.key)}>
              <span>{entry.content.teams[row.teamAId || ""]?.name || text("Chờ đội", "Team TBD")}</span>
              <strong>
                {row.scoreA ?? "–"} : {row.scoreB ?? "–"}
              </strong>
              <span>{entry.content.teams[row.teamBId || ""]?.name || text("Chờ đội", "Team TBD")}</span>
            </Link>
          </div>
        ))}
        <InfiniteScroll
          query={query}
          label={text("Đang tải thêm kết quả", "Loading more results")}
          retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
        />
      </section>
      <CompetitionList profile={profile} />
    </>
  )
}
