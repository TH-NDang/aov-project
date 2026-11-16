import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { TeamAffiliation } from "@aov/community-contracts"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"

export function ProfileTeams({ pageId }: { pageId: string }) {
  const { text } = useStreamLocale()
  const query = useQuery({
    queryKey: ["public-page-teams", pageId],
    queryFn: () => communityApi<TeamAffiliation[]>(`/pages/${pageId}/teams`),
  })
  return (
    <section className="cp-panel">
      <h2>{text("Đội tuyển liên kết", "Affiliated teams")}</h2>
      {query.isPending && (
        <p className="cp-muted" role="status">
          {text("Đang tải đội tuyển…", "Loading teams…")}
        </p>
      )}
      {query.isError && (
        <p className="cp-error" role="alert">
          {text("Chưa tải được đội tuyển.", "Teams could not be loaded.")}{" "}
          <button className="cp-text-button" onClick={() => void query.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </p>
      )}
      {query.data?.length === 0 && (
        <p className="cp-muted">
          {text("Chưa có đội tuyển liên kết được công bố.", "No affiliated teams published yet.")}
        </p>
      )}
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
                {team.member.startsOn || text("Chưa rõ ngày", "Unknown date")} →{" "}
                {team.member.endsOn || text("Chưa ghi nhận kết thúc", "No end date recorded")}
              </p>
            )}
          </div>
          {team.member.sourceUrl && (
            <a className="cp-source" href={team.member.sourceUrl} target="_blank" rel="noreferrer">
              {text("Nguồn", "Source")}
            </a>
          )}
        </article>
      ))}
    </section>
  )
}
