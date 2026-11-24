import { useEffect, useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import {
  isIndividualProfile,
  personRoleLabels,
  profileKindLabels,
  type CommunityProfile,
  type CompetitionView,
  type PageRole,
  type ProfileHistory,
} from "@aov/community-contracts"
import { usePageLayout, type PageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamShell } from "../../../components/stream-shell"
import { RegionMark } from "../../../components/region-mark"
import { StreamIcon } from "../../../components/stream-icon"
import { streamText, useStreamLocale } from "../../../components/stream-locale"
import { CompetitionCard } from "../../../components/competition-card"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { pageReferenceKey } from "../../../lib/reference-model"
import { useCommunitySession } from "../../../lib/stream-auth"
import { CommunityFeed } from "../components/community-feed"
import { useFollowPage } from "../../../lib/community-queries"
import { useSignedInAction } from "../../../components/community-signin"
import {
  competitionsFeedQuery,
  followersLabel,
  personRoleEnglish,
  profileCompetitionFilter,
  profileKindEnglish,
  regionKey,
  regionName,
} from "../../../components/community-ui"
import { CircuitProfile } from "../components/circuit-profile"
import { ProfileAside } from "../components/profile-aside"
import { ProfileHead } from "../components/profile-head"
import { LiveBlock, LiveControl, ProfileMatches } from "../components/profile-home"
import { ProfileOptions } from "../components/profile-options"
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
} from "../components/profile-records"
import { ProfileSocials } from "../components/profile-socials"
import { ProfileTeams } from "../components/profile-teams"
import {
  OrganizationTeams,
  OrganizationTeamsPreview,
  organizationTeamsQuery,
  TeamOrganization,
  type OrganizationTeamsQuery,
} from "../components/profile-organization"
import { CompetitionList, ProfileCompetitionSummary } from "../../../components/public-competitions"
import "../components/community.css"
import "../components/community-profile.css"

