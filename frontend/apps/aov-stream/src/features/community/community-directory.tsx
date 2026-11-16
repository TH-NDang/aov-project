import type { CSSProperties } from "react"
import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  isCommunityProfile,
  profileKindLabels,
  type CommunityProfile,
  type ProfileKind,
  type PageSlice,
} from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { useFollowedIds, useFollowPage } from "./community-queries"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { Avatar, followersLabel, hueOf, kindIcons } from "./community-ui"
import { regionName } from "./profile-aside"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

const kinds = Object.keys(profileKindLabels) as ProfileKind[]

/** The English name of each page kind; `profileKindLabels` holds the Vietnamese one. */
export const profileKindEnglish: Record<ProfileKind, string> = {
  CIRCUIT: "Tournament circuit",
  ORGANIZATION: "Organization",
  TEAM: "Team",
  PLAYER: "Player",
  PERSON: "Staff",
}

/** The searchable list of published pages; kind and search live in the URL so the header search can open it. */
const kindArt = {
  CIRCUIT: navArtIcons.circuits,
  ORGANIZATION: navArtIcons.organizations,
  TEAM: navArtIcons.teams,
  PLAYER: navArtIcons.players,
  PERSON: navArtIcons.coaches,
}

function KindArt({ kind }: { kind: keyof typeof kindArt }) {
  const Art = kindArt[kind]
  return <Art size={20} />
}

export function PageDirectory() {
  const { text } = useStreamLocale()
  const [params, setParams] = useSearchParams()
  const requested = params.get("kind") as ProfileKind | null
  const kind = requested && kinds.includes(requested) ? requested : null
  const search = params.get("q") || ""
  const following = useFollowedIds()
  const query = useInfiniteQuery({
    queryKey: ["public-pages", kind, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi<PageSlice<CommunityProfile>>(
        `/pages?${new URLSearchParams({ ...(kind ? { kind } : {}), q: search, page: String(pageParam), size: "24" })}`,
      ),
    getNextPageParam: nextPageOf,
  })
  const profiles = query.data?.pages.flatMap((page) => page.items) ?? []
  function update(key: "kind" | "q", value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: key === "q" },
    )
  }
  return (
    <div className="cp-directory-tab">
      <div className="cp-toolbar">
        <div className="hub-pills" role="group" aria-label={text("Loại trang", "Page type")}>
          <button aria-pressed={!kind} onClick={() => update("kind", "")}>
            <StreamIcon name="grid" size={16} />
            {text("Tất cả", "All")}
          </button>
          {kinds.map((type) => (
            <button key={type} aria-pressed={kind === type} onClick={() => update("kind", type)}>
              <KindArt kind={type} />
              {text(profileKindLabels[type], profileKindEnglish[type])}
            </button>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <div className="cp-grid" role="status" aria-label={text("Đang tải danh bạ", "Loading the directory")}>
          {Array.from({ length: 6 }, (_, index) => (
            <div className="hub-skeleton cp-card-skeleton" key={index} />
          ))}
        </div>
      ) : query.isLoadingError ? (
        <div className="hub-state" role="alert">
          <StreamIcon name="reset" size={28} />
          <h2>{query.error.message}</h2>
          <button className="cp-button" onClick={() => void query.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : !profiles.length ? (
        <div className="hub-state">
          <StreamIcon name="grid" size={28} />
          <h2>
            {search
              ? text("Chưa tìm thấy trang phù hợp", "No matching pages found")
              : text("Danh bạ đang được xây dựng", "The directory is being built")}
          </h2>
          <p>
            {text(
              "Trang đã đối chiếu và công bố sẽ xuất hiện tại đây.",
              "Pages that have been cross-checked and published will appear here.",
            )}
          </p>
          {search && (
            <button className="cp-button" onClick={() => update("q", "")}>
              {text("Xóa tìm kiếm", "Clear search")}
            </button>
          )}
        </div>
      ) : (
        <div className="cp-grid">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} following={following} />
          ))}
        </div>
      )}
      <InfiniteScroll
        query={query}
        label={text("Đang tải thêm trang", "Loading more pages")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </div>
  )
}

/** `following` is null for signed-out viewers, who see no follow button. */
export function ProfileCard({ profile, following }: { profile: CommunityProfile; following: Set<string> | null }) {
  const { text, languageTag } = useStreamLocale()
  const follow = useFollowPage()
  const name = profile.content?.name || profile.code
  const cover = profile.content?.coverUrl
  const followed = following?.has(profile.id) ?? false
  const community = isCommunityProfile(profile.kind)
  return (
    <article className="cp-profile-card">
      <Link className="cp-card-link" to={`/pages/${profile.code}`} aria-label={name} />
      <span
        className="cp-card-cover hub-art"
        style={
          {
            "--hub-hue": hueOf(name),
            ...(cover ? { backgroundImage: `url(${JSON.stringify(cover)})` } : {}),
          } as CSSProperties
        }
      />
      <span className="cp-card-content">
        <Avatar profile={profile} />
        <span className="cp-card-kind">
          <StreamIcon name={kindIcons[profile.kind]} size={14} />
          {text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])}
          {profile.content?.country ? ` · ${regionName(profile.content.country, languageTag)}` : ""}
        </span>
        <strong className="cp-card-name">
          <span>{name}</span>
          {community && profile.represented && (
            <OfficialBadge label={text("Đại diện đã xác minh", "Verified representative")} />
          )}
        </strong>
        {!community && (
          <span className="cp-card-meta">
            {text("Tổng quan · Các mùa giải · Lịch sử", "Overview · Seasons · History")}
          </span>
        )}
        {community && profile.followers > 0 && (
          <span className="cp-card-meta">{followersLabel(profile.followers)}</span>
        )}
        {community && following && (
          <span className="cp-card-footer">
            <button
              className={followed ? "cp-follow-chip" : "cp-follow-chip cp-follow-primary"}
              aria-pressed={followed}
              disabled={follow.isPending}
              onClick={() => follow.mutate({ pageId: profile.id, following: !followed })}
            >
              <StreamIcon name={followed ? "check" : "plus"} size={14} />
              {followed ? text("Đang theo dõi", "Following") : text("Theo dõi", "Follow")}
            </button>
          </span>
        )}
      </span>
    </article>
  )
}
