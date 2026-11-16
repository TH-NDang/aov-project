import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { TeamAffiliation } from "@aov/community-contracts"
import { communityApi } from "./community-api"

/**
 * The teams whose published squads list this person, each with the role and standing recorded there. It reads as a
 * line of the page head, so it takes no room while it loads or when no squad lists the person.
 */
export function ProfileTeams({ pageId }: { pageId: string }) {
  const query = useQuery({
    queryKey: ["public-page-teams", pageId],
    queryFn: () => communityApi<TeamAffiliation[]>(`/pages/${pageId}/teams`),
  })
  if (query.isError)
    return (
      <p className="cp-meta" role="alert">
        Chưa tải được đội tuyển.{" "}
        <button type="button" className="cp-text-button" onClick={() => void query.refetch()}>
          Thử lại
        </button>
      </p>
    )
  if (!query.data?.length) return null
  return (
    <ul className="pf-teams" aria-label="Đội tuyển">
      {query.data.map((team, index) => (
        <li key={`${team.teamPageId}:${index}`}>
          <Link to={`/pages/${team.teamCode}`}>
            {team.teamAvatarUrl && <img src={team.teamAvatarUrl} alt="" />}
            {team.teamName}
          </Link>
          <span>{[team.member.role, team.member.status].filter(Boolean).join(" · ")}</span>
        </li>
      ))}
    </ul>
  )
}
