import { useState, type CSSProperties } from "react"
import { Link, Navigate, useLocation, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { HeroDetailLayout } from "../../layout/wiki-library-layout"
import { heroCatalogQuery, heroDetailQuery, type HeroListForm, type HeroListItem } from "./hero-api"
import { HeroFormSwitch } from "./hero-form-switch"
import { currentScope, formLabelRole, heroAtPatch, heroWithForm, resolveHeroRoute, selectedForm } from "./hero-forms"
import { heroAppearance } from "./hero-appearance"
import { WikiVersionPicker } from "../../components/wiki-version-picker"
import { useHeroChangedVariants } from "../../lib/wiki-patch-changes"
import { HeroHandbook, HeroStage } from "./hero-handbook"
import { HeroVideoButton } from "../videos/subject-videos"
import { HeroPriceTag } from "./hero-shop"
import { HERO_POSITIONS, HERO_ROLES, localizedHeroOptions } from "./hero-classifications"
import { HeroGlyph } from "./hero-glyph"
import { HeroQuickSwitch } from "./hero-quick-switch"
import { HeroDetailLoading } from "./hero-loading"
import { HeroLaterObservationNote } from "./hero-later-observation"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { WikiImageCredit as ImageCredit } from "../../components/wiki-image-credit"
import "./hero-detail.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { heroMeta, heroRoleLabels, notFoundMeta } from "../../lib/seo/page-meta"
import { PublicEmbers } from "@aov/ui/components/public-embers"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"

function heroMetaForm(form: HeroListForm, forms: readonly HeroListForm[], locale: string) {
  const role = formLabelRole(form, forms)
  return {
    key: form.formKey,
    label: (role && heroRoleLabels([role], locale)[0]) || form.name,
    isDefault: forms[0]?.id === form.id,
  }
}

function HeroArtwork({ hero, form, returnTo }: { hero: HeroListItem; form?: HeroListForm; returnTo: string }) {
  const scope = useWikiContext()
  const { locale, t } = scope
  // A past patch only changes the abilities; the rest of the page is today's hero (ADR-016).
  const past = !!(scope.seasonId || scope.patchVariantId)
  const current = useQuery(heroDetailQuery(hero.id, currentScope(scope)))
  const atPatch = useQuery({ ...heroDetailQuery(hero.id, scope), enabled: past })
  const query = past ? atPatch : current
  const detail = !past
    ? current.data
    : atPatch.data &&
      (current.data ? heroAtPatch(current.data, atPatch.data) : current.isError ? atPatch.data : undefined)
  // A hero with forms is read one form at a time: its gameplay, history and images, under the shared name (ADR-024).
  const formDetail = detail && selectedForm(detail, form?.formKey)
  const page = detail && heroWithForm(detail, formDetail)
  const media = { ...detail?.media, ...formDetail?.media }
  const gameplay = form ?? hero
  const formRole = form && hero.forms ? formLabelRole(form, hero.forms) : undefined
  const history = useHeroChangedVariants(gameplay.id)
  const layout = usePageLayout()
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const portrait = media.PORTRAIT?.currentVersion?.url
  const splash = media.SPLASH?.currentVersion?.url
  const artwork = [splash, portrait].find((url) => url && !failedUrls.includes(url))
  const kind = artwork && artwork === portrait ? "PORTRAIT" : "SPLASH"
  const head = media.HEAD?.currentVersion?.url || gameplay.head?.currentVersion?.url || hero.head?.currentVersion?.url
  const identityImage = [
    head,
    portrait,
    gameplay.portrait?.currentVersion?.url,
    hero.portrait?.currentVersion?.url,
  ].find((url) => url && !failedUrls.includes(url))
  const appearance = heroAppearance(hero.code)
  const style = {
    "--hero-surface-rgb": appearance.surfaceRgb,
    "--hero-backdrop": appearance.backdrop,
    "--hero-accent": appearance.accent,
  } as CSSProperties

  const identity = (
    <>
      {/* The header marks the section; a wide page adds one quiet way back, a compact one has it in its header. */}
      {layout !== "compact" && (
        <Link className="wiki-hero-profile-back" to={scope.href(returnTo)}>
          <WikiIcon name="chevronLeft" size={16} />
          {wikiText(locale, "Thư viện Tướng", "Hero library")}
        </Link>
      )}
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
      <HeroFormSwitch hero={hero} current={form} />
      {(page?.unscopedBaseline ?? gameplay.unscopedBaseline) && (
        <span className="wiki-hero-baseline">{wikiText(locale, "Dữ liệu nền · Chưa rõ mốc", "Undated baseline")}</span>
      )}
      {detail?.content.profile?.title && <p className="wiki-hero-epithet">{detail.content.profile.title}</p>}
      <div className="wiki-hero-role-strip">
        {localizedHeroOptions(HERO_ROLES, locale)
          .filter((role) => (page?.content.profile?.roles ?? gameplay.roles).includes(role.value))
          // The form switch above already shows the role that names the form being read.
          .filter((role) => role.value !== formRole)
          .map((role) => (
            <span key={role.value}>
              <HeroGlyph name={role.glyph} />
              {role.label}
            </span>
          ))}
        {localizedHeroOptions(HERO_POSITIONS, locale)
          .filter((position) => gameplay.positions?.includes(position.value))
          .map((position) => (
            <span key={position.value}>
              <HeroGlyph name={position.glyph} />
              {position.label}
            </span>
          ))}
        {/* The price and the videos wrap to the next line together, never one of them alone. */}
        <div className="wiki-hero-role-extras">
          <HeroPriceTag heroId={gameplay.id} fallbackHeroId={form ? hero.id : undefined} />
          <HeroVideoButton heroId={hero.id} />
        </div>
      </div>
    </>
  )
  const art = (
    <section className="wiki-hero-profile" data-artwork={kind} aria-labelledby="hero-profile-title">
      {artwork && media[kind]?.currentVersion && (
        <ImageCredit
          className="wiki-hero-art-credit"
          sources={media[kind].currentVersion?.sources}
          contactHref={`/contact?assetId=${media[kind].assetId}&versionId=${media[kind].currentVersion?.versionId}`}
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
          focus={media[kind]?.currentVersion?.focalPoint}
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

      <PublicEmbers className="wiki-artwork-embers" count={layout === "compact" ? 14 : 28} />
      {layout === "compact" && <div className="wiki-hero-profile-content">{identity}</div>}
    </section>
  )
  const later = page?.laterObservation
  const picker = (
    <>
      <WikiVersionPicker changedVariants={history.data} />
      {later && <HeroLaterObservationNote later={later} />}
    </>
  )

  return (
    <HeroDetailLayout
      meta={heroMeta(
        {
          ...hero,
          roles: gameplay.roles,
          title: page?.content.profile?.title,
          summary: page?.content.profile?.summary,
          media,
          form: form && hero.forms ? heroMetaForm(form, hero.forms, locale) : undefined,
        },
        locale,
      )}
      backTo={returnTo}
      style={style}
    >
      {page ? (
        <HeroHandbook
          hero={page}
          skinOwner={form ? hero.code : undefined}
          art={art}
          identity={identity}
          picker={picker}
        />
      ) : (
        <HeroStage art={art} identity={identity}>
          {query.isError ? (
            <div className="wiki-handbook-notice" role="status">
              {wikiText(locale, "Chưa tải được hồ sơ tướng.", "The hero profile could not be loaded.")}{" "}
              <button onClick={() => void query.refetch()}>{t("retry")}</button>
            </div>
          ) : (
            <p className="wiki-handbook-notice" role="status">
              {t("loading")}
            </p>
          )}
        </HeroStage>
      )}
    </HeroDetailLayout>
  )
}

export function HeroDetailPage() {
  const scope = useWikiContext()
  const { locale, t } = scope
  const { heroCode, formKey } = useParams()
  const location = useLocation()
  const catalog = useQuery(heroCatalogQuery(scope))
  const route = catalog.data ? resolveHeroRoute(catalog.data.items, heroCode, formKey) : undefined
  const previous = (location.state as { from?: unknown } | null)?.from
  const returnTo = typeof previous === "string" && /^\/hero(?:\?|$)/u.test(previous) ? previous : "/hero"

  if (route?.kind === "redirect")
    return <Navigate to={`${route.path}${location.search}${location.hash}`} state={location.state} replace />
  if (route?.kind === "hero")
    return <HeroArtwork key={route.hero.id} hero={route.hero} form={route.form} returnTo={returnTo} />
  if (catalog.isPending) return <HeroDetailLoading heroCode={heroCode} />

  return (
    <HeroDetailLayout meta={notFoundMeta(locale, location.pathname, "heroes")}>
      <div className="wiki-hero-profile-state wiki-mascot-state">
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
