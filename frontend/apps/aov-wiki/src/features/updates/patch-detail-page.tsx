import { localeText } from "@aov/ui/lib/locale-text"
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { ChangeKindMark, ChangeTag } from "../../components/change-tag"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { Link, useLocation, useNavigate, useParams } from "react-router"
import { KIND_ORDER, patchChangeLabel, patchChangeTone } from "../../lib/change-kinds"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText, useWikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { changeKind } from "../../lib/published-change-subjects"
import { changeSetKind, parseChangeSummary } from "../../lib/wiki-change-format"
import type { ChangeDomain } from "../../lib/wiki-patch-changes"
import { notFoundMeta, patchMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { warehousePath } from "../../lib/wiki-catalog"
import { warehouseCatalogQuery } from "../../lib/warehouse-api"
import { warehouseImage, type WarehouseKind } from "../../lib/warehouse-types"
import { heroDetailQuery, type HeroDetail } from "../../lib/hero-api"
import { activeSection } from "../../lib/hero-section-position"
import { ChangeDisclosure, ChangeKind, ChangeList } from "../../components/change-list"
import { ReleaseDate } from "./release-date"
import { PatchFixes, type FixEntry } from "./patch-fixes"
import { PatchSourceList } from "./patch-sources"
import { PatchMarketBoard } from "./patch-markets"
import { HeroPatchVideoButton, PatchVideoTimeline } from "./patch-videos"
import { patchSourceLinks } from "../../lib/patch-sources"
import { FIX_KIND, isCatalogFix, splitHeroFixes } from "../../lib/patch-fixes"
import {
  patchChangesQuery,
  patchReleasesQuery,
  releaseDateValue,
  type PatchChangeRow,
  type PatchRelease,
} from "../../lib/updates-api"
import "./updates.css"

const DOMAINS: { domain: ChangeDomain; title: [string, string]; tab?: WarehouseKind }[] = [
  { domain: "HERO", title: ["Tướng", "Heroes"] },
  { domain: "ITEM", title: ["Trang bị", "Equipment"], tab: "items" },
  { domain: "ENCHANTMENT", title: ["Phù hiệu", "Enchantments"], tab: "enchantments" },
  { domain: "ARCANA", title: ["Bảng ngọc", "Arcana"], tab: "arcana" },
  { domain: "SPELL", title: ["Phụ trợ", "Talents"], tab: "spells" },
]

/** Far enough below the sticky header that a hero counts as being read once its name settles under it. */
const READING_LINE = 120

const titleCase = (code: string) => code.charAt(0).toUpperCase() + code.slice(1)

/** A line of an imported update that names the page it was checked against, followed by a remark for its editors. */
const CHECKED_AGAINST = /^Nguồn đối chiếu:\s*(https:\/\/\S+)/i

/**
 * The update's own summary, read like the notes of its entries. An imported update can also hold a single line that
 * gives the page its notes were checked against and what is left for editors to verify: readers get the page as the
 * source, and the remark stays out of their way.
 */
function releaseSummary(summary: string | null | undefined) {
  const parsed = parseChangeSummary(summary)
  let source = parsed.source
  const text = parsed.text
    .split("\n")
    .filter((line) => {
      const checked = CHECKED_AGAINST.exec(line)
      if (checked) source ??= checked[1]
      return !checked
    })
    .join("\n")
  return { text, source }
}

/** One line of the index: something the patch changed and where its notes start on the page. */
interface IndexEntry {
  id: string
  name: string
  kind?: string | null
  image?: string
}

interface IndexGroup {
  id: string
  title: string
  /** Shown with pictures where the entries have them. */
  pictured: boolean
  entries: IndexEntry[]
}

/** A hero's row with what its notes need: the hero as of this update, its name, its picture and its place on the page. */
interface HeroEntry extends IndexEntry {
  key: string
  row: PatchChangeRow
  hero?: HeroDetail
  summary: string
}

/** Goes to a place on the page and writes it into the address, so the place can be shared. */
function useJump() {
  const navigate = useNavigate()
  const { search } = useLocation()
  return (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    void navigate({ search, hash: `#${id}` }, { replace: true })
    // Instant on purpose: an animated scroll stops partway when pictures load in the sections it passes.
    target.scrollIntoView({ block: "start" })
    target.focus({ preventScroll: true })
  }
}

/** The entry being read: the last one, going down the page, whose start has passed under the header. */
function useReadingPlace(ids: string[]) {
  const [active, setActive] = useState<string>()
  const list = ids.join(" ")
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const positions = list.split(" ").flatMap((id) => {
        const box = document.getElementById(id)?.getBoundingClientRect()
        return box ? [{ id, top: box.top }] : []
      })
      const page = document.documentElement
      const atEnd =
        page.scrollHeight > window.innerHeight && window.scrollY + window.innerHeight >= page.scrollHeight - 2
      setActive(activeSection(positions, READING_LINE, atEnd))
    }
    const schedule = () => {
      frame ||= requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [list])
  return active
}

