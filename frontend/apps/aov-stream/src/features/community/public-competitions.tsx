import { useState } from "react"
import { Link, useParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { slotLabel, type CommunityProfile, type CompetitionView, type PageSlice } from "@aov/community-contracts"
import { StreamShell } from "../../components/stream-shell"
import { communityApi } from "./community-api"
import { gamesQuery } from "../tournaments/tournament-api"
import { GameCard } from "../tournaments/game-card"

export function CompetitionDirectory() {
  return (
    <StreamShell>
      <div className="cp-container">
        <header className="cp-heading">
          <span className="cp-eyebrow">THI ĐẤU</span>
          <h1>Theo dõi từng mùa giải.</h1>
          <p>Lịch đấu, đội hình, nhánh đấu và kết quả đã được biên tập, đối chiếu nguồn.</p>
        </header>
        <CompetitionList />
        <Link className="cp-button" to="/games">
          Khám phá các ván đã ghi nhận →
        </Link>
      </div>
    </StreamShell>
  )
}
export function CompetitionList({ profile }: { profile?: CommunityProfile }) {
  const [page, setPage] = useState(0)
  const filter: Record<string, string> = profile
    ? profile.kind === "ORGANIZATION"
      ? { organizerPageId: profile.id }
      : profile.kind === "TEAM"
        ? { teamId: profile.entityId || "" }
        : { playerId: profile.entityId || "" }
    : {}
  const query = useQuery({
    queryKey: ["published-competitions", filter, page],
    queryFn: () =>
      communityApi<PageSlice<CompetitionView>>(
        `/competitions?${new URLSearchParams({ ...filter, page: String(page), size: "12" })}`,
      ),
  })
  if (query.isPending) return <p>Đang tải giải đấu…</p>
  if (query.isError)
    return (
      <p className="cp-error" role="alert">
        {query.error.message} <button onClick={() => void query.refetch()}>Thử lại</button>
      </p>
    )
  return (
    <section className="cp-section">
      <h2>{profile ? "Giải đấu đã tham gia" : "Các mùa giải"}</h2>
      {!query.data.items.length && (
        <div className="cp-empty">
          <h3>Chưa có giải đã công bố</h3>
          <p>Lịch và thông tin sẽ xuất hiện khi được biên tập xong.</p>
        </div>
      )}
      <div className="cp-directory">
        {query.data.items.map((entry) => (
          <Link className="cp-card" key={entry.id} to={`/competitions/${entry.id}`}>
            <div>
              <span className="cp-eyebrow">
                {entry.content.tournament.region} · {entry.content.plan.circuit || "GIẢI ĐẤU"}
              </span>
              <h3>{entry.content.tournament.name}</h3>
              <p className="cp-meta">
                {entry.content.tournament.startsOn || "Chờ lịch"} → {entry.content.tournament.endsOn || ""}
              </p>
              <p>
                {entry.content.plan.entrants.length} đội · {entry.content.plan.matches.length} trận
              </p>
            </div>
          </Link>
        ))}
      </div>
      <div className="cp-pagination">
        <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
          Trước
        </button>
        <span>Trang {page + 1}</span>
        <button
          className="cp-button"
          disabled={(page + 1) * 12 >= query.data.totalElements}
          onClick={() => setPage(page + 1)}
        >
          Sau
        </button>
      </div>
    </section>
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
export function PublicCompetitionPage() {
  const { id = "" } = useParams()
  const query = useQuery({
    queryKey: ["competition", id],
    queryFn: () => communityApi<CompetitionView>(`/competitions/${id}`),
  })
  const [tab, setTab] = useState("overview")
  if (!query.data)
    return (
      <StreamShell>
        <div className="cp-container">
          <Link to="/">← Giải đấu</Link>
          <p role={query.isError ? "alert" : undefined}>{query.isError ? query.error.message : "Đang tải giải đấu…"}</p>
        </div>
      </StreamShell>
    )
  const { tournament, plan, teams, players, rosters, resolved, standings, organizer } = query.data.content
  const team = (teamId?: string | null) =>
    teamId ? <EntityPageLink kind="TEAM" id={teamId} name={teams[teamId]?.name || "Đội chưa có thông tin"} /> : null
  const fixture = (key: string) => {
    const match = plan.matches.find((match) => match.key === key)!,
      result = resolved.find((row) => row.key === key)
    return (
      <article key={key} className="cp-match">
        <div className="cp-meta">
          {match.label} · BO{match.bestOf}
          <br />
          {match.scheduledAt
            ? new Intl.DateTimeFormat("vi-VN", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: plan.timezone,
              }).format(new Date(match.scheduledAt))
            : "Chờ lịch"}
        </div>
        <div className="cp-match-teams">
          <span>{team(result?.teamAId) || slotLabel(match.a, teams)}</span>
          <strong>
            {result?.scoreA ?? "–"} : {result?.scoreB ?? "–"}
          </strong>
          <span>{team(result?.teamBId) || slotLabel(match.b, teams)}</span>
        </div>
        {match.seriesId && (
          <Link className="cp-meta" to={`/games?tournament=${id}&q=${encodeURIComponent(match.label)}`}>
            Xem các ván đã công bố →
          </Link>
        )}
      </article>
    )
  }
  return (
    <StreamShell>
      <div className="cp-container">
        <Link className="cp-back" to="/">
          ← Tất cả giải đấu
        </Link>
        <header className="cp-competition-header">
          {tournament.logoUrl && <img src={tournament.logoUrl} alt="" />}
          <div>
            <span className="cp-eyebrow">
              {plan.circuit || "GIẢI ĐẤU"} · {tournament.region}
            </span>
            <h1>{tournament.name}</h1>
            <p className="cp-meta">
              {tournament.startsOn || "Chưa xác định"} → {tournament.endsOn || "Chưa xác định"} · {plan.entrants.length}{" "}
              đội
            </p>
          </div>
        </header>
        <nav className="cp-tabs" aria-label="Nội dung giải đấu">
          {[
            ["overview", "Tổng quan"],
            ["teams", "Đội hình"],
            ["matches", "Lịch & kết quả"],
            ["standings", "Bảng xếp hạng"],
            ["bracket", "Nhánh đấu"],
            ["games", "Ván đấu"],
          ].map(([key, label]) => (
            <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key!)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === "overview" && (
          <div className="cp-profile-grid">
            <div className="cp-main-column">
              <section className="cp-section">
                <h2>Giới thiệu</h2>
                <p className="cp-prose">{plan.notes || tournament.note || "Chưa có giới thiệu bổ sung."}</p>
              </section>
              <section className="cp-section">
                <h2>Thể thức</h2>
                {plan.stages.map((stage) => (
                  <article className="cp-list-row" key={stage.code}>
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
                        <a href={stage.sourceUrl} target="_blank" rel="noreferrer">
                          Điều lệ ↗
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            </div>
            <aside>
              <section className="cp-section">
                <h2>Thông tin</h2>
                <dl className="cp-facts">
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
                  <dt>Quỹ giải thưởng</dt>
                  <dd>{plan.prizePool ? `${plan.prizePool} ${plan.currency}` : "Chưa công bố"}</dd>
                  <dt>Múi giờ</dt>
                  <dd>{plan.timezone}</dd>
                  {plan.venues.map((venue, index) => (
                    <div key={index}>
                      <dt>{venue.stageCode || "Địa điểm"}</dt>
                      <dd>
                        {venue.name} · {venue.city}
                      </dd>
                    </div>
                  ))}
                </dl>
                <a href={plan.sourceUrl} target="_blank" rel="noreferrer">
                  Nguồn kiểm chứng ↗
                </a>
                <p className="cp-meta">Cập nhật: {new Date(query.data.publishedAt!).toLocaleString("vi-VN")}</p>
              </section>
            </aside>
          </div>
        )}
        {tab === "teams" && (
          <div className="cp-directory">
            {plan.entrants.map((entrant) => (
              <section className="cp-section" key={entrant.teamId}>
                <h2>{team(entrant.teamId)}</h2>
                {entrant.status === "WITHDRAWN" && <p>Đã rút lui</p>}
                {rosters
                  .filter((row) => row.teamId === entrant.teamId)
                  .map((row) => (
                    <div className="cp-list-row" key={row.playerId}>
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
          </div>
        )}
        {tab === "matches" && (
          <section className="cp-section">
            <h2>Lịch thi đấu</h2>
            <p className="cp-meta">Giờ hiển thị: {plan.timezone}</p>
            {!plan.matches.length && <p>Chưa có lịch thi đấu.</p>}
            {plan.stages.map((stage) => (
              <div key={stage.code}>
                <h3>{stage.name}</h3>
                {plan.matches.filter((match) => match.stageCode === stage.code).map((match) => fixture(match.key))}
              </div>
            ))}
          </section>
        )}
        {tab === "standings" && (
          <>
            {!standings.length && <p className="cp-empty">Giải chưa có bảng xếp hạng vòng tròn.</p>}
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
                        <tr key={row.teamId}>
                          <td>
                            {row.rank}
                            {row.tied && "="}
                          </td>
                          <td>
                            {team(row.teamId)}
                            {row.qualified && " ✓"}
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
        {tab === "bracket" && (
          <>
            {!plan.stages.some((stage) => stage.format !== "ROUND_ROBIN") && (
              <p className="cp-empty">Giải chưa có nhánh đấu.</p>
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
        {tab === "games" && <PublishedGames tournamentId={id} />}
      </div>
    </StreamShell>
  )
}
function PublishedGames({ tournamentId }: { tournamentId: string }) {
  const query = useInfiniteQuery(gamesQuery({ tournamentId }))
  const games = query.data?.pages.flatMap((page) => page.items) || []
  return (
    <section className="cp-section">
      <h2>Ván đấu đã công bố</h2>
      {query.isPending && <p>Đang tải…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {!query.isPending && !games.length && <p>Chưa có ván đã ghi nhận chi tiết.</p>}
      <div className="game-card-grid">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
      {query.hasNextPage && (
        <button className="cp-button" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          Xem thêm
        </button>
      )}
    </section>
  )
}
export function ProfileCompetitionSummary({ profile }: { profile: CommunityProfile }) {
  const [page, setPage] = useState(0)
  const filter = profile.kind === "TEAM" ? `teamId=${profile.entityId}` : `playerId=${profile.entityId}`
  const query = useQuery({
    queryKey: ["profile-results", profile.id, page],
    queryFn: () => communityApi<PageSlice<CompetitionView>>(`/competitions?${filter}&size=10&page=${page}`),
    enabled: !!profile.entityId,
  })
  if (profile.kind === "ORGANIZATION") return <CompetitionList profile={profile} />
  const matches = (query.data?.items || []).flatMap((entry) => {
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
        {query.isPending && <p>Đang tải…</p>}
        {query.isError && <p role="alert">{query.error.message}</p>}
        {!query.isPending && !matches.length && <p>Chưa có lịch hoặc kết quả được công bố.</p>}
        {matches.map(({ entry, row }) => (
          <div key={`${entry.id}:${row.key}`} className="cp-list-row">
            <div>
              <Link to={`/competitions/${entry.id}`}>{entry.content.tournament.name}</Link>
              <p>
                {entry.content.teams[row.teamAId || ""]?.name || "Chờ đội"}{" "}
                <strong>
                  {row.scoreA ?? "–"} : {row.scoreB ?? "–"}
                </strong>{" "}
                {entry.content.teams[row.teamBId || ""]?.name || "Chờ đội"}
              </p>
            </div>
          </div>
        ))}
        <div className="cp-pagination">
          <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
            Trước
          </button>
          <span>Nhóm mùa giải {page + 1}</span>
          <button
            className="cp-button"
            disabled={!query.data || (page + 1) * 10 >= query.data.totalElements}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </button>
        </div>
      </section>
      <CompetitionList profile={profile} />
    </>
  )
}
