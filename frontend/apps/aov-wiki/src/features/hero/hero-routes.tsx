import { Route, Routes } from "react-router"
import { WikiLibraryLayout } from "../../layout/wiki-library-layout"
import { HeroDetailPage } from "./hero-detail"
import { HeroDirectory } from "./hero-directory"

export default function HeroRoutes() {
  return (
    <Routes>
      <Route element={<WikiLibraryLayout />}>
        <Route index element={<HeroDirectory />} />
      </Route>
      <Route path=":heroCode" element={<HeroDetailPage />} />
      <Route path="*" element={<HeroDetailPage />} />
    </Routes>
  )
}
