import { Route, Routes } from "react-router"
import { TournamentDirectory } from "./features/tournaments/tournament-directory"
import { GamePage } from "./features/tournaments/game-page"
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TournamentDirectory />} />
      <Route path="/games/:id" element={<GamePage />} />
      <Route path="*" element={<TournamentDirectory />} />
    </Routes>
  )
}
