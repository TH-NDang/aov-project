import { type CSSProperties } from "react"
import { Link } from "react-router"
import { HeroDetailLayout, WikiLibraryLayout } from "../../layout/wiki-library-layout"
import { HERO_POSITIONS, HERO_ROLES } from "./hero-classifications"
import { heroAppearance } from "./hero-appearance"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiVersionPicker } from "../../components/wiki-version-picker"
import "./hero-directory.css"
import "./hero-detail.css"
import "./hero-loading.css"

export function HeroGridSkeleton() {
  const { locale } = useWikiContext()
  return (
    <div
      className="wiki-hero-grid"
      aria-busy="true"
      role="status"
      aria-label={wikiText(locale, "Đang tải tướng", "Loading heroes")}
    >
      <span className="sr-only">{wikiText(locale, "Đang tải danh sách tướng…", "Loading the hero list…")}</span>
      {Array.from({ length: 12 }, (_, index) => (
        <div className="wiki-hero-card wiki-hero-card-skeleton" aria-hidden="true" key={index}>
          <div className="wiki-hero-card-portrait wiki-skeleton" />
          <div className="wiki-hero-card-body">
            <span className="wiki-hero-skeleton-name wiki-skeleton" />
            <span className="wiki-hero-skeleton-role wiki-skeleton" />
            <span className="wiki-hero-card-divider">
              <i />◇<i />
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function DirectoryLoading() {
  const { locale, href, t } = useWikiContext()
  return (
    <WikiLibraryLayout>
      <div className="wiki-hero-directory">
        <nav className="wiki-hero-breadcrumb" aria-label={wikiText(locale, "Đường dẫn", "Breadcrumb")}>
          <Link to={href("/")}>{t("home")}</Link>
          <span>/</span>
          <span>{wikiText(locale, "Thư viện Tướng", "Hero library")}</span>
        </nav>
        <h1 className="wiki-hero-directory-title">{wikiText(locale, "Thư viện Tướng", "Hero library")}</h1>
        <WikiVersionPicker />
        <div className="wiki-hero-filters" aria-hidden="true">
          {[
            { label: wikiText(locale, "Vị trí", "Lane"), count: HERO_POSITIONS.length },
            { label: wikiText(locale, "Vai trò", "Role"), count: HERO_ROLES.length },
          ].map(({ label, count }) => (
            <div className="wiki-hero-filter-row" key={label}>
              <div className="wiki-hero-filter-label">{label}</div>
              <div className="wiki-hero-filter-choices">
                {Array.from({ length: count }, (_, index) => (
                  <span className="wiki-hero-filter-chip wiki-skeleton" key={index} />
                ))}
              </div>
            </div>
          ))}
          <div className="wiki-hero-filter-tools">
            <span className="wiki-hero-search wiki-skeleton" />
          </div>
        </div>
        <HeroGridSkeleton />
      </div>
    </WikiLibraryLayout>
  )
}

export function HeroDetailLoading({ heroCode }: { heroCode?: string }) {
  const { locale, t } = useWikiContext()
  const appearance = heroAppearance(heroCode || "")
  const style = {
    "--hero-surface-rgb": appearance.surfaceRgb,
    "--hero-backdrop": appearance.backdrop,
    "--hero-accent": appearance.accent,
  } as CSSProperties

  return (
    <HeroDetailLayout title={t("heroes")} style={style}>
      <section className="wiki-hero-profile" data-artwork="SPLASH" aria-busy="true" role="status">
        <span className="sr-only">{wikiText(locale, "Đang tải tướng…", "Loading hero…")}</span>
        <div className="wiki-hero-profile-art wiki-hero-art-skeleton wiki-skeleton" aria-hidden="true" />
        <div className="wiki-hero-profile-content" aria-hidden="true">
          <div className="wiki-hero-profile-breadcrumb">
            {t("home")} / {wikiText(locale, "Thư viện Tướng", "Hero library")}
          </div>
          <div className="wiki-hero-profile-back">‹ {wikiText(locale, "Thư viện Tướng", "Hero library")}</div>
          <div className="wiki-hero-profile-identity">
            <span className="wiki-hero-profile-head wiki-skeleton" />
            <span className="wiki-hero-profile-heading">
              <span className="wiki-hero-title-skeleton wiki-skeleton" />
            </span>
          </div>
          <div className="wiki-hero-profile-ornament">
            <span>◆</span>
          </div>
        </div>
      </section>
    </HeroDetailLayout>
  )
}

export function HeroRouteLoading({ pathname }: { pathname: string }) {
  const heroCode = pathname.split("/").filter(Boolean)[1]
  return heroCode ? <HeroDetailLoading heroCode={heroCode} /> : <DirectoryLoading />
}