function KindMark({ kind, size }: { kind?: string | null; size: number }) {
  const { locale } = useWikiContext()
  if (!kind) return null
  return (
    <span className="wiki-patch-kind">
      <ChangeKindMark kind={kind} size={size} />
      <span className="sr-only">{patchChangeLabel(kind, locale)}</span>
    </span>
  )
}

function EntryArt({ entry }: { entry: IndexEntry }) {
  return (
    <span className="wiki-patch-subject-art">
      {entry.image ? <WikiImage frameWidth={64} src={entry.image} alt="" /> : entry.name.charAt(0)}
    </span>
  )
}

/** Wide screens: the index stays beside the notes and marks the entry being read. */
function PatchRail({ groups, title }: { groups: IndexGroup[]; title: string }) {
  const jump = useJump()
  const rail = useRef<HTMLElement>(null)
  const active = useReadingPlace(groups.flatMap((group) => group.entries.map((entry) => entry.id)))

  useEffect(() => {
    // A long index scrolls on its own, and the marked entry has to stay in sight.
    const box = rail.current
    const link = box?.querySelector<HTMLElement>("[aria-current]")
    if (!box || !link) return
    const frame = box.getBoundingClientRect()
    const row = link.getBoundingClientRect()
    if (row.top < frame.top) box.scrollTop -= frame.top - row.top + 8
    else if (row.bottom > frame.bottom) box.scrollTop += row.bottom - frame.bottom + 8
  }, [active])

  return (
    <nav ref={rail} className="wiki-patch-rail" aria-label={title}>
      <h2>{title}</h2>
      {groups.map((group) => (
        <div className="wiki-patch-rail-group" key={group.id}>
          <a className="wiki-patch-rail-label" href={`#${group.id}`} onClick={(event) => jump(event, group.id)}>
            {group.title} <span>{group.entries.length}</span>
          </a>
          <ul>
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  aria-current={entry.id === active ? "location" : undefined}
                  data-plain={group.pictured ? undefined : ""}
                  onClick={(event) => jump(event, entry.id)}
                >
                  {group.pictured && <EntryArt entry={entry} />}
                  <span>{entry.name}</span>
                  <KindMark kind={entry.kind} size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Compact screens: the same index under the head, as rows that scroll sideways. */
function PatchStrip({ groups, title }: { groups: IndexGroup[]; title: string }) {
  const { locale } = useWikiContext()
  const jump = useJump()
  const heroes = groups.find((group) => group.id === "patch-hero")
  return (
    <>
      {groups.length > 1 && (
        <nav className="wiki-patch-jump" aria-label={title}>
          {groups.map((group) => (
            <a key={group.id} href={`#${group.id}`} onClick={(event) => jump(event, group.id)}>
              {group.title} <span>{group.entries.length}</span>
            </a>
          ))}
        </nav>
      )}
      {heroes && heroes.entries.length > 1 && (
        <nav className="wiki-patch-strip" aria-label={wikiText(locale, "Tướng thay đổi", "Heroes changed")}>
          <ul>
            {heroes.entries.map((entry) => (
              <li key={entry.id}>
                <a href={`#${entry.id}`} onClick={(event) => jump(event, entry.id)}>
                  <span className="wiki-patch-strip-art">
                    <EntryArt entry={entry} />
                    <KindMark kind={entry.kind} size={16} />
                  </span>
                  {entry.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  )
}

function HeroNotes({
  entry,
  variantId,
  showSummary,
  open,
  onToggle,
  onLongChange,
  hidden,
}: {
  entry: HeroEntry
  variantId: string
  /** False when every hero of the update carries the same sentence, which the section then says once. */
  showSummary: boolean
  open: boolean
  onToggle: () => void
  onLongChange: (long: boolean) => void
  /** Left out by the kind filter: kept on the page so its place and its open state stay. */
  hidden: boolean
}) {
  const scope = useWikiContext()
  const layout = usePageLayout()
  const text = useWikiText()
  const { row, hero, name, kind } = entry
  const variant = scope.options?.patches.find((patch) => patch.id === variantId)
  const count = row.changes?.length ?? 0
  const page = hero ? scope.href(`/hero/${hero.code}`) : null
  const nameId = `${entry.id}-name`
  return (
    <article
      className="wiki-patch-subject wiki-patch-hero"
      id={entry.id}
      tabIndex={-1}
      aria-labelledby={nameId}
      data-tone={kind ? patchChangeTone(kind) : undefined}
      hidden={hidden}
    >
      <header className="wiki-patch-hero-head">
        {page ? (
          // The name beside it is the link readers and screen readers use; the picture is a second way to press it.
          <Link to={page} className="wiki-patch-subject-art" tabIndex={-1} aria-hidden="true">
            {entry.image ? <WikiImage frameWidth={64} src={entry.image} alt="" /> : name.charAt(0)}
          </Link>
        ) : (
          <EntryArt entry={entry} />
        )}
        <div>
          <h3 id={nameId}>{page ? <Link to={page}>{name}</Link> : name}</h3>
          <p className="wiki-patch-hero-meta">
            {row.introducesHero && kind !== "RELEASE" && <ChangeKind kind="RELEASE" />}
            {kind && (
              <>
                {row.overallKind && <span className="sr-only">{text("Tổng thể", "Overall")}:</span>}
                <ChangeKind kind={kind} />
              </>
            )}
            {count > 0 && <span>{text(`${count} thay đổi`, count === 1 ? "1 change" : `${count} changes`)}</span>}
            <HeroPatchVideoButton variantId={variantId} heroId={row.heroId ?? hero?.id} />
          </p>
        </div>
        {page && layout === "wide" && (
          <Link className="wiki-patch-hero-page" to={page} tabIndex={-1}>
            {text("Trang tướng", "Hero page")}
            <WikiIcon name="arrow" size={14} />
          </Link>
        )}
      </header>
      <div className="wiki-patch-hero-body">
        {showSummary && entry.summary && <p lang={row.actualLocale ?? undefined}>{entry.summary}</p>}
        {count > 0 && (
          <ChangeDisclosure count={count} open={open} onToggle={onToggle} onLongChange={onLongChange}>
            <ChangeList
              changes={row.changes ?? []}
              hero={hero}
              overallKind={kind}
              kindMark={(change) => <ChangeTag kind={change} />}
              skillAction={
                hero
                  ? (key) => (
                      <Link
                        className="wiki-change-skill-link"
                        to={scope.href(
                          `/hero/${hero.code}?${variant && !variant.isCurrent ? `season=${variant.seasonId}&patch=${variantId}&` : ""}skill=${encodeURIComponent(key)}#wiki-kit-title`,
                        )}
                      >
                        {layout === "compact"
                          ? text("Xem kỹ năng", "See ability")
                          : text("Xem kỹ năng đầy đủ", "See full ability")}
                        <WikiIcon name="arrow" size={14} />
                      </Link>
                    )
                  : undefined
              }
            />
          </ChangeDisclosure>
        )}
      </div>
    </article>
  )
}

/** An armory entry: its picture beside its name, the kind of its change and its note. */
function CatalogNotes({ entry, row, tab }: { entry: IndexEntry; row: PatchChangeRow; tab?: string }) {
  const { href } = useWikiContext()
  const target = row.subject?.id ?? row.spellId
  const page = target && tab ? href(warehousePath(tab, target)) : null
  const summary = parseChangeSummary(row.summary).text
  return (
    <article className="wiki-patch-subject wiki-patch-catalog" id={entry.id} tabIndex={-1}>
      {page ? (
        // The name is the link readers and screen readers use; the picture is a second way to press it.
        <Link to={page} className="wiki-patch-subject-art" tabIndex={-1} aria-hidden="true">
          {entry.image ? <WikiImage frameWidth={64} src={entry.image} alt="" /> : entry.name.charAt(0)}
        </Link>
      ) : (
        <EntryArt entry={entry} />
      )}
      <div className="wiki-patch-catalog-body">
        <header>
          <h3>{page ? <Link to={page}>{entry.name}</Link> : entry.name}</h3>
          <ChangeKind kind={entry.kind} />
        </header>
        {summary && <p lang={row.actualLocale ?? undefined}>{summary}</p>}
      </div>
    </article>
  )
}

function PatchContent({ release }: { release: PatchRelease }) {
  const scope = useWikiContext()
  const { locale, href } = scope
  const t = localeText(locale)
  const layout = usePageLayout()
  const { hash } = useLocation()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const results = useQueries({
    queries: DOMAINS.map(({ domain }) => patchChangesQuery(scope, release, domain)),
  })
  const variant = scope.options?.patches.find((patch) => patch.id === release.variantId)
  const season = scope.options?.seasons.find((item) => item.id === variant?.seasonId)
  // Fixes are read apart from the balance changes: `rows` holds what the section shows, `fixes` what moves to the end.
  const sections = DOMAINS.map((domain, index) => {
    const all = results[index].data ?? []
    const split =
      domain.domain === "HERO"
        ? splitHeroFixes(all)
        : { main: all.filter((row) => !isCatalogFix(row)), fixes: all.filter(isCatalogFix) }
    return { ...domain, id: `patch-${domain.domain.toLowerCase()}`, all, rows: split.main, fixes: split.fixes }
  })
  const filled = sections.filter((section) => section.rows.length)
  const pending = results.some((result) => result.isPending)
  const failed = results.some((result) => result.isError)

  // The armory as of this update gives each entry its picture; read only for the kinds the update changed.
  const catalogScope = {
    region: scope.region,
    locale: scope.locale,
    seasonId: variant?.seasonId,
    patchVariantId: release.variantId,
  }
  const catalogs = useQueries({
    queries: sections.map((section) => ({
      ...warehouseCatalogQuery(section.tab ?? "items", catalogScope),
      // The browser keeps one copy of each armory: the version the reader picked, not this one.
      meta: undefined,
      enabled: !!section.tab && !!variant && section.all.length > 0,
    })),
  })
  const pictureOf = (index: number, row: PatchChangeRow) => {
    const id = row.subject?.id ?? row.spellId
    const entry = id ? catalogs[index]?.data?.find((item) => item.id === id) : undefined
    return entry && warehouseImage(entry)
  }

  const heroSection = sections.find((section) => section.domain === "HERO")
  const heroRows = heroSection?.all ?? []
  // The hero as of this update gives its name and picture, names its skills and tells how many levels each has.
  // Each is read straight from the row's hero, without waiting for the whole hero list.
  const details = useQueries({
    queries: heroRows.map((row) => ({
      ...heroDetailQuery(row.heroId ?? "", {
        region: scope.region,
        locale: scope.locale,
        seasonId: variant?.seasonId,
        patchVariantId: release.variantId,
        includeUnscoped: false,
      }),
      enabled: !!row.heroId && !!variant,
    })),
  })
  const taken = new Set<string>()
  // A place on the page for each entry; a hero listed twice in one update still gets a place of its own.
  const place = (wanted: string) => {
    let id = wanted
    for (let copy = 2; taken.has(id); copy++) id = `${wanted}-${copy}`
    taken.add(id)
    return id
  }
  const detailOf = new Map(heroRows.map((row, index) => [row.heroId, details[index]?.data]))
  const heroLook = (row: PatchChangeRow) => {
    const hero = row.heroId ? detailOf.get(row.heroId) : undefined
    return {
      hero,
      name: hero?.content.profile?.name ?? titleCase(row.heroCode ?? ""),
      image: hero?.media.HEAD?.currentVersion?.url ?? hero?.media.PORTRAIT?.currentVersion?.url,
    }
  }
  const heroes: HeroEntry[] = (heroSection?.rows ?? []).map((row, index) => ({
    ...heroLook(row),
    key: String(row.id ?? index),
    id: place(`patch-hero-${row.heroCode ?? index}`),
    row,
    kind: changeSetKind(row),
    summary: parseChangeSummary(row.summary).text,
  }))
  // Imported notes can carry one sentence for every hero; said once, it does not have to be read eight times.
  const sharedSummary =
    heroes.length > 1 && heroes.every((entry) => entry.summary === heroes[0].summary) ? heroes[0].summary : ""
  const catalogEntries = new Map(
    sections
      .map((section, at) => ({ section, at }))
      .filter(({ section }) => section.domain !== "HERO" && section.rows.length)
      .map(({ section, at }) => [
        section.domain,
        section.rows.map((row, index): IndexEntry => ({
          id: place(`${section.id}-${row.subject?.code ?? row.code ?? index}`),
          name: row.subject?.displayName ?? row.name ?? row.subject?.code ?? row.code ?? "",
          kind: changeKind(row),
          image: pictureOf(at, row),
        })),
      ]),
  )
  const fixes = sections.flatMap((section, at) =>
    section.fixes.map((row, index): FixEntry => {
      if (section.domain === "HERO") {
        const look = heroLook(row)
        return {
          ...look,
          id: place(`patch-fix-${row.heroCode ?? index}`),
          kind: FIX_KIND,
          page: look.hero ? href(`/hero/${look.hero.code}`) : null,
          row,
        }
      }
      const target = row.subject?.id ?? row.spellId
      return {
        id: place(`patch-fix-${row.subject?.code ?? row.code ?? index}`),
        name: row.subject?.displayName ?? row.name ?? row.subject?.code ?? row.code ?? "",
        kind: FIX_KIND,
        image: pictureOf(at, row),
        page: target && section.tab ? href(warehousePath(section.tab, target)) : null,
        domainLabel: text(...section.title),
        row,
      }
    }),
  )
  const fixesTitle = text("Sửa lỗi và tối ưu", "Fixes and optimisations")
  const groups: IndexGroup[] = filled.map((section) => {
    const entries = section.domain === "HERO" ? heroes : (catalogEntries.get(section.domain) ?? [])
    return {
      id: section.id,
      title: text(...section.title),
      pictured: section.domain === "HERO" || entries.some((entry) => entry.image),
      entries,
    }
  })
  if (fixes.length) groups.push({ id: "patch-fixes", title: fixesTitle, pictured: true, entries: fixes })
  const indexed = groups.reduce((total, group) => total + group.entries.length, 0) > 1
  const indexTitle = text("Trong bản cập nhật này", "In this update")

  // The kinds among the heroes, in the order readers look for, each with how many heroes it covers.
  const [kindFilter, setKindFilter] = useState<string | null>(null)
  const heroKinds = [...new Set(heroes.map((entry) => entry.kind ?? "UPDATED"))].sort(
    (a, b) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99),
  )
  const heroCount = (kind: string) => heroes.filter((entry) => (entry.kind ?? "UPDATED") === kind).length
  const [openHeroes, setOpenHeroes] = useState<ReadonlySet<string>>(new Set())
  const [longHeroes, setLongHeroes] = useState<ReadonlySet<string>>(new Set())
  const toggleHero = (key: string) =>
    setOpenHeroes((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const markLong = useCallback(
    (key: string, long: boolean) =>
      setLongHeroes((current) => {
        if (current.has(key) === long) return current
        const next = new Set(current)
        if (long) next.add(key)
        else next.delete(key)
        return next
      }),
    [],
  )
  const longKeys = heroes.filter((entry) => longHeroes.has(entry.key)).map((entry) => entry.key)
  const allHeroesOpen = longKeys.length > 0 && longKeys.every((key) => openHeroes.has(key))

  const summary = releaseSummary(release.summary)
  const source = [
    ...sections.flatMap((section) => section.all).map((row) => row.sourceUrl ?? parseChangeSummary(row.summary).source),
    summary.source,
  ].find((url) => url && /^https:\/\//i.test(url))

  // An address that names a place on the page is followed once the notes that hold the place have arrived.
  const arrived = useRef(false)
  const ready = !pending && groups.length > 0
  useEffect(() => {
    if (arrived.current || !ready || hash.length < 2) return
    // After the app's own return to the top of a new address, which runs once this effect has.
    const frame = requestAnimationFrame(() => {
      arrived.current = true
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" })
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, hash])

  const title = release.title || release.code
  const meta = (
    <span className="wiki-patch-meta">
      {season?.displayName && <span>{season.displayName}</span>}
      {season?.displayName && releaseDateValue(variant?.regionalDate, release.effectiveAt) && (
        <span aria-hidden="true">·</span>
      )}
      <ReleaseDate regionalDate={variant?.regionalDate} effectiveAt={release.effectiveAt} />
      {variant?.isCurrent && <span className="wiki-updates-current">{text("Đang áp dụng", "Current")}</span>}
    </span>
  )
  // One page is a link beside the title; several are named by language in a row of their own under it.
  const links = patchSourceLinks(release.sources, source)
  const sourceLink = links.length === 1 && !(release.markets?.length || links[0].region) && (
    <a
      className="wiki-patch-source"
      href={links[0].url}
      target="_blank"
      rel="noopener noreferrer"
      hrefLang={links[0].locale ?? undefined}
      title={links[0].label || undefined}
    >
      {text("Nguồn công bố", "Publication source")} <WikiIcon name="open" size={16} />
    </a>
  )
  // Markets with a release or a page of their own get the ledger of when and where; older patches keep the plain row.
  const marketBoard =
    (release.markets?.length ?? 0) > 0 || links.some((link) => link.region) ? (
      <PatchMarketBoard markets={release.markets ?? []} sources={links} />
    ) : null
  const sourceList = marketBoard ?? (links.length > 1 && <PatchSourceList links={links} />)
  const videoMarket =
    release.markets?.find((market) => market.region === "VN") ??
    (scope.region === "VN" && release.effectiveAt
      ? { region: "VN", timeZone: "Asia/Ho_Chi_Minh", effectiveAt: release.effectiveAt }
      : undefined)
  const heroNames = new Map(heroes.map((entry) => [entry.row.heroId ?? entry.hero?.id ?? "", entry.name]))

  return (
    <>
      {layout === "compact" ? (
        <header className="wiki-patch-compact-head">
          <div className="wiki-patch-compact-links">
            {/* The header already names the section, so the way back says where it leads. */}
            <Link className="wiki-patch-back" to={href("/updates")}>
              <WikiIcon name="chevronLeft" size={16} />
              {text("Tất cả bản cập nhật", "All updates")}
            </Link>
            {sourceLink}
          </div>
          <h1 className="wiki-patch-title">{title}</h1>
          <p>{meta}</p>
          {sourceList}
        </header>
      ) : (
        <>
          <CatalogHeading
            title={title}
            back={{ to: href("/updates"), label: t("Ghi chú cập nhật", "Patch notes") }}
            lead={meta}
            action={sourceLink}
          />
          {sourceList}
        </>
      )}

      <div className="wiki-patch-layout" data-rail={layout === "wide" && indexed ? "" : undefined}>
        <div className="wiki-patch-main">
          {summary.text && (
            <p className="wiki-patch-summary" lang={release.actualLocale ?? undefined}>
              {summary.text}
            </p>
          )}
          {layout === "compact" && indexed && <PatchStrip groups={groups} title={indexTitle} />}
          <PatchVideoTimeline
            variantId={release.variantId}
            release={videoMarket}
            heroName={(heroId) => heroNames.get(heroId)}
          />

          {filled.map((section) => (
            <section
              key={section.domain}
              id={section.id}
              tabIndex={-1}
              className="wiki-patch-section"
              aria-labelledby={`${section.id}-title`}
            >
              <header className="wiki-updates-heading">
                <div>
                  <h2 id={`${section.id}-title`}>
                    {text(...section.title)} <small>{section.rows.length}</small>
                  </h2>
                  {section.domain === "HERO" && sharedSummary && (
                    <p lang={heroes[0].row.actualLocale ?? undefined}>{sharedSummary}</p>
                  )}
                </div>
                {section.domain === "HERO" && longKeys.length > 0 && (
                  <button
                    type="button"
                    className="wiki-patch-expand"
                    aria-pressed={allHeroesOpen}
                    onClick={() => setOpenHeroes(allHeroesOpen ? new Set() : new Set(longKeys))}
                  >
                    {allHeroesOpen ? text("Thu gọn tất cả", "Collapse all") : text("Mở rộng tất cả", "Expand all")}
                  </button>
                )}
              </header>
              {section.domain === "HERO" && heroKinds.length > 1 && (
                <div
                  className="wiki-patch-filter"
                  role="group"
                  aria-label={text("Lọc theo loại thay đổi", "Filter by kind")}
                >
                  <button type="button" aria-pressed={!kindFilter} onClick={() => setKindFilter(null)}>
                    {text("Tất cả", "All")} <b>{heroes.length}</b>
                  </button>
                  {heroKinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={kindFilter === kind}
                      onClick={() => setKindFilter(kindFilter === kind ? null : kind)}
                    >
                      <ChangeTag kind={kind} />
                      <span className="sr-only">{patchChangeLabel(kind, locale)}</span>
                      <b>{heroCount(kind)}</b>
                    </button>
                  ))}
                </div>
              )}
              <div className="wiki-patch-subjects">
                {section.domain === "HERO"
                  ? heroes.map((entry) => (
                      <HeroNotes
                        key={entry.key}
                        entry={entry}
                        variantId={release.variantId}
                        showSummary={!sharedSummary}
                        open={openHeroes.has(entry.key)}
                        onToggle={() => toggleHero(entry.key)}
                        onLongChange={(long) => markLong(entry.key, long)}
                        hidden={!!kindFilter && (entry.kind ?? "UPDATED") !== kindFilter}
                      />
                    ))
                  : section.rows.map((row, index) => (
                      <CatalogNotes
                        key={row.changeSetId ?? row.id ?? index}
                        entry={
                          catalogEntries.get(section.domain)?.[index] ?? {
                            id: `${section.id}-${index}`,
                            name: row.name ?? row.code ?? "",
                          }
                        }
                        row={row}
                        tab={section.tab}
                      />
                    ))}
              </div>
            </section>
          ))}
          {fixes.length > 0 && <PatchFixes id="patch-fixes" title={fixesTitle} entries={fixes} />}

          {pending &&
            (groups.length ? (
              <p role="status" className="wiki-updates-state">
                {t("Đang tải…", "Loading…")}
              </p>
            ) : (
              <div className="wiki-updates-skeleton" role="status">
                <span className="sr-only">{t("Đang tải…", "Loading…")}</span>
                <span />
                <span />
                <span />
              </div>
            ))}
          {failed && (
            <div role="status" className="wiki-updates-state">
              <p>{text("Chưa tải được hết ghi chú của bản cập nhật.", "Some notes could not be loaded.")}</p>
              <button
                type="button"
                onClick={() => results.forEach((result) => result.isError && void result.refetch())}
              >
                {t("Thử lại", "Retry")}
              </button>
            </div>
          )}
          {!pending && !failed && !groups.length && (
            <p role="status" className="wiki-updates-state wiki-mascot-state">
              {text(
                "Bản cập nhật này chưa có ghi chú gameplay được công bố.",
                "This update has no published gameplay notes yet.",
              )}
            </p>
          )}
        </div>
        {layout === "wide" && indexed && <PatchRail groups={groups} title={indexTitle} />}
      </div>
    </>
  )
}

export function PatchDetailPage() {
  const scope = useWikiContext()
  const { locale, href } = scope
  const t = localeText(locale)
  const { patchCode } = useParams()
  const releases = useQuery(patchReleasesQuery(scope))
  const release = releases.data?.find((item) => item.code === patchCode || item.id === patchCode)
  usePageHead(
    release
      ? patchMeta(release, locale)
      : releases.isSuccess
        ? notFoundMeta(locale, `/updates/${encodeURIComponent(patchCode ?? "")}`, "updates")
        : null,
  )

  return (
    <>
      {release ? (
        <PatchContent key={release.id} release={release} />
      ) : releases.isPending ? (
        <div className="wiki-updates-skeleton" role="status">
          <span className="sr-only">{t("Đang tải…", "Loading…")}</span>
          <span />
          <span />
          <span />
        </div>
      ) : releases.isError ? (
        <div role="status" className="wiki-updates-state">
          <p>{wikiText(locale, "Chưa tải được bản cập nhật.", "Could not load this update.")}</p>
          <button type="button" onClick={() => void releases.refetch()}>
            {t("Thử lại", "Retry")}
          </button>
        </div>
      ) : (
        <div role="status" className="wiki-updates-state wiki-mascot-state">
          <h1>{wikiText(locale, "Không tìm thấy bản cập nhật", "Update not found")}</h1>
          <Link to={href("/updates")}>{wikiText(locale, "Xem tất cả bản cập nhật", "See all updates")}</Link>
        </div>
      )}
    </>
  )
}
