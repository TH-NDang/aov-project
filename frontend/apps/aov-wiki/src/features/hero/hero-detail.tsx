import { useState, type CSSProperties } from "react"
import { Link, useLocation, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { HeroDetailLayout } from "../../layout/wiki-library-layout"
import { heroCatalogQuery, heroDetailQuery, type HeroListItem } from "./hero-api"
import { heroAppearance } from "./hero-appearance"
import { HeroQuickSwitch } from "./hero-quick-switch"
import { HeroDetailLoading } from "./hero-loading"
import { WikiImage } from "../../components/wiki-image"
import { ImageCredit } from "@aov/ui/components/image-credit"
import "./hero-detail.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"

function HeroArtwork({ hero, returnTo }: { hero: HeroListItem; returnTo: string }) {
  const scope = useWikiContext()
  const { locale, t } = scope
  const query = useQuery(heroDetailQuery(hero.id, scope))
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
        {artwork && query.data?.media[kind]?.currentVersion && (
          <ImageCredit
            className="right-4 bottom-4"
            sources={query.data.media[kind].currentVersion?.sources}
            contactHref={`/contact?assetId=${query.data.media[kind].assetId}&versionId=${query.data.media[kind].currentVersion?.versionId}`}
          />
        )}
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
            alt={wikiText(locale, `Ảnh tướng ${hero.name}`, `${hero.name} artwork`)}
            fetchPriority="high"
            loading="eager"
            onError={() => setFailedUrls((current) => [...current, artwork])}
          />
        ) : query.isPending ? (
          <>
            <div className="wiki-hero-profile-art wiki-hero-art-skeleton wiki-skeleton" aria-hidden="true" />
            <span className="sr-only" role="status">
              {wikiText(locale, "Đang tải ảnh tướng…", "Loading hero artwork…")}
            </span>
          </>
        ) : (
          <div className="wiki-hero-profile-placeholder">
            {query.isError && (
              <button type="button" onClick={() => void query.refetch()}>
                {wikiText(locale, "Tải lại ảnh", "Retry artwork")}
              </button>
            )}
            {query.isSuccess && !artwork && (
              <span>{wikiText(locale, "Chưa có ảnh lớn", "Artwork is not available yet")}</span>
            )}
          </div>
        )}

        <div className="wiki-hero-profile-content">
          <nav className="wiki-hero-profile-breadcrumb" aria-label={wikiText(locale, "Đường dẫn", "Breadcrumb")}>
            <Link to={scope.href("/")}>{t("home")}</Link>
            <span>/</span>
            <Link to={scope.href(returnTo)}>{wikiText(locale, "Thư viện Tướng", "Hero library")}</Link>
            <span>/</span>
            <span aria-current="page">{hero.name}</span>
          </nav>
          <Link className="wiki-hero-profile-back" to={scope.href(returnTo)}>
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
            {wikiText(locale, "Thư viện Tướng", "Hero library")}
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
          {(query.data?.unscopedBaseline ?? hero.unscopedBaseline) && (
            <span className="mt-2 inline-flex rounded-full bg-black/20 px-2 py-1 text-xs text-white/70">
              {wikiText(locale, "Dữ liệu nền · Chưa rõ mốc", "Undated baseline")}
            </span>
          )}
          <div className="wiki-hero-profile-ornament" aria-hidden="true">
            <span>◆</span>
          </div>
        </div>
      </section>
    </HeroDetailLayout>
  )
}

export function HeroDetailPage() {
  const scope = useWikiContext()
  const { locale, t } = scope
  const { heroCode } = useParams()
  const location = useLocation()
  const catalog = useQuery(heroCatalogQuery(scope))
  const hero = catalog.data?.items.find((item) => item.code === heroCode || item.id === heroCode)
  const previous = (location.state as { from?: unknown } | null)?.from
  const returnTo = typeof previous === "string" && /^\/hero(?:\?|$)/u.test(previous) ? previous : "/hero"

  if (hero) return <HeroArtwork key={hero.id} hero={hero} returnTo={returnTo} />
  if (catalog.isPending) return <HeroDetailLoading heroCode={heroCode} />

  return (
    <HeroDetailLayout title={t("heroes")}>
      <div className="wiki-hero-profile-state" style={{ "--hero-accent": "#d6bd8e" } as CSSProperties}>
        <h1>
          {catalog.isError
            ? wikiText(locale, "Chưa tải được tướng", "Could not load this hero")
            : wikiText(locale, "Không tìm thấy tướng", "Hero not found")}
        </h1>
        {catalog.isError && (
          <button type="button" onClick={() => void catalog.refetch()}>
            {t("retry")}
          </button>
        )}
        <Link to={scope.href(returnTo)}>{wikiText(locale, "Về thư viện Tướng", "Back to the hero library")}</Link>
      </div>
    </HeroDetailLayout>
  )
}
