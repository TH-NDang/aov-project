import { useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import {
  isIndividualProfile,
  personRoleLabels,
  profileKindLabels,
  type CommunityProfile,
  type CompetitionView,
  type PageRole,
  type PageSlice,
  type PageViewer,
  type ProfileHistory,
} from "@aov/community-contracts"
import { usePageLayout, type PageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { CompetitionCard } from "../tournaments/competition-card"
import { communityApi } from "./community-api"
import { useCommunitySession } from "./community-auth"
import { CommunityFeed } from "./community-feed"
import { useFollowPage } from "./community-queries"
import { useSignedInAction } from "./community-signin"
import { competitionsFeedQuery, followersLabel, profileCompetitionFilter, regionName } from "./community-ui"
import { CircuitProfile } from "./circuit-profile"
import { ProfileAside } from "./profile-aside"
import { ProfileHead } from "./profile-head"
import { LiveBlock, LiveControl, ProfileMatches } from "./profile-home"
import { ProfileOptions } from "./profile-options"
import {
  AchievementRows,
  HistoryRows,
  TeamRoster,
  achievementCount,
  achievementGroups,
  competitionLinks,
  distinctHistory,
  type AchievementGroup,
  type CompetitionLinks,
} from "./profile-records"
import { ProfileSocials } from "./profile-socials"
import { ProfileTeams } from "./profile-teams"
import { CompetitionList, ProfileCompetitionSummary } from "./public-competitions"
import "./community.css"
import "./community-profile.css"

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
        <div className="cp-container pf-page" role="status" aria-label="Đang tải hồ sơ">
          <div className="pf-skeleton-head">
            <span className="hub-skeleton" />
            <div>
              <span className="hub-skeleton" />
              <span className="hub-skeleton" />
              <span className="hub-skeleton" />
            </div>
          </div>
          <div className="pf-skeleton-tabs" />
          <div className="hub-skeleton-rows" />
        </div>
      ) : profile.isError ? (
        <div className="cp-container">
          <div className="hub-state">
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

type ProfileTab = "home" | "history" | "competitions" | "achievements" | "overview"

/** Rows of a record the overview shows in full; a longer record gets a tab of its own. */
const PREVIEW = 3

/**
 * The overview first, then only the sections that hold more than the overview already shows. The introduction and
 * its sources are the column beside the content on a wide layout and a tab of their own on a compact one.
 */
function profileTabs(
  profile: CommunityProfile,
  layout: PageLayout,
  records: { history: number; achievements: number; competitions: number | undefined },
): [ProfileTab, string][] {
  const individual = isIndividualProfile(profile.kind)
  const tabs: [ProfileTab, string][] = [["home", "Tổng quan"]]
  if (individual && records.history > PREVIEW) tabs.push(["history", "Sự nghiệp"])
  // Shown while the count is still loading, so the row does not shift for the many pages that have competitions.
  if (profileCompetitionFilter(profile) && records.competitions !== 0)
    tabs.push(["competitions", profile.kind === "ORGANIZATION" ? "Giải đấu" : "Thi đấu"])
  if (profile.kind !== "ORGANIZATION" && records.achievements > PREVIEW) tabs.push(["achievements", "Thành tích"])
  if (!individual && records.history > 0) tabs.push(["history", "Lịch sử"])
  if (layout === "compact") tabs.push(["overview", "Giới thiệu"])
  return tabs
}

function Profile({ profile }: { profile: CommunityProfile }) {
  const layout = usePageLayout()
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const [params, setParams] = useSearchParams()
  const content = profile.content!
  const authenticated = session.status === "authenticated"
  const viewer = useQuery({
    queryKey: ["page-viewer", session.revision, profile.id],
    queryFn: () => communityApi<PageViewer>(`/me/pages/${profile.id}`),
    enabled: authenticated,
  })
  const follow = useFollowPage()
  const following = authenticated && !!viewer.data?.following
  // The newest competitions of the page serve its head, its overview and the links of its records.
  const filter = profileCompetitionFilter(profile)
  const competitions = useInfiniteQuery({ ...competitionsFeedQuery(filter || {}), enabled: !!filter })
  const views = competitions.data?.pages.flatMap((page) => page.items) ?? []
  const competitionCount = competitions.data?.pages[0]?.totalElements
  const links = competitionLinks(views)
  const achievements = achievementGroups(content.achievements, links)
  const history = distinctHistory(content.history)
  const individual = isIndividualProfile(profile.kind)
  const organization = profile.kind === "ORGANIZATION"

  const tabs = profileTabs(profile, layout, {
    history: history.length,
    achievements: achievements.length,
    competitions: competitionCount,
  })
  const requested = params.get("tab")
  const tab = tabs.find(([key]) => key === requested)?.[0] ?? "home"
  const setTab = (next: ProfileTab) =>
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (next === "home") updated.delete("tab")
      else updated.set("tab", next)
      return updated
    })

  const region = regionName(content.country)
  const kind =
    (profile.kind === "PERSON" && content.personRoles?.map((role) => personRoleLabels[role]).join(", ")) ||
    profileKindLabels[profile.kind]
  const facts = [
    profile.followers > 0 && followersLabel(profile.followers),
    !!competitionCount &&
      `${competitionCount.toLocaleString("vi-VN")} ${organization ? "giải đấu" : "giải đã tham gia"}`,
    achievements.length > 0 && `${achievementCount(achievements).toLocaleString("vi-VN")} thành tích`,
    profile.kind === "TEAM" && content.roster.length > 0 && `${content.roster.length} thành viên`,
    individual && history.length > 0 && `${history.length} mốc sự nghiệp`,
  ].filter((fact) => !!fact)
  return (
    <div className="cp-container pf-page">
      <title>{`${content.name} — AOV Stream`}</title>
      <ProfileHead
        profile={profile}
        kicker={region ? `${kind} · ${region}` : kind}
        lines={individual && <ProfileTeams pageId={profile.id} />}
        facts={facts}
        channels={layout === "compact" && <ProfileSocials links={content.links} />}
        actions={
          <>
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
          </>
        }
      />
      {tabs.length > 1 && (
        <nav className="cp-tabs" aria-label="Nội dung hồ sơ">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-current={tab === value ? "page" : undefined}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {(follow.isError || viewer.isError) && (
        <p className="cp-error" role="alert">
          {follow.error?.message || viewer.error?.message}
        </p>
      )}
      <div className="pf-layout">
        <div className="pf-main">
          {tab === "home" && (
            <ProfileHome
              profile={profile}
              views={views}
              competitionsPending={!!filter && competitions.isPending}
              competitionCount={competitionCount}
              achievements={achievements}
              history={history}
              links={links}
              role={viewer.data?.role || ""}
              authenticated={authenticated}
              open={setTab}
            />
          )}
          {tab === "history" && (
            <section aria-label={individual ? "Sự nghiệp" : "Lịch sử"}>
              <HistoryRows items={history} links={links} />
            </section>
          )}
          {tab === "competitions" &&
            (organization ? <CompetitionList profile={profile} /> : <ProfileCompetitionSummary profile={profile} />)}
          {tab === "achievements" && (
            <section aria-label="Thành tích">
              <AchievementRows groups={achievements} />
            </section>
          )}
          {tab === "overview" && <ProfileAside profile={profile} channels={false} />}
        </div>
        {layout === "wide" && <ProfileAside profile={profile} />}
      </div>
    </div>
  )
}

/**
 * What a reader comes to the page for, in the order they ask it: a broadcast that is on, the matches around now,
 * the squad or the latest of a career, the best of the record, then the page's posts. What the page does not
 * record is said once at the end.
 */
function ProfileHome({
  profile,
  views,
  competitionsPending,
  competitionCount,
  achievements,
  history,
  links,
  role,
  authenticated,
  open,
}: {
  profile: CommunityProfile
  views: CompetitionView[]
  competitionsPending: boolean
  competitionCount: number | undefined
  achievements: AchievementGroup[]
  history: ProfileHistory[]
  links: CompetitionLinks
  role: PageRole | ""
  authenticated: boolean
  open: (tab: ProfileTab) => void
}) {
  const content = profile.content!
  const individual = isIndividualProfile(profile.kind)
  const organization = profile.kind === "ORGANIZATION"
  // Competition cards take a row each on a compact layout, so fewer of them stand before the posts.
  const organized = views.slice(0, usePageLayout() === "compact" ? 3 : 6)
  const [onlyVideo, setOnlyVideo] = useState(false)
  const posts = useQuery({
    queryKey: ["page-post-count", profile.id],
    queryFn: () => communityApi<PageSlice<unknown>>(`/pages/${profile.id}/posts?size=1`),
  })
  const videos = useQuery({
    queryKey: ["page-post-count", profile.id, "VIDEO"],
    queryFn: () => communityApi<PageSlice<unknown>>(`/pages/${profile.id}/posts?kind=VIDEO&size=1`),
  })
  const postCount = posts.data?.totalElements
  const hasVideos = !!videos.data?.totalElements
  // Readers who are signed in can write on the page, so they get the feed even while it is empty.
  const feed = authenticated || !!postCount
  const missing = [
    profile.kind === "TEAM" && !content.roster.length && "đội hình",
    (profile.kind === "TEAM" || profile.kind === "PLAYER") && !achievements.length && "thành tích",
    competitionCount === 0 && (organization ? "giải đấu đã tổ chức" : "giải đấu đã tham gia"),
    !content.biography && "phần giới thiệu",
    !content.sources.length && "nguồn đối chiếu",
  ].filter((entry) => !!entry)
  return (
    <>
      {profile.live && <LiveBlock live={profile.live} name={content.name} />}
      <ProfileMatches profile={profile} views={views} pending={competitionsPending} more={() => open("competitions")} />
      {profile.kind === "TEAM" && content.roster.length > 0 && <TeamRoster roster={content.roster} />}
      {organization && views.length > 0 && (
        <section aria-labelledby="profile-organized">
          <div className="tn-heading">
            <h2 id="profile-organized">
              Giải đấu tổ chức {!!competitionCount && <small>{competitionCount.toLocaleString("vi-VN")}</small>}
            </h2>
            {(competitionCount ?? 0) > organized.length && (
              <button type="button" onClick={() => open("competitions")}>
                Xem tất cả
                <StreamIcon name="arrow" size={15} />
              </button>
            )}
          </div>
          <div className="tn-card-grid">
            {organized.map((entry) => (
              <CompetitionCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
      {individual && history.length > 0 && (
        <section aria-labelledby="profile-career">
          <div className="tn-heading">
            <h2 id="profile-career">Sự nghiệp</h2>
            {history.length > PREVIEW && (
              <button type="button" onClick={() => open("history")}>
                Tất cả {history.length} mốc
                <StreamIcon name="arrow" size={15} />
              </button>
            )}
          </div>
          <HistoryRows items={history.slice(0, PREVIEW)} links={links} />
        </section>
      )}
      {!organization && achievements.length > 0 && (
        <section aria-labelledby="profile-achievements">
          <div className="tn-heading">
            <h2 id="profile-achievements">Thành tích</h2>
            {achievements.length > PREVIEW && (
              <button type="button" onClick={() => open("achievements")}>
                Tất cả thành tích
                <StreamIcon name="arrow" size={15} />
              </button>
            )}
          </div>
          <AchievementRows groups={achievements.slice(0, PREVIEW)} />
        </section>
      )}
      {feed && (
        <section className="pf-posts" aria-labelledby="profile-posts">
          <div className="tn-heading">
            <h2 id="profile-posts">Bài viết</h2>
          </div>
          {hasVideos && (
            <div className="hub-pills" role="group" aria-label="Loại bài viết">
              <button type="button" aria-pressed={!onlyVideo} onClick={() => setOnlyVideo(false)}>
                Tất cả
              </button>
              <button type="button" aria-pressed={onlyVideo} onClick={() => setOnlyVideo(true)}>
                <StreamIcon name="play" size={14} />
                Video
              </button>
            </div>
          )}
          <CommunityFeed
            key={onlyVideo ? "video" : "all"}
            pageId={profile.id}
            pageName={content.name}
            role={role}
            represented={profile.represented}
            kind={onlyVideo ? "VIDEO" : undefined}
            composer={!onlyVideo}
          />
        </section>
      )}
      {missing.length > 0 && (
        <p className="pf-note">
          Trang này chưa ghi nhận {missing.join(", ")}.
          {!profile.represented && " Bạn có thông tin? Chọn nút ⋯ ở đầu trang để đề xuất chỉnh sửa."}
        </p>
      )}
    </>
  )
}
