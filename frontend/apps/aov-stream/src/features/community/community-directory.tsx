import { useState, type CSSProperties } from "react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  isCommunityProfile,
  profileKindLabels,
  type CommunityProfile,
  type ProfileKind,
  type PageSlice,
} from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { useFollowedIds, useFollowPage } from "./community-queries"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { Avatar, followersLabel, hueOf, kindIcons } from "./community-ui"

const kinds = Object.keys(profileKindLabels) as ProfileKind[]

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
  const [params, setParams] = useSearchParams()
  const requested = params.get("kind") as ProfileKind | null
  const kind = requested && kinds.includes(requested) ? requested : null
  const search = params.get("q") || ""
  // Changing the kind or the search starts again from the first page.
  const [paging, setPaging] = useState({ scope: "", page: 0 })
  const scope = `${kind}:${search}`
  const page = paging.scope === scope ? paging.page : 0
  const setPage = (next: number) => setPaging({ scope, page: next })
  const following = useFollowedIds()
  const query = useQuery({
    queryKey: ["public-pages", kind, search, page],
    queryFn: () =>
      communityApi<PageSlice<CommunityProfile>>(
        `/pages?${new URLSearchParams({ ...(kind ? { kind } : {}), q: search, page: String(page), size: "24" })}`,
      ),
  })
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
        <div className="hub-pills" role="group" aria-label="Loại trang">
          <button aria-pressed={!kind} onClick={() => update("kind", "")}>
            <StreamIcon name="grid" size={16} />
            Tất cả
          </button>
          {kinds.map((type) => (
            <button key={type} aria-pressed={kind === type} onClick={() => update("kind", type)}>
              <KindArt kind={type} />
              {profileKindLabels[type]}
            </button>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <div className="cp-grid" role="status" aria-label="Đang tải danh bạ">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="hub-skeleton cp-card-skeleton" key={index} />
          ))}
        </div>
      ) : query.isError ? (
        <div className="hub-state" role="alert">
          <StreamIcon name="reset" size={28} />
          <h2>{query.error.message}</h2>
          <button className="cp-button" onClick={() => void query.refetch()}>
            Thử lại
          </button>
        </div>
      ) : !query.data.items.length ? (
        <div className="hub-state">
          <StreamIcon name="grid" size={28} />
          <h2>{search ? "Chưa tìm thấy trang phù hợp" : "Danh bạ đang được xây dựng"}</h2>
          <p>Trang đã đối chiếu và công bố sẽ xuất hiện tại đây.</p>
          {search && (
            <button className="cp-button" onClick={() => update("q", "")}>
              Xóa tìm kiếm
            </button>
          )}
        </div>
      ) : (
        <div className="cp-grid">
          {query.data.items.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} following={following} />
          ))}
        </div>
      )}
      {query.data && query.data.totalElements > 24 && (
        <div className="hub-pagination">
          <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
            <StreamIcon name="chevronLeft" size={16} />
            Trước
          </button>
          <span>Trang {page + 1}</span>
          <button
            className="cp-button"
            disabled={(page + 1) * 24 >= query.data.totalElements}
            onClick={() => setPage(page + 1)}
          >
            Tiếp
            <StreamIcon name="chevronRight" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

/** `following` is null for signed-out viewers, who see no follow button. */
export function ProfileCard({ profile, following }: { profile: CommunityProfile; following: Set<string> | null }) {
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
          {profileKindLabels[profile.kind]}
          {profile.content?.country ? ` · ${profile.content.country}` : ""}
        </span>
        <strong className="cp-card-name">
          <span>{name}</span>
          {community && profile.represented && <OfficialBadge label="Đại diện đã xác minh" />}
        </strong>
        {!community && <span className="cp-card-meta">Tổng quan · Các mùa giải · Lịch sử</span>}
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
              {followed ? "Đang theo dõi" : "Theo dõi"}
            </button>
          </span>
        )}
      </span>
    </article>
  )
}
