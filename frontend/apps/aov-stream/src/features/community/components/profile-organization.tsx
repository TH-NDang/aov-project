import { Link } from "react-router"
import { infiniteQueryOptions, useQuery, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query"
import type { CommunityProfile, PageSlice } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { ApiError } from "../../../lib/api-client"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { useFollowedIds } from "../../../lib/community-queries"
import { ProfileCard } from "./community-directory"

/** Teams an organization owns, read a page at a time. */
const TEAM_PAGE = 12

/** The published teams an organization owns, for a list that keeps loading as the reader scrolls. */
export const organizationTeamsQuery = (organizationId: string) =>
  infiniteQueryOptions({
    queryKey: communityKeys.organizationTeams(organizationId, TEAM_PAGE),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => communityApi.organizationTeams(organizationId, pageParam, TEAM_PAGE),
    getNextPageParam: nextPageOf,
    staleTime: 60_000,
  })

export type OrganizationTeamsQuery = UseInfiniteQueryResult<InfiniteData<PageSlice<CommunityProfile>, unknown>>

/**
 * The organization that owns a team, as a line of the team's head, linked to the organization's page. It takes no
 * room while it loads, and none when the organization's page is not published.
 */
export function TeamOrganization({ organizationId }: { organizationId: string }) {
  const { text } = useStreamLocale()
  const query = useQuery({
    queryKey: communityKeys.publicPage(organizationId),
    queryFn: () => communityApi.pageByAddress(organizationId),
    retry: false,
  })
  if (query.isError && !(query.error instanceof ApiError && query.error.status === 404))
    return (
      <p className="cp-meta" role="alert">
        {text("Chưa tải được tổ chức chủ quản.", "The parent organization could not be loaded.")}{" "}
        <button type="button" className="cp-text-button" onClick={() => void query.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </p>
    )
  const organization = query.data
  if (!organization?.content) return null
  return (
    <ul className="pf-teams" aria-label={text("Tổ chức chủ quản", "Parent organization")}>
      <li>
        <Link to={`/pages/${organization.code}`}>
          {organization.content.avatarUrl && <img src={organization.content.avatarUrl} alt="" />}
          {organization.content.name}
        </Link>
        <span>{text("Tổ chức chủ quản", "Parent organization")}</span>
      </li>
    </ul>
  )
}

function TeamCards({ teams }: { teams: CommunityProfile[] }) {
  const following = useFollowedIds()
  return (
    <div className="cp-grid">
      {teams.map((team) => (
        <ProfileCard key={team.id} profile={team} following={following} hideKind />
      ))}
    </div>
  )
}

/**
 * The first teams an organization owns, as a section of its overview: `count` of them, with a link to the tab that
 * holds them all when there are more. It takes no room while it loads, and none while the organization owns no
 * published team.
 */
export function OrganizationTeamsPreview({
  query,
  count,
  more,
}: {
  query: OrganizationTeamsQuery
  count: number
  more: () => void
}) {
  const { text, languageTag } = useStreamLocale()
  const teams = query.data?.pages[0]?.items ?? []
  const total = query.data?.pages[0]?.totalElements ?? 0
  if (!teams.length) return null
  return (
    <section aria-labelledby="profile-owned-teams">
      <div className="tn-heading">
        <h2 id="profile-owned-teams">
          {text("Đội tuyển", "Teams")} <small>{total.toLocaleString(languageTag)}</small>
        </h2>
        {total > count && (
          <button type="button" onClick={more}>
            {text("Xem tất cả", "See all")}
            <StreamIcon name="arrow" size={15} />
          </button>
        )}
      </div>
      <TeamCards teams={teams.slice(0, count)} />
    </section>
  )
}

/** Every team an organization owns, loading as the reader scrolls; the tab around it names the list. */
export function OrganizationTeams({ query }: { query: OrganizationTeamsQuery }) {
  const { text } = useStreamLocale()
  const teams = query.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <section aria-label={text("Đội tuyển", "Teams")}>
      {query.isPending ? (
        <div className="cp-grid" role="status" aria-label={text("Đang tải đội tuyển", "Loading teams")}>
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="hub-skeleton cp-card-skeleton" />
          ))}
        </div>
      ) : query.isLoadingError ? (
        <div className="hub-state" role="alert">
          <h2>{text("Chưa tải được đội tuyển", "Teams could not be loaded")}</h2>
          <p>{query.error.message}</p>
          <button type="button" className="cp-button" onClick={() => void query.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : teams.length ? (
        <TeamCards teams={teams} />
      ) : (
        <p className="pf-note">
          {text("Tổ chức chưa có đội tuyển nào được công bố.", "No team of this organization has been published yet.")}
        </p>
      )}
      <InfiniteScroll
        query={query}
        label={text("Đang tải thêm đội tuyển", "Loading more teams")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </section>
  )
}
