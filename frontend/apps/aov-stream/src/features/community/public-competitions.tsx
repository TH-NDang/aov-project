import type { CSSProperties } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { type CommunityProfile, type CompetitionView, type PageSlice } from "@aov/community-contracts"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
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
  return status ? (
    <span className="hub-status" data-status={status}>
      {competitionStatusLabels[status]}
    </span>
  ) : null
}

export function CompetitionList({ profile }: { profile?: CommunityProfile }) {
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
    <div className="hub-skeleton-rows" role="status" aria-label="Đang tải giải đấu" />
  ) : query.isLoadingError ? (
    <div className="hub-state" role="alert">
      <StreamIcon name="reset" size={28} />
      <h3>{query.error.message}</h3>
      <button className="cp-button" onClick={() => void query.refetch()}>
        Thử lại
      </button>
    </div>
  ) : !competitions.length ? (
    <div className="hub-state">
      <StreamIcon name="calendar" size={28} />
      <h3>{profile?.kind === "CIRCUIT" ? "Chưa có mùa giải được công bố" : "Chưa có giải đã công bố"}</h3>
      <p>Lịch và thông tin sẽ xuất hiện khi được biên tập xong.</p>
    </div>
  ) : (
    <>
      <div className="hub-event-list">
        {competitions.map((entry) => (
          <CompetitionEvent key={entry.id} entry={entry} />
        ))}
      </div>
      <InfiniteScroll query={query} label="Đang tải thêm giải đấu" />
    </>
  )
  if (!profile) return body
  return (
    <section className="cp-section">
      <h2>
        {profile.kind === "CIRCUIT"
          ? "Các mùa giải"
          : profile.kind === "ORGANIZATION"
            ? "Giải đấu tổ chức"
            : "Giải đấu đã tham gia"}
      </h2>
      {profile.kind === "ORGANIZATION" && (
        <p className="cp-meta">Các mùa giải đã công bố có liên kết với tổ chức này.</p>
      )}
      {body}
    </section>
  )
}

