import { lazy, Suspense, type ComponentType } from "react"
import { Navigate, Route, Routes, useLocation, useSearchParams, type Location } from "react-router"
import { CommunityHome } from "./features/community/pages/community-home"
import { CommunityLoginCallback } from "./components/community-session"
import { StreamShell } from "./components/stream-shell"
import { useStreamLocale } from "./components/stream-locale"
import { StreamNotFound } from "./components/stream-not-found"
import { Travel } from "./components/travel"
import { VideoFrame } from "./components/video-frame"
import "./features/community/components/community.css"
import "./features/tournaments/tournaments.css"
import "./features/tournaments/components/schedule.css"

/*
 * The feed is the page most readers open, so it ships with the app; every other page is loaded when it is first
 * opened, which keeps the first download to what the feed needs. The shared styles stay global for now.
 */
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((module) => ({ default: module[name] })))
const GamePage = named(() => import("./features/tournaments/pages/game-page"), "GamePage")
const CommunityExplore = named(() => import("./features/community/pages/community-explore"), "CommunityExplore")
const CommunityProfilePage = named(() => import("./features/community/pages/community-profile"), "CommunityProfilePage")
const CommunityAccount = named(() => import("./features/community/pages/community-account"), "CommunityAccount")
const CommunityPageManager = named(() => import("./features/community/pages/community-account"), "CommunityPageManager")
const CommunityInvitation = named(() => import("./features/community/pages/community-account"), "CommunityInvitation")
const PublicCompetitionPage = named(
  () => import("./features/tournaments/pages/competition-page"),
  "PublicCompetitionPage",
)
const CompetitionDirectory = named(
  () => import("./features/tournaments/pages/competition-directory-page"),
  "CompetitionDirectory",
)
const MatchPage = named(() => import("./features/tournaments/pages/match-page"), "MatchPage")
const TeamPage = named(() => import("./features/tournaments/pages/team-page"), "TeamPage")
const PlayerPage = named(() => import("./features/tournaments/pages/player-page"), "PlayerPage")
const PersonPage = named(() => import("./features/tournaments/pages/person-page"), "PersonPage")
const CreditsPage = named(() => import("./features/tournaments/pages/credits-page"), "CreditsPage")

export default function App() {
  return (
    <>
      <Travel>{(location) => <Pages location={location} />}</Travel>
      <VideoFrame />
    </>
  )
}

/** What a page shows while its code is loaded for the first time. */
function PageLoading() {
  const { text } = useStreamLocale()
  return (
    <StreamShell>
      <div className="cp-container pt-page">
        <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải trang", "Loading the page")} />
      </div>
    </StreamShell>
  )
}

function Pages({ location }: { location: Location }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <PageRoutes location={location} />
    </Suspense>
  )
}

function PageRoutes({ location }: { location: Location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<CommunityHome />} />
      <Route path="/competitions" element={<CompetitionDirectory />} />
      <Route path="/competitions/:id" element={<PublicCompetitionPage />} />
      <Route path="/competitions/:id/matches/:matchKey" element={<MatchPage />} />
      <Route path="/matches/:seriesId" element={<MatchPage />} />
      <Route path="/teams/:id" element={<TeamPage />} />
      <Route path="/players/:id" element={<PlayerPage />} />
      <Route path="/people/:id" element={<PersonPage />} />
      <Route path="/credits" element={<CreditsPage />} />
      <Route path="/games" element={<GamesRedirect />} />
      <Route path="/games/:id" element={<GamePage />} />
      <Route path="/explore" element={<CommunityExplore />} />
      <Route path="/pages" element={<ExploreRedirect />} />
      <Route path="/pages/:code" element={<CommunityProfilePage />} />
      <Route path="/account" element={<CommunityAccount />} />
      <Route path="/manage/:id" element={<CommunityPageManager />} />
      <Route path="/invitations" element={<CommunityInvitation />} />
      <Route path="/auth/callback" element={<CommunityLoginCallback />} />
      <Route path="*" element={<StreamNotFound />} />
    </Routes>
  )
}

/** Games are read in their match, and counted on the statistics of their competition. */
function GamesRedirect() {
  const [params] = useSearchParams()
  const series = params.get("series")
  const competition = params.get("tournament")
  const to = series
    ? `/matches/${encodeURIComponent(series)}`
    : competition
      ? `/competitions/${encodeURIComponent(competition)}?tab=stats`
      : "/competitions"
  return <Navigate to={to} replace />
}

/** The page directory now lives on the explore page. */
function ExploreRedirect() {
  const { search, hash, state } = useLocation()
  return <Navigate to={{ pathname: "/explore", search, hash }} state={state} replace />
}
