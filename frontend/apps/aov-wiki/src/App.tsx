import { PageBackdrop } from "./components/page-backdrop"
import { WikiHeader } from "./components/wiki-header"
import { WikiHome } from "./features/home/wiki-home"
import { Link, Route, Routes, useLocation } from "react-router"
import { lazy, Suspense, useEffect } from "react"
import { HeroRouteLoading } from "./features/hero/hero-loading"
import { WikiLibraryLayout } from "./layout/wiki-library-layout"
import { SkinDirectoryLoading } from "./features/skins/skin-loading"
import { WarehouseRouteLoading } from "./features/warehouse/warehouse-loading"
import { useWikiContext, wikiText } from "./context/wiki-context"
import { ContactPage } from "./features/contact/contact-page"

const HeroRoutes = lazy(() => import("./features/hero/hero-routes"))
const SkinDirectory = lazy(() =>
  import("./features/skins/skin-directory").then((module) => ({ default: module.SkinDirectory })),
)
const WarehousePage = lazy(() => import("./features/warehouse/warehouse-page"))

const HOME_BACKGROUND = {
  image: "/images/airi-thu-nguyen-ve-than-1-cover.jpg",
  color: "#27283f",
}

function HomePage() {
  const { locale } = useWikiContext()
  return (
    <>
      <title>{wikiText(locale, "AOV WiKi — Khai mở tri thức", "AOV WiKi — Knowledge uncovered")}</title>
      <PageBackdrop {...HOME_BACKGROUND} />
      <WikiHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none" aria-label="Nội dung wiki">
        <WikiHome />
      </main>
    </>
  )
}

export default function App() {
  const { t, href, locale } = useWikiContext()
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
        {wikiText(locale, "Đến nội dung chính", "Skip to content")}
      </a>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/contact" element={<ContactPage />} />
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
            <WikiLibraryLayout title={t("skins")} searchScope="skins">
              <Suspense fallback={<SkinDirectoryLoading />}>
                <SkinDirectory />
              </Suspense>
            </WikiLibraryLayout>
          }
        />
        <Route
          path="/warehouse"
          element={
            <Suspense fallback={<WarehouseRouteLoading />}>
              <WarehousePage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <>
              <WikiHeader />
              <main id="main" className="mx-auto grid flex-1 content-center gap-4 p-8 text-center">
                <h1 className="text-xl text-gold">{wikiText(locale, "Không tìm thấy trang", "Page not found")}</h1>
                <Link to={href("/")}>{t("backHome")}</Link>
              </main>
            </>
          }
        />
      </Routes>
      <footer className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/55">
        <Link to="/contact" className="underline underline-offset-4">
          Liên hệ · Nguồn & hình ảnh
        </Link>
      </footer>
    </>
  )
}
