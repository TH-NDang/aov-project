import { Navigate, Route, Routes, useLocation } from "react-router"
import { GamesPage } from "./features/tournaments/pages/games-page"
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
    <Routes>
      <Route path="/" element={<CommunityHome />} />
      <Route path="/competitions" element={<CompetitionDirectory />} />
      <Route path="/competitions/:id" element={<PublicCompetitionPage />} />
      <Route path="/competitions/:id/matches/:matchKey" element={<MatchPage />} />
      <Route path="/matches/:seriesId" element={<MatchPage />} />
      <Route path="/teams/:id" element={<TeamPage />} />
      <Route path="/players/:id" element={<PlayerPage />} />
      <Route path="/people/:id" element={<PersonPage />} />
      <Route path="/credits" element={<CreditsPage />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/games/:id" element={<GamePage />} />
      <Route path="/explore" element={<CommunityExplore />} />
      <Route path="/pages" element={<ExploreRedirect />} />
      <Route path="/pages/:code" element={<CommunityProfilePage />} />
      <Route path="/account" element={<CommunityAccount />} />
      <Route path="/manage/:id" element={<CommunityPageManager />} />
      <Route path="/invitations" element={<CommunityInvitation />} />
      <Route path="/auth/callback" element={<CommunityLoginCallback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** The page directory now lives on the explore page. */
function ExploreRedirect() {
  const { search, hash, state } = useLocation()
  return <Navigate to={{ pathname: "/explore", search, hash }} state={state} replace />
}
