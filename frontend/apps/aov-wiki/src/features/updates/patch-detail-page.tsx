import { useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { catalogIcons } from "@aov/ui/components/catalog-icons"
import { Link, useParams } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { changeKind } from "../../lib/published-change-subjects"
import { changeSetKind, parseChangeSummary } from "../../lib/wiki-change-format"
import type { ChangeDomain } from "../../lib/wiki-patch-changes"
import { warehousePath } from "../../lib/wiki-catalog"
import { heroCatalogQuery, heroDetailQuery } from "../hero/hero-api"
import { ChangeDisclosure, ChangeKind, ChangeList } from "./change-list"
import { ReleaseDate } from "./release-date"
import {
  patchChangesQuery,
  patchReleasesQuery,
  releaseDateValue,
  type PatchChangeRow,
  type PatchRelease,
} from "./updates-api"
import "./updates.css"

const DOMAINS: {
  domain: ChangeDomain
  title: [string, string]
  tab?: string
  Icon: (typeof catalogIcons)[keyof typeof catalogIcons]
}[] = [
  { domain: "HERO", title: ["Tướng", "Heroes"], Icon: catalogIcons.heroes },
  { domain: "ITEM", title: ["Trang bị", "Equipment"], tab: "items", Icon: catalogIcons.items },
  { domain: "ENCHANTMENT", title: ["Phù hiệu", "Enchantments"], tab: "enchantments", Icon: catalogIcons.enchantments },
  { domain: "ARCANA", title: ["Bảng ngọc", "Arcana"], tab: "arcana", Icon: catalogIcons.arcana },
  { domain: "SPELL", title: ["Phụ trợ", "Talents"], tab: "spells", Icon: catalogIcons.spells },
]

const titleCase = (code: string) => code.charAt(0).toUpperCase() + code.slice(1)

function HeroRow({
  row,
  variantId,
  open,
  onToggle,
}: {
  row: PatchChangeRow
  variantId: string
  open: boolean
  onToggle: () => void
}) {
  const scope = useWikiContext()
  const catalog = useQuery(heroCatalogQuery(scope))
  const hero = catalog.data?.items.find((item) => item.id === row.heroId)
  const variant = scope.options?.patches.find((patch) => patch.id === variantId)
  // The hero as of this update names its skills and tells how many levels each has.
  const detail = useQuery({
    ...heroDetailQuery(hero?.id ?? "", {
      region: scope.region,
      locale: scope.locale,
      seasonId: variant?.seasonId,
      patchVariantId: variantId,
      includeUnscoped: false,
    }),
    enabled: !!hero && !!variant,
  })
  const count = row.changes?.length ?? 0
  const name = hero?.name ?? titleCase(row.heroCode ?? "")
  const summary = parseChangeSummary(row.summary).text
  const image = hero?.head?.currentVersion?.url ?? hero?.portrait?.currentVersion?.url
  const heading = (
    <>
      <span className="wiki-patch-subject-art">{image ? <WikiImage src={image} alt="" /> : name.charAt(0)}</span>
      <span className="wiki-patch-subject-name">
        <strong>{name}</strong>
        {count > 0 && <small>{wikiText(scope.locale, `${count} thay đổi`, `${count} changes`)}</small>}
      </span>
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
        <span className="wiki-patch-overall">
          {row.overallKind && <small>{wikiText(scope.locale, "Tổng thể", "Overall")}</small>}
          <ChangeKind kind={changeSetKind(row)} />
        </span>
      </header>
      {summary && <p lang={row.actualLocale ?? undefined}>{summary}</p>}
      {count > 0 && (
        <ChangeDisclosure count={count} open={open} onToggle={onToggle}>
          <ChangeList
            changes={row.changes ?? []}
            hero={detail.data}
            skillAction={
              hero
                ? (key) => (
                    <Link
                      className="wiki-change-skill-link"
                      to={scope.href(
                        `/hero/${hero.code}?${variant && !variant.isCurrent ? `season=${variant.seasonId}&patch=${variantId}&` : ""}skill=${encodeURIComponent(key)}#wiki-kit-title`,
                      )}
                    >
                      {wikiText(scope.locale, "Xem kỹ năng đầy đủ", "See full ability")}
                      <WikiIcon name="arrow" size={14} />
                    </Link>
                  )
                : undefined
            }
          />
        </ChangeDisclosure>
      )}
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
          <Link to={href(warehousePath(tab, id))} className="wiki-patch-subject-link">
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
  const [openHeroes, setOpenHeroes] = useState<ReadonlySet<string>>(new Set())
  const toggleHero = (key: string) =>
    setOpenHeroes((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const variant = scope.options?.patches.find((patch) => patch.id === release.variantId)
  const season = scope.options?.seasons.find((item) => item.id === variant?.seasonId)
  const sections = DOMAINS.map((domain, index) => ({ ...domain, rows: results[index].data ?? [] }))
  const filled = sections.filter((section) => section.rows.length)
  const pending = results.some((result) => result.isPending)
  const failed = results.some((result) => result.isError)
  const heroKey = (row: PatchChangeRow, index: number) => String(row.id ?? index)
  const heroKeys = (sections.find((section) => section.domain === "HERO")?.rows ?? [])
    .map((row, index) => (row.changes?.length ? heroKey(row, index) : null))
    .filter((key): key is string => !!key)
  const allHeroesOpen = heroKeys.length > 0 && heroKeys.every((key) => openHeroes.has(key))
  const source = sections
    .flatMap((section) => section.rows)
    .map((row) => row.sourceUrl ?? parseChangeSummary(row.summary).source)
    .find((url) => url && /^https:\/\//i.test(url))

  return (
    <div className="wiki-document public-panel">
      <header className="wiki-patch-header">
        <nav aria-label={text("Đường dẫn", "Breadcrumb")}>
          <Link to={href("/updates")}>{t("updates")}</Link>
          <span aria-hidden="true">/</span>
          <span>{release.code}</span>
        </nav>
        <h1>{release.title || release.code}</h1>
        <p className="wiki-patch-meta">
          {season?.displayName}
          {season?.displayName && releaseDateValue(variant?.regionalDate, release.effectiveAt) && " · "}
          <ReleaseDate regionalDate={variant?.regionalDate} effectiveAt={release.effectiveAt} />
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
                <section.Icon size={18} />
                {text(...section.title)} <span>{section.rows.length}</span>
              </a>
            ))}
          </nav>
        )}
      </header>

      {filled.map((section) => (
        <section key={section.domain} id={`patch-${section.domain.toLowerCase()}`} className="wiki-patch-section">
          <h2>
            <section.Icon size={24} />
            {text(...section.title)} <span>{section.rows.length}</span>
            {section.domain === "HERO" && heroKeys.length > 1 && (
              <button
                type="button"
                className="wiki-patch-expand"
                aria-pressed={allHeroesOpen}
                onClick={() => setOpenHeroes(allHeroesOpen ? new Set() : new Set(heroKeys))}
              >
                {allHeroesOpen ? text("Thu gọn tất cả", "Collapse all") : text("Mở rộng tất cả", "Expand all")}
              </button>
            )}
          </h2>
          <div className="wiki-patch-subjects">
            {section.rows.map((row, index) =>
              section.domain === "HERO" ? (
                <HeroRow
                  key={row.id ?? index}
                  row={row}
                  variantId={release.variantId}
                  open={openHeroes.has(heroKey(row, index))}
                  onToggle={() => toggleHero(heroKey(row, index))}
                />
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
        <p role="status" className="wiki-updates-state wiki-mascot-state">
          {text(
            "Bản cập nhật này chưa có ghi chú gameplay được công bố.",
            "This update has no published gameplay notes yet.",
          )}
        </p>
      )}
    </div>
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
        <div role="status" className="wiki-updates-state wiki-mascot-state">
          <h1>{wikiText(locale, "Không tìm thấy bản cập nhật", "Update not found")}</h1>
          <Link to={href("/updates")}>{wikiText(locale, "Xem tất cả bản cập nhật", "See all updates")}</Link>
        </div>
      )}
    </div>
  )
}