export function CompetitionEvent({ entry }: { entry: CompetitionView }) {
  const { tournament, plan } = entry.content
  return (
    <Link className="hub-event" to={`/competitions/${entry.id}`}>
      <span className="hub-event-cover hub-art" style={hue(tournament.name)}>
        {tournament.logoUrl ? <img src={tournament.logoUrl} alt="" /> : <b>{monogram(tournament.name)}</b>}
        <StatusBadge status={competitionStatus(tournament)} />
      </span>
      <span className="hub-event-body">
        <span className="hub-kicker">
          {[tournament.region, plan.circuit].filter(Boolean).join(" · ") || "Giải đấu"}
        </span>
        <h3>{tournament.name}</h3>
        <p>
          {plan.entrants.length} đội · {plan.matches.length} trận
          {plan.organizer ? ` · ${plan.organizer}` : ""}
        </p>
        <span className="hub-event-chips">
          <span className="hub-chip">
            <StreamIcon name="calendar" size={14} />
            {dayRange(tournament.startsOn, tournament.endsOn, "Chờ lịch")}
          </span>
          {plan.prizePool && (
            <span className="hub-chip">
              <StreamIcon name="trophy" size={14} />
              {plan.prizePool} {plan.currency}
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
  ["matches", "Lịch & kết quả"],
  ["standings", "BXH & nhánh đấu"],
  ["teams", "Đội tham dự"],
  ["overview", "Thông tin"],
] as const

export function PublicCompetitionPage() {
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
          Tất cả giải đấu
        </Link>
        <div className="hub-state" role={query.isError ? "alert" : "status"}>
          <StreamIcon name={query.isError ? "info" : "clock"} size={28} />
          <h1>{query.isError ? query.error.message : "Đang tải giải đấu…"}</h1>
          {query.isLoadingError && (
            <button className="cp-button" onClick={() => void query.refetch()}>
              Thử lại
            </button>
          )}
        </div>
      </StreamShell>
    )
  const { tournament, plan, teams, players, rosters, standings, organizer, circuit } = query.data.content
  const team = (teamId?: string | null) =>
    teamId ? <EntityPageLink kind="TEAM" id={teamId} name={teams[teamId]?.name || "Đội chưa có thông tin"} /> : null
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
          Tất cả giải đấu
        </Link>
        <header className="hub-card cp-page-header">
          <div className="cp-competition-cover hub-art" style={hue(tournament.name)}>
            <span className="cp-competition-logo">
              {tournament.logoUrl ? <img src={tournament.logoUrl} alt="" /> : monogram(tournament.name)}
            </span>
            <div className="cp-competition-title">
              <StatusBadge status={competitionStatus(tournament)} />
              <span className="hub-kicker">
                {circuit ? <Link to={`/pages/${circuit.code}`}>{circuit.name}</Link> : plan.circuit || "Giải đấu"}
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
                  {plan.entrants.length} đội
                </span>
                <span>
                  <StreamIcon name="gamepad" size={14} />
                  {plan.matches.length} trận
                </span>
              </div>
            </div>
          </div>
          <nav className="cp-tabs cp-header-tabs" aria-label="Nội dung giải đấu">
            {competitionTabs.map(([key, label]) => (
              <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </nav>
        </header>
        {tab === "overview" && (
          <div className="cp-columns">
            <div className="cp-main-column">
              <section className="cp-section">
                <h2>Giới thiệu</h2>
                <p className="cp-prose">{plan.notes || tournament.note || "Chưa có giới thiệu bổ sung."}</p>
              </section>
              <section className="cp-section">
                <h2>Thể thức</h2>
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
                          ? `Vòng tròn ${stage.legs} lượt · ${stage.advance} đội đi tiếp`
                          : stage.format === "DOUBLE_ELIMINATION"
                            ? "Nhánh thắng / nhánh thua"
                            : "Loại trực tiếp / lịch riêng"}
                      </p>
                      {stage.format === "ROUND_ROBIN" && (
                        <p className="cp-meta">
                          Thắng {stage.winPoints} điểm · Thua {stage.lossPoints} điểm · Tiêu chí phụ:{" "}
                          {stage.tieBreakers
                            .map(
                              (rule) =>
                                ({ HEAD_TO_HEAD: "đối đầu", GAME_DIFF: "hiệu số ván", GAME_WINS: "số ván thắng" })[
                                  rule
                                ] || rule,
                            )
                            .join(" → ") || "chưa phân hạng"}
                        </p>
                      )}
                      {stage.patchNote && <p>{stage.patchNote}</p>}
                      {stage.sourceUrl && (
                        <a className="cp-source" href={stage.sourceUrl} target="_blank" rel="noreferrer">
                          Điều lệ
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
                <h2>Thông tin</h2>
                <dl className="cp-facts">
                  <div>
                    <dt>Đơn vị tổ chức</dt>
                    <dd>
                      {organizer ? (
                        <Link className="cp-organizer" to={`/pages/${organizer.code}`}>
                          {organizer.logoUrl && <img src={organizer.logoUrl} alt="" />}
                          {organizer.name}
                        </Link>
                      ) : plan.organizerPageId ? (
                        <Link to={`/pages/${plan.organizerPageId}`}>{plan.organizer}</Link>
                      ) : (
                        plan.organizer || "Chưa cập nhật"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Quỹ giải thưởng</dt>
                    <dd>{plan.prizePool ? `${plan.prizePool} ${plan.currency}` : "Chưa công bố"}</dd>
                  </div>
                  <div>
                    <dt>Múi giờ</dt>
                    <dd>{plan.timezone}</dd>
                  </div>
                  {plan.venues.map((venue, index) => (
                    <div key={index}>
                      <dt>{venue.stageCode || "Địa điểm"}</dt>
                      <dd>
                        {venue.name} · {venue.city}
                      </dd>
                    </div>
                  ))}
                </dl>
                <a className="cp-source" href={plan.sourceUrl} target="_blank" rel="noreferrer">
                  Nguồn kiểm chứng
                  <StreamIcon name="external" size={12} />
                </a>
                <p className="cp-meta">Cập nhật: {new Date(query.data.publishedAt!).toLocaleString("vi-VN")}</p>
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
                {entrant.status === "WITHDRAWN" && <span className="cp-badge">Đã rút lui</span>}
                {rosters
                  .filter((row) => row.teamId === entrant.teamId)
                  .map((row) => (
                    <div className="cp-roster-row" key={row.playerId}>
                      <EntityPageLink
                        kind="PLAYER"
                        id={row.playerId}
                        name={players[row.playerId]?.nickname || "Tuyển thủ"}
                      />
                      <span className="cp-meta">
                        {row.lane || "Chưa rõ vị trí"} ·{" "}
                        {row.status === "SUBSTITUTE"
                          ? "Dự bị"
                          : row.status === "ACTIVE"
                            ? "Chính thức"
                            : "Chưa xác nhận"}
                      </span>
                    </div>
                  ))}
                {!rosters.some((row) => row.teamId === entrant.teamId) && (
                  <p className="cp-muted">Chưa công bố đội hình.</p>
                )}
              </section>
            ))}
            {!plan.entrants.length && (
              <div className="hub-state">
                <StreamIcon name="users" size={28} />
                <h3>Chưa có đội tham dự được công bố</h3>
              </div>
            )}
          </div>
        )}
        {tab === "matches" && (
          <section className="cp-section">
            <h2>Lịch & kết quả</h2>
            <CompetitionSchedule entries={matches} timeZone={plan.timezone} />
          </section>
        )}
        {tab === "standings" && (
          <>
            {!standings.length && (
              <div className="hub-state">
                <StreamIcon name="table" size={28} />
                <h3>Giải chưa có bảng xếp hạng vòng tròn.</h3>
              </div>
            )}
            {standings.map((table) => (
              <section className="cp-section" key={table.stageCode}>
                <h2>{plan.stages.find((stage) => stage.code === table.stageCode)?.name}</h2>
                <p className="cp-meta">
                  {table.complete ? "Kết quả giai đoạn đã hoàn tất" : "Bảng tạm tính · chưa xác nhận suất đi tiếp"}
                </p>
                <div className="cp-table-scroll">
                  <table className="cp-table">
                    <thead>
                      <tr>
                        {["Hạng", "Đội", "Trận", "Thắng", "Thua", "Ván", "Điểm"].map((label) => (
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
                              <span className="cp-qualified" title="Đã giành suất đi tiếp">
                                <StreamIcon name="check" size={14} />
                                <span className="sr-only">Đã giành suất đi tiếp</span>
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
                <h3>Giải chưa có nhánh đấu.</h3>
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
                          <h3>Vòng {round}</h3>
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
        <h2>Lịch & kết quả</h2>
        <p className="cp-meta">
          {profile.kind === "PLAYER"
            ? "Các trận của đội có tuyển thủ trong danh sách đăng ký mùa giải. Danh sách này không khẳng định tuyển thủ đã ra sân từng trận."
            : "Theo các bản công bố của từng mùa giải."}
        </p>
        {query.isPending && profile.entityId && (
          <div className="hub-skeleton-rows" role="status" aria-label="Đang tải kết quả" />
        )}
        {query.isError && (
          <p className="cp-error" role="alert">
            {query.error.message}
          </p>
        )}
        {!(query.isPending && profile.entityId) && !matches.length && (
          <p className="cp-muted">Chưa có lịch hoặc kết quả được công bố.</p>
        )}
        {matches.map(({ entry, row }) => (
          <div key={`${entry.id}:${row.key}`} className="cp-result-row">
            <Link className="cp-result-event" to={`/competitions/${entry.id}`}>
              {entry.content.tournament.name}
            </Link>
            <Link className="cp-result-teams" to={competitionMatchHref(entry.id, row.key)}>
              <span>{entry.content.teams[row.teamAId || ""]?.name || "Chờ đội"}</span>
              <strong>
                {row.scoreA ?? "–"} : {row.scoreB ?? "–"}
              </strong>
              <span>{entry.content.teams[row.teamBId || ""]?.name || "Chờ đội"}</span>
            </Link>
          </div>
        ))}
        <InfiniteScroll query={query} label="Đang tải thêm kết quả" />
      </section>
      <CompetitionList profile={profile} />
    </>
  )
}
