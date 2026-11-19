import { Navigate, Route, Routes, useLocation } from "react-router"
import { TournamentDirectory } from "./features/tournaments/tournament-directory"
import { GamePage } from "./features/tournaments/game-page"
import { CommunityHome } from "./features/community/pages/community-home"
import { CommunityExplore } from "./features/community/pages/community-explore"
import { CommunityProfilePage } from "./features/community/pages/community-profile"
import { CommunityAccount } from "./features/community/pages/community-account-page"
import { CommunityPageManager } from "./features/community/pages/community-manage-page"
import { CommunityInvitation } from "./features/community/pages/community-invitation-page"
import { CommunityLoginCallback } from "./components/community-session"
import "./features/community/components/community.css"
import { PublicCompetitionPage } from "./features/tournaments/competition-page"
import { CompetitionDirectory } from "./features/tournaments/competition-hub"
import { MatchPage } from "./features/tournaments/match-page"
import "./features/tournaments/competition.css"
import "./features/tournaments/tournaments.css"
import "./features/tournaments/competition-pages.css"
import "./features/tournaments/games.css"
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CommunityHome />} />
      <Route path="/competitions" element={<CompetitionDirectory />} />
      <Route path="/competitions/:id" element={<PublicCompetitionPage />} />
      <Route path="/competitions/:id/matches/:matchKey" element={<MatchPage />} />
      <Route path="/matches/:seriesId" element={<MatchPage />} />
      <Route path="/games" element={<TournamentDirectory />} />
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
