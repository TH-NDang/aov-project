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
import { readStanding } from "@aov/community-contracts/achievements"
import { usePageLayout, type PageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamShell } from "../../../components/stream-shell"
import { RegionMark } from "../../../components/region-mark"
import { StreamIcon } from "../../../components/stream-icon"
import { streamText, useStreamLocale } from "../../../components/stream-locale"
import { CompetitionCard } from "../../../components/competition-card"
import { Jersey } from "../../../components/jersey"
import type { HeadFigure } from "../../../components/page-head"
import { StreamImage } from "../../../components/stream-image"
import { TeamLineup } from "../../../components/team-lineup"
import { TitleShelf } from "../../../components/title-shelf"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { competitionLineup, rosterLineup } from "../../../lib/lineup-model"
import { playerProfile, playerStints, teamProfile, type PlayerProfile } from "../../../lib/participant-model"
import { pageReferenceKey, plainReferences } from "../../../lib/reference-model"
import { pageSummary } from "../../../lib/stream-head"
import { useCommunitySession } from "../../../lib/stream-auth"
import { teamCompetitionsQuery } from "../../../lib/tournament-api"
import { CommunityFeed } from "../components/community-feed"
import { useFollowPage } from "../../../lib/community-queries"
import { useSignedInAction } from "../../../components/community-signin"
import {
  competitionsFeedQuery,
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
import { AchievementRows, HistoryRows } from "../components/profile-records"
import { ProfileSocials } from "../components/profile-socials"
import { ProfileTeams } from "../components/profile-teams"
import { TeamRoster } from "../components/team-roster"
import {
  achievementGroups,
  competitionLinks,
  distinctHistory,
  isTitle,
  withPublishedPlaces,
  type AchievementGroup,
  type CompetitionLinks,
} from "../model/profile-records-model"
import { rosterGroups } from "../model/team-roster-model"
import {
  OrganizationTeams,
  OrganizationTeamsPreview,
  organizationTeamsQuery,
  TeamOrganization,
  type OrganizationTeamsQuery,
} from "../components/profile-organization"
import { CompetitionList, ProfileCompetitionSummary } from "../../../components/public-competitions"
import { StreamHead } from "../../../components/stream-head"
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

/**
 * The achievements of a page: what its record holds, with the places its team took in the competitions published
 * here, which come along. A team's places come from every competition it played, a player's from the newest.
 */
function useAchievements(profile: CommunityProfile, links: CompetitionLinks, career: PlayerProfile | null) {
  const { text } = useStreamLocale()
  const teamId = profile.kind === "TEAM" ? profile.entityId : null
  const played = useQuery({ ...teamCompetitionsQuery(teamId ?? ""), enabled: !!teamId })
  const places = teamId ? (teamProfile(played.data ?? [], teamId)?.seasons ?? []) : (career?.seasons ?? [])
  const word = (place: string) => {
    const standing = readStanding(place)
    if (standing?.place === 1 && !standing.placeTo) return text("Vô địch", "Champion")
    if (standing?.place === 2 && !standing.placeTo) return text("Á quân", "Runner-up")
    return text(`Hạng ${place}`, `Place ${place}`)
  }
  return {
    achievements: withPublishedPlaces(achievementGroups(profile.content!.achievements, links), places, word),
    played: places.map(({ view }) => view),
  }
}

function Profile({ profile }: { profile: CommunityProfile }) {
  const { text, languageTag } = useStreamLocale()
  const layout = usePageLayout()
  const compact = layout === "compact"
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
  const career = profile.kind === "PLAYER" && profile.entityId ? playerProfile(views, profile.entityId) : null
  const stint = career ? playerStints(career.seasons)[0] : undefined
  const { achievements, played } = useAchievements(profile, links, career)
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
  const titleCount = achievements.filter(isTitle).length
  const figure = (count: number | undefined, label: string, title?: boolean): HeadFigure[] =>
    count ? [{ value: count.toLocaleString(languageTag), label, title }] : []
  const figures = [
    ...figure(titleCount, text("lần vô địch", titleCount === 1 ? "title" : "titles"), true),
    ...figure(
      competitionCount,
      organization
        ? text("giải đấu", competitionCount === 1 ? "tournament" : "tournaments")
        : text("giải đã tham gia", competitionCount === 1 ? "tournament played" : "tournaments played"),
    ),
    ...(organization ? figure(teamCount, text("đội tuyển", teamCount === 1 ? "team" : "teams")) : []),
    ...figure(profile.followers, text("người theo dõi", profile.followers === 1 ? "follower" : "followers")),
  ]
  const missing = [
    profile.kind === "TEAM" &&
      !content.roster.length &&
      !(profile.entityId && competitionLineup(views, profile.entityId)) &&
      text("đội hình", "roster"),
    (profile.kind === "TEAM" || profile.kind === "PLAYER") &&
      !achievements.length &&
      text("thành tích", "achievements"),
    competitionCount === 0 &&
      (organization ? text("giải đấu đã tổ chức", "tournaments") : text("giải đấu đã tham gia", "tournaments played")),
    !content.biography && text("phần giới thiệu", "introduction"),
    !content.sources.length && text("nguồn đối chiếu", "sources"),
  ].filter((entry) => typeof entry === "string")
  const tabRow = tabs.length > 1 && (
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
  )
  return (
    <div className="cp-container pf-page">
      <StreamHead
        title={`${content.name} — AOV Stream`}
        description={
          pageSummary(plainReferences(content.biography ?? "")) ||
          text(
            `${content.name} (${kind}) trên AOV Stream: thông tin, thành tích và các giải Liên Quân Mobile.`,
            `${content.name} (${kind}) on AOV Stream: profile, achievements and Arena of Valor tournaments.`,
          )
        }
      />
      <ProfileHead
        profile={profile}
        mark={
          profile.kind === "PLAYER" && (
            <Jersey
              name={content.name}
              lane={career?.lane}
              logoUrl={stint?.team.logoUrl}
              logoDarkUrl={stint?.team.logoDarkUrl}
              size={compact ? 84 : 148}
            />
          )
        }
        lights={stint && [{ src: stint.team.logoUrl, darkSrc: stint.team.logoDarkUrl, at: "left" }]}
        kicker={
          <>
            {(!region || profile.kind === "PERSON") && kind}
            {region && (
              <>
                {profile.kind === "PERSON" && " · "}
                <RegionMark code={regionKey(content.country)} size={18} /> {region}
              </>
            )}
          </>
        }
        lines={
          individual ? (
            <ProfileTeams
              pageId={profile.id}
              fallback={
                stint && (
                  <ul className="pf-teams" aria-label={text("Đội tuyển", "Teams")}>
                    <li>
                      <Link to={`/teams/${stint.teamId}`}>
                        <StreamImage
                          src={stint.team.logoUrl}
                          darkSrc={stint.team.logoDarkUrl}
                          logo
                          name={stint.team.shortName || stint.team.name}
                        />
                        {stint.team.name}
                      </Link>
                    </li>
                  </ul>
                )
              }
            />
          ) : (
            profile.kind === "TEAM" &&
            content.organizationId && <TeamOrganization organizationId={content.organizationId} />
          )
        }
        figures={figures}
        channels={content.links.length > 0 && <ProfileSocials pageId={profile.id} links={content.links} />}
        tabs={!compact && tabRow}
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
      {compact && tabRow}
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
              played={played}
              history={history}
              links={links}
              crest={stint?.team ?? { logoUrl: content.avatarUrl }}
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
          {tab === "overview" && <ProfileAside profile={profile} missing={missing} />}
        </div>
        {!compact && <ProfileAside profile={profile} missing={missing} column />}
      </div>
    </div>
  )
}

/**
 * What a reader comes to the page for, in the order they ask it: a broadcast that is on, the matches around now,
 * the squad or the latest of a career, the titles and the best of the record, then the page's posts.
 */
function ProfileHome({
  profile,
  views,
  competitionsPending,
  competitionCount,
  achievements,
  played,
  history,
  links,
  crest,
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
  /** The published competitions its achievements were read from. */
  played: CompetitionView[]
  history: ProfileHistory[]
  links: CompetitionLinks
  /** The logo the titles are lit by: a team's own, or the one a player plays for. */
  crest: { logoUrl?: string | null; logoDarkUrl?: string | null }
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
  const titles = organization ? [] : achievements.filter(isTitle)
  const others = organization ? [] : achievements.filter((group) => !isTitle(group))
  return (
    <>
      {profile.live && <LiveBlock live={profile.live} name={content.name} />}
      <ProfileMatches profile={profile} views={views} pending={competitionsPending} more={() => open("competitions")} />
      {profile.kind === "TEAM" && <TeamSquad profile={profile} views={views} />}
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
      {titles.length + others.length > 0 && (
        <section className="pf-honours" aria-labelledby="profile-achievements">
          <div className="tn-heading" data-flush="">
            <h2 id="profile-achievements">{text("Thành tích", "Achievements")}</h2>
            {achievements.length > PREVIEW && (
              <button type="button" onClick={() => open("achievements")}>
                {text("Tất cả thành tích", "All achievements")}
                <StreamIcon name="arrow" size={15} />
              </button>
            )}
          </div>
          {titles.length > 0 && (
            <TitleShelf
              titles={titles}
              views={played}
              teams={profile.kind === "PLAYER"}
              name={content.name}
              {...crest}
            />
          )}
          {others.length > 0 && <AchievementRows groups={others.slice(0, PREVIEW)} />}
        </section>
      )}
      {feed && (
        <section className="pf-posts" aria-labelledby="profile-posts">
          <div className="tn-heading">
            <h2 id="profile-posts">{text("Bài viết", "Posts")}</h2>
            {hasVideos && (
              <div className="hub-pills" role="group" aria-label={text("Loại bài viết", "Post type")}>
                <button type="button" aria-pressed={!onlyVideo} onClick={() => setOnlyVideo(false)}>
                  {text("Tất cả", "All")}
                </button>
                <button type="button" aria-pressed={onlyVideo} onClick={() => setOnlyVideo(true)}>
                  <StreamIcon name="play" size={14} />
                  Video
                </button>
              </div>
            )}
          </div>
          <CommunityFeed
            key={onlyVideo ? "video" : "all"}
            pageId={profile.id}
            pageName={content.name}
            role={role}
            kind={onlyVideo ? "VIDEO" : undefined}
            composer={!onlyVideo}
          />
        </section>
      )}
    </>
  )
}

/**
 * A team's lineup on its rail and its other members under it, from the roster of the page. A page without one shows
 * the starters the team registered in its newest competition.
 */
function TeamSquad({ profile, views }: { profile: CommunityProfile; views: CompetitionView[] }) {
  const { roster, avatarUrl } = profile.content!
  const { season, groups } = rosterGroups(roster)
  const seats = rosterLineup(roster)
  if (seats)
    return (
      <TeamLineup seats={seats} logoUrl={avatarUrl} note={season}>
        <TeamRoster groups={groups.filter(({ standing }) => standing !== "ACTIVE")} roster={roster} />
      </TeamLineup>
    )
  if (roster.length) return <TeamRoster titled season={season} groups={groups} roster={roster} />
  const registered = profile.entityId ? competitionLineup(views, profile.entityId) : null
  if (!registered) return null
  const { id, content } = registered.view
  const team = content.teams[profile.entityId!]
  return (
    <TeamLineup
      seats={registered.seats}
      logoUrl={team?.logoUrl ?? avatarUrl}
      logoDarkUrl={team?.logoDarkUrl}
      note={<Link to={`/competitions/${id}?tab=teams`}>{content.tournament.name}</Link>}
    />
  )
}
