import { useState, type CSSProperties } from "react"
import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  isIndividualProfile,
  personRoleLabels,
  profileKindLabels,
  type CommunityProfile,
  type PageSlice,
  type PageViewer,
} from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { useCommunitySession } from "./community-auth"
import { Avatar, followersLabel, hueOf, kindIcons } from "./community-ui"
import { CommunityFeed } from "./community-feed"
import { useFollowPage } from "./community-queries"
import { useSignedInAction } from "./community-signin"
import { ProfileCompetitionSummary } from "./public-competitions"
import { ProfileTeams } from "./profile-teams"
import { ProfileOptions } from "./profile-options"
import { ProfileSocials } from "./profile-socials"
import { CircuitProfile } from "./circuit-profile"
import { ProfileAside, regionName } from "./profile-aside"
import { LiveBlock, LiveControl, PageUpcoming, ProfileStats } from "./profile-home"

export function CommunityProfilePage() {
  const { code = "" } = useParams()
  const profile = useQuery({
    queryKey: ["public-page", code],
    queryFn: () =>
      communityApi<CommunityProfile>(
        `/pages/${/^[0-9a-f-]{36}$/i.test(code) ? encodeURIComponent(code) : `by-code/${encodeURIComponent(code)}`}`,
      ),
  })
  return (
    <StreamShell>
      {profile.isPending ? (
        <div className="cp-container" role="status" aria-label="Đang tải hồ sơ">
          <div className="hub-skeleton cp-header-skeleton" />
        </div>
      ) : profile.isError ? (
        <div className="cp-container">
          <div className="hub-state">
            <StreamIcon name="info" size={28} />
            <h1>Chưa mở được hồ sơ</h1>
            <p role="alert">{profile.error.message}</p>
            <Link className="cp-button" to="/explore">
              Về danh bạ
            </Link>
          </div>
        </div>
      ) : profile.data.kind === "CIRCUIT" ? (
        <CircuitProfile key={profile.data.id} profile={profile.data} />
      ) : (
        <Profile key={profile.data.id} profile={profile.data} />
      )}
    </StreamShell>
  )
}
type ProfileTab = "home" | "video" | "roster" | "history" | "competitions" | "achievements" | "overview"

/** Content first, introduction last; each kind of page gets the sections that make sense for it. */
function profileTabs(kind: CommunityProfile["kind"]): [ProfileTab, string][] {
  if (kind === "ORGANIZATION")
    return [
      ["home", "Trang chủ"],
      ["video", "Video"],
      ["competitions", "Giải đấu"],
      ["history", "Lịch sử hoạt động"],
      ["overview", "Giới thiệu"],
    ]
  if (kind === "TEAM")
    return [
      ["home", "Trang chủ"],
      ["video", "Video"],
      ["roster", "Đội hình"],
      ["competitions", "Thi đấu"],
      ["achievements", "Thành tích"],
      ["history", "Lịch sử"],
      ["overview", "Giới thiệu"],
    ]
  if (kind === "PLAYER")
    return [
      ["home", "Trang chủ"],
      ["video", "Video"],
      ["history", "Sự nghiệp"],
      ["competitions", "Thi đấu"],
      ["achievements", "Thành tích"],
      ["overview", "Giới thiệu"],
    ]
  return [
    ["home", "Trang chủ"],
    ["video", "Video"],
    ["history", "Sự nghiệp & hoạt động"],
    ["overview", "Giới thiệu"],
  ]
}

