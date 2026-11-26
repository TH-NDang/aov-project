import { Navigate, Route, Routes, useLocation, useSearchParams, type Location } from "react-router"
import { GamePage } from "./features/tournaments/pages/game-page"
import { CommunityHome } from "./features/community/pages/community-home"
import { CommunityExplore } from "./features/community/pages/community-explore"
import { CommunityProfilePage } from "./features/community/pages/community-profile"
import {
  CommunityAccount,
  CommunityPageManager,
  CommunityInvitation,
} from "./features/community/pages/community-account"
import { CommunityLoginCallback } from "./components/community-session"
import { StreamNotFound } from "./components/stream-not-found"
import { Travel } from "./components/travel"
import { VideoFrame } from "./components/video-frame"
import "./features/community/components/community.css"
import { PublicCompetitionPage } from "./features/tournaments/pages/competition-page"
import { CompetitionDirectory } from "./features/tournaments/pages/competition-directory-page"
import { MatchPage } from "./features/tournaments/pages/match-page"
import { TeamPage } from "./features/tournaments/pages/team-page"
import { PlayerPage } from "./features/tournaments/pages/player-page"
import { PersonPage } from "./features/tournaments/pages/person-page"
import { CreditsPage } from "./features/tournaments/pages/credits-page"
import "./features/tournaments/tournaments.css"
import "./features/tournaments/components/schedule.css"
export default function App() {
  return (
    <>
      <Travel>{(location) => <Pages location={location} />}</Travel>
      <VideoFrame />
    </>
  )
}

function Pages({ location }: { location: Location }) {
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
