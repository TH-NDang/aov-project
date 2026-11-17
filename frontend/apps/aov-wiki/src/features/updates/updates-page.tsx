import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { changeKindIcon, changeKindIcons } from "@aov/ui/components/change-kind-icons"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { patchChangeLabel } from "../../components/patch-changes-row"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText, type WikiPatch } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { changeSetKind } from "../../lib/wiki-change-format"
import { heroCatalogQuery } from "../../lib/hero-api"
import { patchChangesQuery, patchReleasesQuery, type PatchChangeRow, type PatchRelease } from "../../lib/updates-api"
import { ReleaseDate } from "./release-date"
import "./updates.css"

/** The order readers look for: who is new, who was remade, who got stronger, who got weaker, then the rest. */
const KIND_ORDER = ["RELEASE", "ADDED", "REWORK", "BUFF", "NERF", "ADJUSTMENT", "BALANCE", "FIX", "UPDATED", "REMOVED"]

/** How many portraits a row shows before it counts the rest: what fits beside the text, or across a small phone. */
const FACES = { wide: 8, compact: 6 }

/** How many patches come into view at a time; each one reads its own summary. */
const BATCH = 12

interface HeroFace {
  name: string
  image?: string
}

/** A hero that is a form of another hero names its holder, whose picture stands in when the form has none listed. */
type HeroRow = PatchChangeRow & { holderId?: string }

function PatchRow({
  release,
  variant,
  faces,
}: {
  release: PatchRelease
  variant?: WikiPatch
  faces: ReadonlyMap<string, HeroFace>
}) {
  const scope = useWikiContext()
  const { locale, href } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const faceCount = FACES[usePageLayout()]
  // The same notes the patch page reads, so opening the patch afterwards needs no second request.
  const changes = useQuery(patchChangesQuery(scope, release, "HERO"))
  const rows: HeroRow[] = changes.data ?? []
  const kinds = new Map<string, number>()
  for (const row of rows) {
    const kind = changeSetKind(row) ?? "UPDATED"
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
  }
  const ordered = [...kinds].sort(
    ([a], [b]) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  )
  const heroes = rows.map((row) => faces.get(row.heroId ?? "") ?? faces.get(row.holderId ?? ""))
  const pictured = heroes.filter((hero): hero is HeroFace & { image: string } => !!hero?.image)
  const names = heroes.flatMap((hero) => (hero ? [hero.name] : []))

  return (
    <li>
      <Link
        to={href(`/updates/${release.code}`)}
        className="wiki-updates-row"
        data-current={variant?.isCurrent || undefined}
      >
        <ReleaseDate
          className="wiki-updates-date"
          regionalDate={variant?.regionalDate}
          effectiveAt={release.effectiveAt}
          fallback={<time className="wiki-updates-date">{release.code}</time>}
        />
        <span className="wiki-updates-copy">
          <span className="wiki-updates-title">
            <strong>{release.title || release.code}</strong>
            {variant?.isCurrent && <span className="wiki-updates-current">{text("Đang áp dụng", "Current")}</span>}
          </span>
          <span className="wiki-updates-summary" aria-busy={changes.isPending || undefined}>
            {changes.isError ? (
              text("Chưa tải được tóm tắt thay đổi.", "The summary of changes could not be loaded.")
            ) : changes.isSuccess && !rows.length ? (
              text("Chưa ghi nhận thay đổi về tướng.", "No hero changes are recorded.")
            ) : rows.length ? (
              <>
                <b>{text(`${rows.length} tướng`, rows.length === 1 ? "1 hero" : `${rows.length} heroes`)}</b>
                {ordered.map(([kind, count]) => {
                  const Art = changeKindIcon(kind) ?? changeKindIcons.UPDATED
                  return (
                    <span className="wiki-updates-kind" data-kind={kind} key={kind}>
                      <Art size={16} />
                      <span>{patchChangeLabel(kind, locale)}</span>
                      <b>{count}</b>
                    </span>
                  )
                })}
              </>
            ) : null}
          </span>
        </span>
        <span className="wiki-updates-faces">
          {pictured.slice(0, faceCount).map((hero, index) => (
            <span className="wiki-updates-face" key={index}>
              <WikiImage src={hero.image} alt="" />
            </span>
          ))}
          {rows.length > faceCount && pictured.length >= faceCount && (
            <span className="wiki-updates-more" aria-hidden="true">
              +{rows.length - faceCount}
            </span>
          )}
          {names.length > 0 && <span className="sr-only">{names.join(", ")}</span>}
        </span>
        <WikiIcon name="chevronRight" size={20} />
      </Link>
    </li>
  )
}