function Profile({ profile }: { profile: CommunityProfile }) {
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const [picked, setTab] = useState<ProfileTab | null>(null)
  // A page without posts or a broadcast opens on its introduction instead of an empty feed.
  const postCount = useQuery({
    queryKey: ["page-post-count", profile.id],
    queryFn: () => communityApi<PageSlice<unknown>>(`/pages/${profile.id}/posts?size=1`),
    enabled: profile.kind !== "CIRCUIT",
  })
  const tab: ProfileTab = picked ?? (!profile.live && postCount.data?.totalElements === 0 ? "overview" : "home")
  const viewer = useQuery({
    queryKey: ["page-viewer", session.revision, profile.id],
    queryFn: () => communityApi<PageViewer>(`/me/pages/${profile.id}`),
    enabled: session.status === "authenticated",
  })
  const follow = useFollowPage()
  const content = profile.content!
  const isOrganization = profile.kind === "ORGANIZATION"
  const tabs = profileTabs(profile.kind)
  const authenticated = session.status === "authenticated"
  const following = authenticated && !!viewer.data?.following
  return (
    <div className="cp-container">
      <title>{`${content.name} — AOV Stream`}</title>
      <header className="hub-card cp-page-header">
        <div
          className="cp-cover hub-art"
          style={
            {
              "--hub-hue": hueOf(content.name),
              ...(content.coverUrl ? { backgroundImage: `url(${JSON.stringify(content.coverUrl)})` } : {}),
            } as CSSProperties
          }
        >
          <ProfileSocials links={content.links} />
        </div>
        <div className="cp-identity" data-live={profile.live ? true : undefined}>
          <Avatar profile={profile} />
          <div className="cp-identity-title">
            <span className="hub-kicker">
              <StreamIcon name={kindIcons[profile.kind]} size={14} />
              {(profile.kind === "PERSON"
                ? content.personRoles?.map((role) => personRoleLabels[role]).join(" · ")
                : null) || profileKindLabels[profile.kind]}{" "}
              {content.country ? `· ${regionName(content.country)}` : ""}
            </span>
            <h1>
              {content.name}
              {profile.represented && <OfficialBadge className="cp-official" label="Đại diện đã xác minh" />}
              {profile.live && <span className="cp-live-badge cp-title-live">Trực tiếp</span>}
            </h1>
            <p className="cp-identity-meta">
              <span>
                <StreamIcon name="users" size={14} />
                {followersLabel(profile.followers)}
              </span>
            </p>
          </div>
          <div className="cp-actions cp-profile-actions">
            <button
              type="button"
              className={following ? "cp-button" : "cp-button cp-primary"}
              aria-pressed={following}
              disabled={follow.isPending || (authenticated && !viewer.data)}
              onClick={() =>
                signedIn(`Đăng nhập để theo dõi ${content.name}.`, () =>
                  follow.mutate({ pageId: profile.id, following: !following }),
                )
              }
            >
              <StreamIcon name={following ? "check" : "plus"} size={16} />
              {following ? "Đang theo dõi" : "Theo dõi"}
            </button>
            {["OWNER", "EDITOR"].includes(viewer.data?.role || "") && <LiveControl profile={profile} />}
            <ProfileOptions profile={profile} role={authenticated ? viewer.data?.role || undefined : undefined} />
          </div>
        </div>
        <nav className="cp-tabs cp-header-tabs" aria-label="Nội dung hồ sơ">
          {tabs.map(([value, label]) => (
            <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <ProfileStats profile={profile} />
      {(follow.isError || viewer.isError) && (
        <p className="cp-error" role="alert">
          {follow.error?.message || viewer.error?.message}
        </p>
      )}
      <div className="cp-columns">
        <div className="cp-main-column">
          {tab === "competitions" && <ProfileCompetitionSummary profile={profile} />}
          {tab === "overview" && (
            <>
              <section className="cp-panel">
                <h2>Giới thiệu</h2>
                <p className="cp-prose">
                  {content.biography || "Thông tin giới thiệu đang được bổ sung từ các nguồn công khai."}
                </p>
              </section>
              <ProfileAside profile={profile} inline />
              {!isOrganization &&
                content.achievements.slice(0, 3).map((item, i) => (
                  <article className="cp-panel cp-highlight" key={i}>
                    <span className="cp-highlight-icon" aria-hidden="true">
                      <StreamIcon name="trophy" size={22} />
                    </span>
                    <div>
                      <span className="hub-kicker">{item.placement}</span>
                      <h2>{item.title}</h2>
                      <p className="cp-meta">{item.date || "Chưa xác định ngày"}</p>
                    </div>
                  </article>
                ))}
            </>
          )}
          {tab === "roster" && profile.kind === "TEAM" && (
            <section className="cp-panel">
              <h2>Thành viên và ban huấn luyện</h2>
              {!content.roster.length && <p className="cp-muted">Thông tin thành viên đang được bổ sung.</p>}
              {content.roster.map((item, i) => (
                <article className="cp-list-row" key={i}>
                  <div>
                    <h3>{item.pageId ? <Link to={`/pages/${item.pageId}`}>{item.name}</Link> : item.name}</h3>
                    <p>
                      {item.role} · {item.status || "Chưa rõ trạng thái"}
                    </p>
                    <p className="cp-meta">
                      {item.startsOn || "Chưa rõ ngày bắt đầu"} → {item.endsOn || "Chưa ghi nhận kết thúc"}
                    </p>
                  </div>
                  {item.sourceUrl && (
                    <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                      Nguồn
                      <StreamIcon name="external" size={12} />
                    </a>
                  )}
                </article>
              ))}
            </section>
          )}
          {tab === "history" && (
            <>
              {isIndividualProfile(profile.kind) && <ProfileTeams pageId={profile.id} />}
              <section className="cp-panel">
                <h2>
                  {isIndividualProfile(profile.kind)
                    ? "Sự nghiệp & hoạt động"
                    : isOrganization
                      ? "Lịch sử hoạt động"
                      : "Lịch sử đội tuyển"}
                </h2>
                {!content.history.length && (
                  <p className="cp-muted">Các mốc có nguồn đối chiếu sẽ được bổ sung tại đây.</p>
                )}
                <div className="cp-timeline">
                  {content.history.map((item, i) => (
                    <article key={i}>
                      <span className="cp-meta">
                        {item.startsOn || "Chưa rõ ngày"}
                        {item.endsOn ? ` — ${item.endsOn}` : ""}
                      </span>
                      <h3>
                        {item.relatedPageId ? (
                          <Link to={`/pages/${item.relatedPageId}`}>{item.title}</Link>
                        ) : (
                          item.title
                        )}
                      </h3>
                      {item.role && <p>{item.role}</p>}
                      {item.sourceUrl && (
                        <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                          Nguồn đối chiếu
                          <StreamIcon name="external" size={12} />
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
          {tab === "achievements" && !isOrganization && (
            <section className="cp-panel">
              <h2>Thành tích và danh hiệu</h2>
              {!content.achievements.length && <p className="cp-muted">Chưa có thành tích được ghi nhận.</p>}
              {content.achievements.map((item, i) => (
                <article className="cp-list-row" key={i}>
                  <span className="cp-placement">{item.placement}</span>
                  <div>
                    <h3>
                      {item.tournamentId ? (
                        <Link to={`/competitions/${item.tournamentId}`}>{item.title}</Link>
                      ) : (
                        item.title
                      )}
                    </h3>
                    <p className="cp-meta">{item.date || "Chưa xác định ngày"}</p>
                  </div>
                  {item.sourceUrl && (
                    <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                      Nguồn
                      <StreamIcon name="external" size={12} />
                    </a>
                  )}
                </article>
              ))}
            </section>
          )}
          {tab === "home" && (
            <>
              {profile.live && <LiveBlock live={profile.live} name={content.name} />}
              <PageUpcoming profile={profile} />
              <CommunityFeed
                pageId={profile.id}
                pageName={content.name}
                role={viewer.data?.role || ""}
                represented={profile.represented}
              />
            </>
          )}
          {tab === "video" && (
            <CommunityFeed
              key="video"
              pageId={profile.id}
              pageName={content.name}
              role={viewer.data?.role || ""}
              represented={profile.represented}
              kind="VIDEO"
              composer={false}
            />
          )}
        </div>
        <ProfileAside profile={profile} />
      </div>
    </div>
  )
}
