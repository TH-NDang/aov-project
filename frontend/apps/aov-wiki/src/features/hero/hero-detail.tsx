import { useState, type CSSProperties } from "react"
import { Link, useLocation, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { HeroDetailLayout } from "../../layout/wiki-library-layout"
import { heroCatalogQuery, heroDetailQuery, type HeroListItem } from "./hero-api"
import { heroAppearance } from "./hero-appearance"
import { HeroQuickSwitch } from "./hero-quick-switch"
import { HeroDetailLoading } from "./hero-loading"
import { WikiImage } from "../../components/wiki-image"
import "./hero-detail.css"

function HeroArtwork({ hero, returnTo }: { hero: HeroListItem; returnTo: string }) {
  const query = useQuery(heroDetailQuery(hero.id))
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const portrait = query.data?.media.PORTRAIT?.currentVersion?.url
  const splash = query.data?.media.SPLASH?.currentVersion?.url
  const artwork = [splash, portrait].find((url) => url && !failedUrls.includes(url))
  const kind = artwork && artwork === portrait ? "PORTRAIT" : "SPLASH"
  const head = query.data?.media.HEAD?.currentVersion?.url || hero.head?.currentVersion?.url
  const identityImage = [head, portrait, hero.portrait?.currentVersion?.url].find(
    (url) => url && !failedUrls.includes(url),
  )
  const appearance = heroAppearance(hero.code)
  const style = {
    "--hero-surface-rgb": appearance.surfaceRgb,
    "--hero-backdrop": appearance.backdrop,
    "--hero-accent": appearance.accent,
  } as CSSProperties

  return (
    <HeroDetailLayout title={hero.name} style={style}>
      <section className="wiki-hero-profile" data-artwork={kind} aria-labelledby="hero-profile-title">
        {splash && (
          <div
            className="wiki-hero-profile-atmosphere"
            style={{ backgroundImage: `url(${JSON.stringify(splash)})` }}
            aria-hidden="true"
          />
        )}
        {artwork ? (
          <WikiImage
            key={artwork}
            className="wiki-hero-profile-art"
            src={artwork}
            alt={`Ảnh tướng ${hero.name}`}
            fetchPriority="high"
            loading="eager"
            onError={() => setFailedUrls((current) => [...current, artwork])}
          />
        ) : query.isPending ? (
          <>
            <div className="wiki-hero-profile-art wiki-hero-art-skeleton wiki-skeleton" aria-hidden="true" />
            <span className="sr-only" role="status">
              Đang tải ảnh tướng…
            </span>
          </>
        ) : (
          <div className="wiki-hero-profile-placeholder">
            {query.isError && (
              <button type="button" onClick={() => void query.refetch()}>
                Tải lại ảnh
              </button>
            )}
            {query.isSuccess && !artwork && <span>Chưa có ảnh lớn</span>}
          </div>
        )}

        <div className="wiki-hero-profile-content">
          <nav className="wiki-hero-profile-breadcrumb" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <span>/</span>
            <Link to={returnTo}>Thư viện Tướng</Link>
            <span>/</span>
            <span aria-current="page">{hero.name}</span>
          </nav>
          <Link className="wiki-hero-profile-back" to={returnTo}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m14 5-7 7 7 7" />
            </svg>
            Thư viện Tướng
          </Link>
          <div className="wiki-hero-profile-identity">
            <span className="wiki-hero-profile-head" aria-hidden="true">
              {identityImage ? (
                <WikiImage
                  src={identityImage}
                  alt=""
                  width="52"
                  height="52"
                  loading="eager"
                  decoding="async"
                  onError={() => setFailedUrls((current) => [...current, identityImage])}
                />
              ) : (
                <span>{hero.name.charAt(0)}</span>
              )}
            </span>
            <div className="wiki-hero-profile-heading">
              <h1 id="hero-profile-title">{hero.name}</h1>
              <HeroQuickSwitch currentHeroId={hero.id} returnTo={returnTo} />
            </div>
          </div>
          <div className="wiki-hero-profile-ornament" aria-hidden="true">
            <span>◆</span>
          </div>
        </div>
      </section>
    </HeroDetailLayout>
  )
}

export function HeroDetailPage() {
  const { heroCode } = useParams()
  const location = useLocation()
  const catalog = useQuery(heroCatalogQuery)
  const hero = catalog.data?.items.find((item) => item.code === heroCode || item.id === heroCode)
  const previous = (location.state as { from?: unknown } | null)?.from
  const returnTo = typeof previous === "string" && /^\/hero(?:\?|$)/u.test(previous) ? previous : "/hero"

  if (hero) return <HeroArtwork key={hero.id} hero={hero} returnTo={returnTo} />
  if (catalog.isPending) return <HeroDetailLoading heroCode={heroCode} />

  return (
    <HeroDetailLayout title="Tướng">
      <div className="wiki-hero-profile-state" style={{ "--hero-accent": "#d6bd8e" } as CSSProperties}>
        <h1>{catalog.isError ? "Chưa tải được tướng" : "Không tìm thấy tướng"}</h1>
        {catalog.isError && (
          <button type="button" onClick={() => void catalog.refetch()}>
            Thử lại
          </button>
        )}
        <Link to={returnTo}>Về thư viện Tướng</Link>
      </div>
    </HeroDetailLayout>
  )
}