export function CommunityProfilePage() {
  const { text } = useStreamLocale()
  const { code = "" } = useParams()
  const profile = useQuery({
    queryKey: communityKeys.publicPage(code),
    queryFn: () => communityApi.pageByAddress(code),
  })
  return (
    <StreamShell>
      {profile.isPending ? (
        <div className="cp-container pf-page" role="status" aria-label={text("Đang tải hồ sơ", "Loading profile")}>
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

type ProfileTab = "home" | "history" | "competitions" | "teams" | "achievements" | "overview"

/** Rows of a record the overview shows in full; a longer record gets a tab of its own. */
const PREVIEW = 3

/** Team cards an organization's overview shows, two to a row on a wide layout; more get a tab of their own. */
const teamPreview = (layout: PageLayout) => (layout === "compact" ? 4 : 6)

/**
 * The overview first, then only the sections that hold more than the overview already shows. The introduction and
 * its sources are the column beside the content on a wide layout and a tab of their own on a compact one. The names
 * follow the reader's language, so call it while rendering.
 */
function profileTabs(
  profile: CommunityProfile,
  layout: PageLayout,
  records: { history: number; achievements: number; competitions: number | undefined; teams: number | undefined },
): [ProfileTab, string][] {
  const individual = isIndividualProfile(profile.kind)
  const tabs: [ProfileTab, string][] = [["home", streamText("Tổng quan", "Overview")]]
  if (individual && records.history > PREVIEW) tabs.push(["history", streamText("Sự nghiệp", "Career")])
  // Shown while the count is still loading, so the row does not shift for the many pages that have competitions.
  if (profileCompetitionFilter(profile) && records.competitions !== 0)
    tabs.push([
      "competitions",
      profile.kind === "ORGANIZATION" ? streamText("Giải đấu", "Tournaments") : streamText("Thi đấu", "Competitions"),
    ])
  if (profile.kind === "ORGANIZATION" && (records.teams ?? 0) > teamPreview(layout))
    tabs.push(["teams", streamText("Đội tuyển", "Teams")])
  if (profile.kind !== "ORGANIZATION" && records.achievements > PREVIEW)
    tabs.push(["achievements", streamText("Thành tích", "Achievements")])
  if (!individual && records.history > 0) tabs.push(["history", streamText("Lịch sử", "History")])
  if (layout === "compact") tabs.push(["overview", streamText("Giới thiệu", "About")])
  return tabs
}

function Profile({ profile }: { profile: CommunityProfile }) {
  const { text, languageTag } = useStreamLocale()
  const layout = usePageLayout()
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const [params, setParams] = useSearchParams()
  const content = profile.content!
  const authenticated = session.status === "authenticated"
  const viewer = useQuery({
    queryKey: communityKeys.viewer(session.revision, profile.id),
    queryFn: () => communityApi.viewer(profile.id),
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
  const ownedTeams = useInfiniteQuery({ ...organizationTeamsQuery(profile.id), enabled: organization })
  const teamCount = ownedTeams.data?.pages[0]?.totalElements

  const tabs = profileTabs(profile, layout, {
    history: history.length,
    achievements: achievements.length,
    competitions: competitionCount,
    teams: teamCount,
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
  // A link of the overview opens another tab and goes away with the overview; keyboard focus moves to that tab.
  const tabButtons = useRef(new Map<ProfileTab, HTMLButtonElement>())
  const focusTab = useRef<ProfileTab | null>(null)
  useEffect(() => {
    if (focusTab.current !== tab) return
    focusTab.current = null
    tabButtons.current.get(tab)?.focus()
  }, [tab])
  const openTab = (next: ProfileTab) => {
    focusTab.current = next
    setTab(next)
  }

  const region = regionName(content.country, languageTag)
  const kind =
    (profile.kind === "PERSON" &&
      content.personRoles?.map((role) => text(personRoleLabels[role], personRoleEnglish[role])).join(", ")) ||
    text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])
  const achievementTotal = achievementCount(achievements)
  const facts = [
    profile.followers > 0 && followersLabel(profile.followers),
    !!competitionCount &&
      (organization
        ? text(
            `${competitionCount.toLocaleString(languageTag)} giải đấu`,
            `${competitionCount.toLocaleString(languageTag)} ${competitionCount === 1 ? "tournament" : "tournaments"}`,
          )
        : text(
            `${competitionCount.toLocaleString(languageTag)} giải đã tham gia`,
            `${competitionCount.toLocaleString(languageTag)} ${competitionCount === 1 ? "tournament" : "tournaments"} played`,
          )),
    organization &&
      !!teamCount &&
      text(
        `${teamCount.toLocaleString(languageTag)} đội tuyển`,
        `${teamCount.toLocaleString(languageTag)} ${teamCount === 1 ? "team" : "teams"}`,
      ),
    achievements.length > 0 &&
      text(
        `${achievementTotal.toLocaleString(languageTag)} thành tích`,
        `${achievementTotal.toLocaleString(languageTag)} ${achievementTotal === 1 ? "achievement" : "achievements"}`,
      ),
    profile.kind === "TEAM" &&
      content.roster.length > 0 &&
      text(
        `${content.roster.length} thành viên`,
        `${content.roster.length} ${content.roster.length === 1 ? "member" : "members"}`,
      ),
    individual &&
      history.length > 0 &&
      text(
        `${history.length} mốc sự nghiệp`,
        `${history.length} career ${history.length === 1 ? "milestone" : "milestones"}`,
      ),
  ].filter((fact) => !!fact)
  return (
    <div className="cp-container pf-page">
      <title>{`${content.name} — AOV Stream`}</title>
      <ProfileHead
        profile={profile}
        kicker={
          region ? (
            <>
              {kind} · <RegionMark code={regionKey(content.country)} size={16} /> {region}
            </>
          ) : (
            kind
          )
        }
        lines={
          individual ? (
            <ProfileTeams pageId={profile.id} />
          ) : (
            profile.kind === "TEAM" &&
            content.organizationId && <TeamOrganization organizationId={content.organizationId} />
          )
        }
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
          </>
        }
      />
      {tabs.length > 1 && (
        <nav className="cp-tabs" aria-label={text("Nội dung hồ sơ", "Profile content")}>
          {tabs.map(([value, label]) => (
            <button
              key={value}
              ref={(button) => {
                if (button) tabButtons.current.set(value, button)
                else tabButtons.current.delete(value)
              }}
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
              ownedTeams={ownedTeams}
              role={viewer.data?.role || ""}
              authenticated={authenticated}
              open={openTab}
            />
          )}
          {tab === "teams" && <OrganizationTeams query={ownedTeams} />}
          {tab === "history" && (
            <section aria-label={individual ? text("Sự nghiệp", "Career") : text("Lịch sử", "History")}>
              <HistoryRows items={history} links={links} about={pageReferenceKey(profile)} />
            </section>
          )}
          {tab === "competitions" &&
            (organization ? <CompetitionList profile={profile} /> : <ProfileCompetitionSummary profile={profile} />)}
          {tab === "achievements" && (
            <section aria-label={text("Thành tích", "Achievements")}>
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
  ownedTeams,
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
  /** The teams an organization owns; an empty read for other pages. */
  ownedTeams: OrganizationTeamsQuery
  role: PageRole | ""
  authenticated: boolean
  open: (tab: ProfileTab) => void
}) {
  const { text, languageTag } = useStreamLocale()
  const content = profile.content!
  const individual = isIndividualProfile(profile.kind)
  const organization = profile.kind === "ORGANIZATION"
  const layout = usePageLayout()
  // Competition cards take a row each on a compact layout, so fewer of them stand before the posts.
  const organized = views.slice(0, layout === "compact" ? 3 : 6)
  const [onlyVideo, setOnlyVideo] = useState(false)
  const posts = useQuery({
    queryKey: communityKeys.pagePostCount(profile.id),
    queryFn: () => communityApi.pagePostCount(profile.id),
  })
  const videos = useQuery({
    queryKey: communityKeys.pagePostCount(profile.id, "VIDEO"),
    queryFn: () => communityApi.pagePostCount(profile.id, "VIDEO"),
  })
  const postCount = posts.data?.totalElements
  const hasVideos = !!videos.data?.totalElements
  // Readers who are signed in can write on the page, so they get the feed even while it is empty.
  const feed = authenticated || !!postCount
  const missing = [
    profile.kind === "TEAM" && !content.roster.length && text("đội hình", "roster"),
    (profile.kind === "TEAM" || profile.kind === "PLAYER") &&
      !achievements.length &&
      text("thành tích", "achievements"),
    competitionCount === 0 && (organization ? "giải đấu đã tổ chức" : "giải đấu đã tham gia"),
    !content.biography && text("phần giới thiệu", "introduction"),
    !content.sources.length && text("nguồn đối chiếu", "sources"),
  ].filter((entry) => !!entry)
  return (
    <>
      {profile.live && <LiveBlock live={profile.live} name={content.name} />}
      <ProfileMatches profile={profile} views={views} pending={competitionsPending} more={() => open("competitions")} />
      {profile.kind === "TEAM" && content.roster.length > 0 && <TeamRoster roster={content.roster} />}
      {organization && (
        <OrganizationTeamsPreview query={ownedTeams} count={teamPreview(layout)} more={() => open("teams")} />
      )}
      {organization && views.length > 0 && (
        <section aria-labelledby="profile-organized">
          <div className="tn-heading">
            <h2 id="profile-organized">
              {text("Giải đấu tổ chức", "Tournaments organized")}{" "}
              {!!competitionCount && <small>{competitionCount.toLocaleString(languageTag)}</small>}
            </h2>
            {(competitionCount ?? 0) > organized.length && (
              <button type="button" onClick={() => open("competitions")}>
                {text("Xem tất cả", "See all")}
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
            <h2 id="profile-career">{text("Sự nghiệp", "Career")}</h2>
            {history.length > PREVIEW && (
              <button type="button" onClick={() => open("history")}>
                {text(`Tất cả ${history.length} mốc`, `All ${history.length} milestones`)}
                <StreamIcon name="arrow" size={15} />
              </button>
            )}
          </div>
          <HistoryRows items={history.slice(0, PREVIEW)} links={links} about={pageReferenceKey(profile)} />
        </section>
      )}
      {!organization && achievements.length > 0 && (
        <section aria-labelledby="profile-achievements">
          <div className="tn-heading">
            <h2 id="profile-achievements">{text("Thành tích", "Achievements")}</h2>
            {achievements.length > PREVIEW && (
              <button type="button" onClick={() => open("achievements")}>
                {text("Tất cả thành tích", "All achievements")}
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
            <h2 id="profile-posts">{text("Bài viết", "Posts")}</h2>
          </div>
          {hasVideos && (
            <div className="hub-pills pf-post-kinds" role="group" aria-label={text("Loại bài viết", "Post type")}>
              <button type="button" aria-pressed={!onlyVideo} onClick={() => setOnlyVideo(false)}>
                {text("Tất cả", "All")}
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
          {text(
            `Trang này chưa ghi nhận ${missing.join(", ")}.`,
            `This page has no ${missing.join(", ")} recorded yet.`,
          )}
          {!profile.represented &&
            text(
              " Bạn có thông tin? Chọn nút ⋯ ở đầu trang để đề xuất chỉnh sửa.",
              " Know more? Choose the ⋯ button at the top of the page to suggest a change.",
            )}
        </p>
      )}
    </>
  )
}
