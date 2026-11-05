import { WikiIcon } from "./components/wiki-icon"
import { FeedbackDialog } from "./layout/feedback-dialog"
import { WikiHeader } from "./components/wiki-header"
import { WikiHome } from "./features/home/wiki-home"
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router"
import { lazy, Suspense, useEffect } from "react"
import { HeroDirectoryLoading, HeroDetailLoading } from "./features/hero/hero-loading"
import { WikiLibraryLayout } from "./layout/wiki-library-layout"
import { SkinDirectoryLoading } from "./features/skins/skin-loading"
import { WarehouseRouteLoading } from "./features/warehouse/warehouse-loading"
import { useWikiContext, wikiText } from "./context/wiki-context"
import { ContactPage } from "./features/contact/contact-page"
import { WikiLoginCallback } from "./features/auth/wiki-account"

const TermsPage = lazy(() => import("./features/terms/terms-page").then((module) => ({ default: module.TermsPage })))
const UpdatesPage = lazy(() =>
  import("./features/updates/updates-page").then((module) => ({ default: module.UpdatesPage })),
)
const PatchDetailPage = lazy(() =>
  import("./features/updates/patch-detail-page").then((module) => ({ default: module.PatchDetailPage })),
)
const HeroDirectory = lazy(() =>
  import("./features/hero/hero-directory").then((module) => ({ default: module.HeroDirectory })),
)
const HeroDetailPage = lazy(() =>
  import("./features/hero/hero-detail").then((module) => ({ default: module.HeroDetailPage })),
)
const SkinDirectory = lazy(() =>
  import("./features/skins/skin-directory").then((module) => ({ default: module.SkinDirectory })),
)
const WarehousePage = lazy(() => import("./features/warehouse/warehouse-page"))

function HeroDetailRoute() {
  const { heroCode } = useParams()
  return (
    <Suspense fallback={<HeroDetailLoading heroCode={heroCode} />}>
      <HeroDetailPage />
    </Suspense>
  )
}

/** Term links used to point at the home page; they now open the glossary. */
function HomePage() {
  const { locale, href } = useWikiContext()
  const [params] = useSearchParams()
  const term = params.get("term")
  if (term) return <Navigate to={href(`/terms/${encodeURIComponent(term)}`)} replace />
  return (
    <>
      <title>{wikiText(locale, "AOV WiKi — Khai mở tri thức", "AOV WiKi — Knowledge uncovered")}</title>
      <WikiHeader />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 outline-none"
        aria-label={wikiText(locale, "Nội dung wiki", "Wiki content")}
      >
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
        <Route path="/auth/callback" element={<WikiLoginCallback />} />
        <Route element={<WikiLibraryLayout />}>
          <Route
            path="/hero"
            element={
              <Suspense fallback={<HeroDirectoryLoading />}>
                <HeroDirectory />
              </Suspense>
            }
          />
          <Route
            path="/skins"
            element={
              <Suspense fallback={<SkinDirectoryLoading />}>
                <SkinDirectory />
              </Suspense>
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
          {["/terms", "/terms/:termId"].map((path) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense fallback={null}>
                  <TermsPage />
                </Suspense>
              }
            />
          ))}
          <Route
            path="/updates"
            element={
              <Suspense fallback={null}>
                <UpdatesPage />
              </Suspense>
            }
          />
          <Route
            path="/updates/:patchCode"
            element={
              <Suspense fallback={null}>
                <PatchDetailPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="/hero/:heroCode" element={<HeroDetailRoute />} />
        <Route path="/hero/*" element={<HeroDetailRoute />} />
        <Route
          path="*"
          element={
            <>
              <WikiHeader />
              <main
                id="main"
                className="wiki-mascot-state mx-auto grid flex-1 content-center justify-items-center gap-4 p-8 text-center"
              >
                <h1 className="text-xl text-gold">{wikiText(locale, "Không tìm thấy trang", "Page not found")}</h1>
                <Link to={href("/")}>{t("backHome")}</Link>
              </main>
            </>
          }
        />
      </Routes>
      <footer className="wiki-site-footer">
        <div>
          <Link to={href("/")} className="wiki-footer-brand">
            <img src="/images/mole-logo-v4.png" width="24" height="24" alt="" /> AOV Wiki
          </Link>
          <FeedbackDialog showLabel />
          <Link to={href("/contact")}>
            {wikiText(locale, "Liên hệ · Nguồn & hình ảnh", "Contact · Sources & images")}{" "}
            <WikiIcon name="arrow" size={14} />
          </Link>
        </div>
      </footer>
    </>
  )
}
