import { Route, Routes } from "react-router"
import { TournamentDirectory } from "./features/tournaments/tournament-directory"
import { GamePage } from "./features/tournaments/game-page"
import { CommunityHome } from "./features/community/community-home"
import { CommunityProfilePage } from "./features/community/community-profile"
import { CommunityAccount, CommunityPageManager, CommunityInvitation } from "./features/community/community-account"
import { CommunityLoginCallback } from "./features/community/community-session"
import "./features/community/community.css"
import { CompetitionDirectory, PublicCompetitionPage } from "./features/community/public-competitions"
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CompetitionDirectory />} />
      <Route path="/competitions/:id" element={<PublicCompetitionPage />} />
      <Route path="/games" element={<TournamentDirectory />} />
      <Route path="/games/:id" element={<GamePage />} />
      <Route path="/pages" element={<CommunityHome />} />
      <Route path="/pages/:code" element={<CommunityProfilePage />} />
      <Route path="/account" element={<CommunityAccount />} />
      <Route path="/manage/:id" element={<CommunityPageManager />} />
      <Route path="/invitations" element={<CommunityInvitation />} />
      <Route path="/auth/callback" element={<CommunityLoginCallback />} />
      <Route path="*" element={<TournamentDirectory />} />
    </Routes>
  )
}
