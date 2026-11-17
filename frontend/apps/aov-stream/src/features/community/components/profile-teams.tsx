import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"

/**
 * The teams whose published squads list this person, each with the role and standing recorded there. It reads as a
 * line of the page head, so it takes no room while it loads or when no squad lists the person.
 */
export function ProfileTeams({ pageId }: { pageId: string }) {
  const { text } = useStreamLocale()
  const query = useQuery({
    queryKey: communityKeys.pageTeams(pageId),
    queryFn: () => communityApi.pageTeams(pageId),
  })
  if (query.isError)
    return (
      <p className="cp-meta" role="alert">
        {text("Chưa tải được đội tuyển.", "Teams could not be loaded.")}{" "}
        <button type="button" className="cp-text-button" onClick={() => void query.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </p>
    )
  if (!query.data?.length) return null
  return (
    <ul className="pf-teams" aria-label={text("Đội tuyển", "Teams")}>
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
