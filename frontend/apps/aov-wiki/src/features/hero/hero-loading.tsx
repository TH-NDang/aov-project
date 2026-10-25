import { type CSSProperties } from "react"
import { Link } from "react-router"
import { HeroDetailLayout, WikiLibraryLayout } from "../../layout/wiki-library-layout"
import { HERO_POSITIONS, HERO_ROLES } from "./hero-classifications"
import { heroAppearance } from "./hero-appearance"
import "./hero-directory.css"
import "./hero-detail.css"
import "./hero-loading.css"

export function HeroGridSkeleton() {
  return (
    <div className="wiki-hero-grid" aria-busy="true" role="status" aria-label="Đang tải tướng">
      <span className="sr-only">Đang tải danh sách tướng…</span>
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
  return (
    <WikiLibraryLayout>
      <div className="wiki-hero-directory">
        <nav className="wiki-hero-breadcrumb" aria-label="Đường dẫn">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          <span>Thư viện Tướng</span>
        </nav>
        <h1 className="wiki-hero-directory-title">Thư viện Tướng</h1>
        <div className="wiki-hero-filters" aria-hidden="true">
          {[
            { label: "Vị trí", count: HERO_POSITIONS.length },
            { label: "Vai trò", count: HERO_ROLES.length },
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
  const appearance = heroAppearance(heroCode || "")
  const style = {
    "--hero-surface-rgb": appearance.surfaceRgb,
    "--hero-backdrop": appearance.backdrop,
    "--hero-accent": appearance.accent,
  } as CSSProperties

  return (
    <HeroDetailLayout title="Tướng" style={style}>
      <section className="wiki-hero-profile" data-artwork="SPLASH" aria-busy="true" role="status">
        <span className="sr-only">Đang tải tướng…</span>
        <div className="wiki-hero-profile-art wiki-hero-art-skeleton wiki-skeleton" aria-hidden="true" />
        <div className="wiki-hero-profile-content" aria-hidden="true">
          <div className="wiki-hero-profile-breadcrumb">Trang chủ / Thư viện Tướng</div>
          <div className="wiki-hero-profile-back">‹ Thư viện Tướng</div>
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
