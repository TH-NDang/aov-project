import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { TeamAffiliation } from "@aov/community-contracts"
import { communityApi } from "./community-api"

export function ProfileTeams({ pageId }: { pageId: string }) {
  const query = useQuery({
    queryKey: ["public-page-teams", pageId],
    queryFn: () => communityApi<TeamAffiliation[]>(`/pages/${pageId}/teams`),
  })
  return (
    <section className="cp-panel">
      <h2>Đội tuyển liên kết</h2>
      {query.isPending && (
        <p className="cp-muted" role="status">
          Đang tải đội tuyển…
        </p>
      )}
      {query.isError && (
        <p className="cp-error" role="alert">
          Chưa tải được đội tuyển.{" "}
          <button className="cp-text-button" onClick={() => void query.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {query.data?.length === 0 && <p className="cp-muted">Chưa có đội tuyển liên kết được công bố.</p>}
      {query.data?.map((team, index) => (
        <article className="cp-list-row" key={`${team.teamPageId}:${index}`}>
          {team.teamAvatarUrl && <img className="cp-avatar" src={team.teamAvatarUrl} alt="" />}
          <div>
            <h3>
              <Link to={`/pages/${team.teamCode}`}>{team.teamName}</Link>
            </h3>
            <p>{[team.member.role, team.member.status].filter(Boolean).join(" · ")}</p>
            {(team.member.startsOn || team.member.endsOn) && (
              <p className="cp-meta">
                {team.member.startsOn || "Chưa rõ ngày"} → {team.member.endsOn || "Chưa ghi nhận kết thúc"}
              </p>
            )}
          </div>
          {team.member.sourceUrl && (
            <a className="cp-source" href={team.member.sourceUrl} target="_blank" rel="noreferrer">
              Nguồn
            </a>
          )}
        </article>
      ))}
    </section>
  )
}