export function UpdatesPage() {
  const scope = useWikiContext()
  const { locale, t } = scope
  const releases = useQuery(patchReleasesQuery(scope))
  // Names and portraits come from the hero list the home page and the hero library already keep.
  const catalog = useQuery(heroCatalogQuery(scope))
  const seasons = scope.options?.seasons ?? []
  const variants = new Map(scope.options?.patches.map((patch) => [patch.id, patch]))
  const seasonOrder = (id: string | undefined) => seasons.find((season) => season.id === id)?.ordinal ?? -1

  const faces = new Map<string, HeroFace>()
  for (const hero of catalog.data?.items ?? []) {
    const image = hero.head?.currentVersion?.url ?? hero.portrait?.currentVersion?.url
    faces.set(hero.id, { name: hero.name, image })
    for (const form of hero.forms ?? [])
      faces.set(form.id, {
        name: form.name,
        image: form.head?.currentVersion?.url ?? form.portrait?.currentVersion?.url ?? image,
      })
  }

  // Newest first: seasons by their order, then patches by the game's order inside a season. The creation sequence only
  // breaks ties, since older patches can be entered after newer ones.
  const ordered = [...(releases.data ?? [])].sort((a, b) => {
    const [first, second] = [variants.get(a.variantId), variants.get(b.variantId)]
    return (
      seasonOrder(second?.seasonId) - seasonOrder(first?.seasonId) ||
      (second?.ordinal ?? 0) - (first?.ordinal ?? 0) ||
      b.sequence - a.sequence
    )
  })
  const revealed = useRevealedRows(ordered, `${scope.region}:${scope.locale}`, BATCH)
  const groups = new Map<string, PatchRelease[]>()
  for (const release of revealed.rows) {
    const season = variants.get(release.variantId)?.seasonId ?? ""
    groups.set(season, [...(groups.get(season) ?? []), release])
  }
  const total = (seasonId: string) =>
    ordered.filter((release) => (variants.get(release.variantId)?.seasonId ?? "") === seasonId).length

  return (
    <>
      <CatalogHeading
        title={t("updates")}
        lead={wikiText(
          locale,
          "Những gì đã thay đổi trong từng phiên bản, theo ghi chú đã được đối chiếu với nguồn công bố.",
          "What changed in each version, based on notes checked against the published source.",
        )}
      />
      {releases.isPending ? (
        <div className="wiki-updates-skeleton" role="status">
          <span className="sr-only">{t("loading")}</span>
          <span />
          <span />
          <span />
        </div>
      ) : releases.isError ? (
        <div role="status" className="wiki-updates-state">
          <p>{wikiText(locale, "Chưa tải được danh sách cập nhật.", "Could not load the updates.")}</p>
          <button type="button" onClick={() => void releases.refetch()}>
            {t("retry")}
          </button>
        </div>
      ) : !ordered.length ? (
        <p role="status" className="wiki-updates-state wiki-mascot-state">
          {wikiText(locale, "Chưa có bản cập nhật được công bố.", "No updates have been published yet.")}
        </p>
      ) : (
        <>
          {[...groups].map(([seasonId, items]) => (
            <section key={seasonId} className="wiki-updates-season">
              <header className="wiki-updates-heading">
                <h2>
                  {seasons.find((season) => season.id === seasonId)?.displayName ?? t("updates")}
                  <small>
                    {wikiText(
                      locale,
                      `${total(seasonId)} bản cập nhật`,
                      total(seasonId) === 1 ? "1 update" : `${total(seasonId)} updates`,
                    )}
                  </small>
                </h2>
              </header>
              <ol>
                {items.map((release) => (
                  <PatchRow
                    key={release.id}
                    release={release}
                    variant={variants.get(release.variantId)}
                    faces={faces}
                  />
                ))}
              </ol>
            </section>
          ))}
          <InfiniteScroll
            query={revealed.loader}
            label={wikiText(locale, "Đang tải thêm bản cập nhật", "Loading more updates")}
          />
        </>
      )}
    </>
  )
}
