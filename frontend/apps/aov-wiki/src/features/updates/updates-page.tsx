import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { patchReleasesQuery, type PatchRelease } from "./updates-api"
import { ReleaseDate } from "./release-date"
import "./updates.css"

export function UpdatesPage() {
  const scope = useWikiContext()
  const { locale, t, href } = scope
  const releases = useQuery(patchReleasesQuery(scope))
  const seasons = scope.options?.seasons ?? []
  const variants = new Map(scope.options?.patches.map((patch) => [patch.id, patch]))

  const groups = new Map<string, PatchRelease[]>()
  for (const release of releases.data ?? []) {
    const season = variants.get(release.variantId)?.seasonId ?? ""
    groups.set(season, [...(groups.get(season) ?? []), release])
  }
  const ordered = [...groups.entries()].sort(
    ([a], [b]) =>
      (seasons.find((season) => season.id === b)?.ordinal ?? -1) -
      (seasons.find((season) => season.id === a)?.ordinal ?? -1),
  )

  return (
    <div className="wiki-updates">
      <CatalogHeading title={t("updates")} section={t("news")} />
      <p className="wiki-updates-lead">
        {wikiText(
          locale,
          "Những gì đã thay đổi trong từng phiên bản, theo ghi chú đã được đối chiếu với nguồn công bố.",
          "What changed in each version, based on notes checked against the published source.",
        )}
      </p>
      {releases.isPending ? (
        <p role="status" className="wiki-updates-state">
          {t("loading")}
        </p>
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
        ordered.map(([seasonId, items]) => (
          <section key={seasonId} className="wiki-updates-season">
            <h2>{seasons.find((season) => season.id === seasonId)?.displayName ?? t("updates")}</h2>
            <ol>
              {[...items]
                .sort((a, b) => b.sequence - a.sequence)
                .map((release) => {
                  const variant = variants.get(release.variantId)
                  return (
                    <li key={release.id}>
                      <Link
                        to={href(`/updates/${release.code}`)}
                        className="wiki-updates-row public-panel"
                        data-current={variant?.isCurrent || undefined}
                      >
                        <navArtIcons.releases size={28} />
                        <ReleaseDate
                          regionalDate={variant?.regionalDate}
                          effectiveAt={release.effectiveAt}
                          fallback={<time>{release.code}</time>}
                        />
                        <strong>{release.title || release.code}</strong>
                        {variant?.isCurrent && (
                          <span className="wiki-updates-current">{wikiText(locale, "Đang áp dụng", "Current")}</span>
                        )}
                      </Link>
                    </li>
                  )
                })}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
