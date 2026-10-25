import { PageBackdrop } from "./components/page-backdrop"
import { WikiHeader } from "./components/wiki-header"
import { WikiHome } from "./features/home/wiki-home"
import { Link, Route, Routes, useLocation } from "react-router"
import { lazy, Suspense, useEffect } from "react"
import { HeroRouteLoading } from "./features/hero/hero-loading"
import { WikiLibraryLayout } from "./layout/wiki-library-layout"
import { SkinDirectoryLoading } from "./features/skins/skin-loading"

const HeroRoutes = lazy(() => import("./features/hero/hero-routes"))
const SkinDirectory = lazy(() =>
  import("./features/skins/skin-directory").then((module) => ({ default: module.SkinDirectory })),
)

const HOME_BACKGROUND = {
  image: "/images/airi-thu-nguyen-ve-than-1-cover.jpg",
  color: "#27283f",
}

function HomePage() {
  return (
    <>
      <title>AOV WiKi — Khai mở tri thức</title>
      <PageBackdrop {...HOME_BACKGROUND} />
      <WikiHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none" aria-label="Nội dung wiki">
        <WikiHome />
      </main>
    </>
  )
}

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <a
        className="fixed -top-25 left-4 z-100 rounded-[4px] bg-primary px-4 py-2.5 text-primary-foreground focus:top-2.5"
        href="#main"
      >
        Đến nội dung chính
      </a>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/hero/*"
          element={
            <Suspense fallback={<HeroRouteLoading pathname={pathname} />}>
              <HeroRoutes />
            </Suspense>
          }
        />
        <Route
          path="/skins"
          element={
            <WikiLibraryLayout title="Trang phục" searchScope="skins">
              <Suspense fallback={<SkinDirectoryLoading />}>
                <SkinDirectory />
              </Suspense>
            </WikiLibraryLayout>
          }
        />
        <Route
          path="*"
          element={
            <>
              <WikiHeader />
              <main id="main" className="mx-auto grid flex-1 content-center gap-4 p-8 text-center">
                <h1 className="text-xl text-gold">Không tìm thấy trang</h1>
                <Link to="/">Về trang chủ</Link>
              </main>
            </>
          }
        />
      </Routes>
    </>
  )
}
