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
  type PersonRole,
} from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { streamText, useStreamLocale } from "../../components/stream-locale"
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
import { ProfileAside, profileKindEnglish, regionName } from "./profile-aside"
import { LiveBlock, LiveControl, PageUpcoming, ProfileStats } from "./profile-home"

/** English names of the staff roles: `personRoleLabels` in the shared contracts carries the Vietnamese ones only. */
const personRoleEnglish: Record<PersonRole, string> = {
  COACH: "Coach",
  TEAM_ANALYST: "Team analyst",
  HOST: "Host",
  INTERVIEWER: "Interviewer",
  CASTER: "Caster",
  GUEST_ANALYST: "Guest analyst",
}

export function CommunityProfilePage() {
  const { text } = useStreamLocale()
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
        <div className="cp-container" role="status" aria-label={text("Đang tải hồ sơ", "Loading profile")}>
          <div className="hub-skeleton cp-header-skeleton" />
        </div>
      ) : profile.isError ? (
        <div className="cp-container">
          <div className="hub-state">
            <StreamIcon name="info" size={28} />
            <h1>{text("Chưa mở được hồ sơ", "Profile could not be opened")}</h1>
            <p role="alert">{profile.error.message}</p>
            <Link className="cp-button" to="/explore">
              {text("Về danh bạ", "Back to the directory")}
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

/**
 * Content first, introduction last; each kind of page gets the sections that make sense for it. The names follow the
 * reader's language, so call it while rendering.
 */
function profileTabs(kind: CommunityProfile["kind"]): [ProfileTab, string][] {
  if (kind === "ORGANIZATION")
    return [
      ["home", streamText("Trang chủ", "Home")],
      ["video", "Video"],
      ["competitions", streamText("Giải đấu", "Tournaments")],
      ["history", streamText("Lịch sử hoạt động", "Activity history")],
      ["overview", streamText("Giới thiệu", "About")],
    ]
  if (kind === "TEAM")
    return [
      ["home", streamText("Trang chủ", "Home")],
      ["video", "Video"],
      ["roster", streamText("Đội hình", "Roster")],
      ["competitions", streamText("Thi đấu", "Competitions")],
      ["achievements", streamText("Thành tích", "Achievements")],
      ["history", streamText("Lịch sử", "History")],
      ["overview", streamText("Giới thiệu", "About")],
    ]
  if (kind === "PLAYER")
    return [
      ["home", streamText("Trang chủ", "Home")],
      ["video", "Video"],
      ["history", streamText("Sự nghiệp", "Career")],
      ["competitions", streamText("Thi đấu", "Competitions")],
      ["achievements", streamText("Thành tích", "Achievements")],
      ["overview", streamText("Giới thiệu", "About")],
    ]
  return [
    ["home", streamText("Trang chủ", "Home")],
    ["video", "Video"],
    ["history", streamText("Sự nghiệp & hoạt động", "Career & activity")],
    ["overview", streamText("Giới thiệu", "About")],
  ]
}

function Profile({ profile }: { profile: CommunityProfile }) {
  const { text, languageTag } = useStreamLocale()
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
                ? content.personRoles?.map((role) => text(personRoleLabels[role], personRoleEnglish[role])).join(" · ")
                : null) || text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])}{" "}
              {content.country ? `· ${regionName(content.country, languageTag)}` : ""}
            </span>
            <h1>
              {content.name}
              {profile.represented && (
                <OfficialBadge
                  className="cp-official"
                  label={text("Đại diện đã xác minh", "Verified representative")}
                />
              )}
              {profile.live && <span className="cp-live-badge cp-title-live">{text("Trực tiếp", "Live")}</span>}
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
                signedIn(text(`Đăng nhập để theo dõi ${content.name}.`, `Sign in to follow ${content.name}.`), () =>
                  follow.mutate({ pageId: profile.id, following: !following }),
                )
              }
            >
              <StreamIcon name={following ? "check" : "plus"} size={16} />
              {following ? text("Đang theo dõi", "Following") : text("Theo dõi", "Follow")}
            </button>
            {["OWNER", "EDITOR"].includes(viewer.data?.role || "") && <LiveControl profile={profile} />}
            <ProfileOptions profile={profile} role={authenticated ? viewer.data?.role || undefined : undefined} />
          </div>
        </div>
        <nav className="cp-tabs cp-header-tabs" aria-label={text("Nội dung hồ sơ", "Profile content")}>
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
                <h2>{text("Giới thiệu", "About")}</h2>
                <p className="cp-prose">
                  {content.biography ||
                    text(
                      "Thông tin giới thiệu đang được bổ sung từ các nguồn công khai.",
                      "The introduction is being compiled from public sources.",
                    )}
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
                      <p className="cp-meta">{item.date || text("Chưa xác định ngày", "Unknown date")}</p>
                    </div>
                  </article>
                ))}
            </>
          )}
          {tab === "roster" && profile.kind === "TEAM" && (
            <section className="cp-panel">
              <h2>{text("Thành viên và ban huấn luyện", "Members and coaching staff")}</h2>
              {!content.roster.length && (
                <p className="cp-muted">
                  {text("Thông tin thành viên đang được bổ sung.", "Member information is being added.")}
                </p>
              )}
              {content.roster.map((item, i) => (
                <article className="cp-list-row" key={i}>
                  <div>
                    <h3>{item.pageId ? <Link to={`/pages/${item.pageId}`}>{item.name}</Link> : item.name}</h3>
                    <p>
                      {item.role} · {item.status || text("Chưa rõ trạng thái", "Unknown status")}
                    </p>
                    <p className="cp-meta">
                      {item.startsOn || text("Chưa rõ ngày bắt đầu", "Unknown start date")} →{" "}
                      {item.endsOn || text("Chưa ghi nhận kết thúc", "No end date recorded")}
                    </p>
                  </div>
                  {item.sourceUrl && (
                    <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                      {text("Nguồn", "Source")}
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
                    ? text("Sự nghiệp & hoạt động", "Career & activity")
                    : isOrganization
                      ? text("Lịch sử hoạt động", "Activity history")
                      : text("Lịch sử đội tuyển", "Team history")}
                </h2>
                {!content.history.length && (
                  <p className="cp-muted">
                    {text(
                      "Các mốc có nguồn đối chiếu sẽ được bổ sung tại đây.",
                      "Milestones with reference sources will be added here.",
                    )}
                  </p>
                )}
                <div className="cp-timeline">
                  {content.history.map((item, i) => (
                    <article key={i}>
                      <span className="cp-meta">
                        {item.startsOn || text("Chưa rõ ngày", "Unknown date")}
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
                          {text("Nguồn đối chiếu", "Reference source")}
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
              <h2>{text("Thành tích và danh hiệu", "Achievements and titles")}</h2>
              {!content.achievements.length && (
                <p className="cp-muted">{text("Chưa có thành tích được ghi nhận.", "No achievements recorded yet.")}</p>
              )}
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
                    <p className="cp-meta">{item.date || text("Chưa xác định ngày", "Unknown date")}</p>
                  </div>
                  {item.sourceUrl && (
                    <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                      {text("Nguồn", "Source")}
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
