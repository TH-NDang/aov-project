import { useQueries, useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { changeKind } from "../../lib/published-change-subjects"
import { changeSetKind, parseChangeSummary } from "../../lib/wiki-change-format"
import type { ChangeDomain } from "../../lib/wiki-patch-changes"
import { heroCatalogQuery } from "../hero/hero-api"
import { ChangeKind, ChangeList } from "./change-list"
import {
  formatReleaseDate,
  patchChangesQuery,
  patchReleasesQuery,
  type PatchChangeRow,
  type PatchRelease,
} from "./updates-api"
import "./updates.css"

const DOMAINS: { domain: ChangeDomain; title: [string, string]; tab?: string }[] = [
  { domain: "HERO", title: ["Tướng", "Heroes"] },
  { domain: "ITEM", title: ["Trang bị", "Equipment"], tab: "items" },
  { domain: "ENCHANTMENT", title: ["Phù hiệu", "Enchantments"], tab: "enchantments" },
  { domain: "ARCANA", title: ["Bảng ngọc", "Arcana"], tab: "arcana" },
  { domain: "SPELL", title: ["Phụ trợ", "Talents"], tab: "spells" },
]

const titleCase = (code: string) => code.charAt(0).toUpperCase() + code.slice(1)

function HeroRow({ row }: { row: PatchChangeRow }) {
  const scope = useWikiContext()
  const catalog = useQuery(heroCatalogQuery(scope))
  const hero = catalog.data?.items.find((item) => item.id === row.heroId)
  const name = hero?.name ?? titleCase(row.heroCode ?? "")
  const summary = parseChangeSummary(row.summary).text
  const image = hero?.head?.currentVersion?.url ?? hero?.portrait?.currentVersion?.url
  const heading = (
    <>
      <span className="wiki-patch-subject-art">{image ? <WikiImage src={image} alt="" /> : name.charAt(0)}</span>
      <strong>{name}</strong>
    </>
  )
  return (
    <article className="wiki-patch-subject">
      <header>
        {hero ? (
          <Link to={scope.href(`/hero/${hero.code}`)} className="wiki-patch-subject-link">
            {heading}
          </Link>
        ) : (
          <span className="wiki-patch-subject-link">{heading}</span>
        )}
        <ChangeKind kind={changeSetKind(row)} />
      </header>
      {summary && <p lang={row.actualLocale ?? undefined}>{summary}</p>}
      <ChangeList changes={row.changes ?? []} />
    </article>
  )
}

function CatalogRow({ row, tab }: { row: PatchChangeRow; tab?: string }) {
  const { href } = useWikiContext()
  const id = row.subject?.id ?? row.spellId
  const name = row.subject?.displayName ?? row.name ?? row.subject?.code ?? row.code ?? ""
  const summary = parseChangeSummary(row.summary).text
  return (
    <article className="wiki-patch-subject">
      <header>
        {id && tab ? (
          <Link to={href(`/warehouse?tab=${tab}&item=${id}`)} className="wiki-patch-subject-link">
            <strong>{name}</strong>
          </Link>
        ) : (
          <strong>{name}</strong>
        )}
        <ChangeKind kind={changeKind(row)} />
      </header>
      {summary && <p lang={row.actualLocale ?? undefined}>{summary}</p>}
    </article>
  )
}

function PatchContent({ release }: { release: PatchRelease }) {
  const scope = useWikiContext()
  const { locale, t, href } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const results = useQueries({
    queries: DOMAINS.map(({ domain }) => patchChangesQuery(scope, release, domain)),
  })
  const variant = scope.options?.patches.find((patch) => patch.id === release.variantId)
  const season = scope.options?.seasons.find((item) => item.id === variant?.seasonId)
  const date = formatReleaseDate(variant?.regionalDate, release.effectiveAt)
  const sections = DOMAINS.map((domain, index) => ({ ...domain, rows: results[index].data ?? [] }))
  const filled = sections.filter((section) => section.rows.length)
  const pending = results.some((result) => result.isPending)
  const failed = results.some((result) => result.isError)
  const source = sections
    .flatMap((section) => section.rows)
    .map((row) => row.sourceUrl ?? parseChangeSummary(row.summary).source)
    .find((url) => url && /^https:\/\//i.test(url))

  return (
    <>
      <header className="wiki-patch-header">
        <nav aria-label={text("Đường dẫn", "Breadcrumb")}>
          <Link to={href("/updates")}>{t("updates")}</Link>
          <span aria-hidden="true">/</span>
          <span>{release.code}</span>
        </nav>
        <h1>{release.title || release.code}</h1>
        <p className="wiki-patch-meta">
          {[season?.displayName, date].filter(Boolean).join(" · ")}
          {variant?.isCurrent && <span className="wiki-updates-current">{text("Đang áp dụng", "Current")}</span>}
          {source && (
            <a href={source} target="_blank" rel="noopener noreferrer">
              {text("Nguồn công bố", "Publication source")} <WikiIcon name="open" size={14} />
            </a>
          )}
        </p>
        {release.summary && <p lang={release.actualLocale ?? undefined}>{release.summary}</p>}
        {filled.length > 1 && (
          <nav className="wiki-patch-jump" aria-label={text("Trong bản cập nhật này", "In this update")}>
            {filled.map((section) => (
              <a key={section.domain} href={`#patch-${section.domain.toLowerCase()}`}>
                {text(...section.title)} <span>{section.rows.length}</span>
              </a>
            ))}
          </nav>
        )}
      </header>

      {filled.map((section) => (
        <section key={section.domain} id={`patch-${section.domain.toLowerCase()}`} className="wiki-patch-section">
          <h2>
            {text(...section.title)} <span>{section.rows.length}</span>
          </h2>
          <div className="wiki-patch-subjects">
            {section.rows.map((row, index) =>
              section.domain === "HERO" ? (
                <HeroRow key={row.id ?? index} row={row} />
              ) : (
                <CatalogRow key={row.changeSetId ?? row.id ?? index} row={row} tab={section.tab} />
              ),
            )}
          </div>
        </section>
      ))}

      {pending && (
        <p role="status" className="wiki-updates-state">
          {t("loading")}
        </p>
      )}
      {failed && (
        <div role="status" className="wiki-updates-state">
          <p>{text("Chưa tải được hết ghi chú của bản cập nhật.", "Some notes could not be loaded.")}</p>
          <button type="button" onClick={() => results.forEach((result) => result.isError && void result.refetch())}>
            {t("retry")}
          </button>
        </div>
      )}
      {!pending && !failed && !filled.length && (
        <p role="status" className="wiki-updates-state">
          {text(
            "Bản cập nhật này chưa có ghi chú gameplay được công bố.",
            "This update has no published gameplay notes yet.",
          )}
        </p>
      )}
    </>
  )
}

export function PatchDetailPage() {
  const scope = useWikiContext()
  const { locale, t, href } = scope
  const { patchCode } = useParams()
  const releases = useQuery(patchReleasesQuery(scope))
  const release = releases.data?.find((item) => item.code === patchCode || item.id === patchCode)

  return (
    <div className="wiki-updates">
      {release ? (
        <PatchContent key={release.id} release={release} />
      ) : releases.isPending ? (
        <p role="status" className="wiki-updates-state">
          {t("loading")}
        </p>
      ) : releases.isError ? (
        <div role="status" className="wiki-updates-state">
          <p>{wikiText(locale, "Chưa tải được bản cập nhật.", "Could not load this update.")}</p>
          <button type="button" onClick={() => void releases.refetch()}>
            {t("retry")}
          </button>
        </div>
      ) : (
        <div role="status" className="wiki-updates-state">
          <h1>{wikiText(locale, "Không tìm thấy bản cập nhật", "Update not found")}</h1>
          <Link to={href("/updates")}>{wikiText(locale, "Xem tất cả bản cập nhật", "See all updates")}</Link>
        </div>
      )}
    </div>
  )
}
