import { useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { EntityReferenceIcon, EntityReferencePopover } from "@aov/ui/components/entity-rich-text"
import { LocalTime } from "@aov/ui/components/local-time"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import {
  createEntityIndex,
  referenceTranslation,
  type EntityKind,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, wikiText, useWikiText } from "../../../context/wiki-context"
import { wikiReferencesQuery } from "../../../lib/wiki-references"
import { PatchName } from "../../../components/hero-patch-name"
import { heroBuildsQuery, type BuildSource, type PublicBuild } from "../../../lib/hero-api"
import { marketName } from "@aov/ui/lib/locale-text"
import "./hero-builds.css"

const CAPTURE_DAY: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }

type Entities = Map<string, EntityReference>
type EntityIndex = ReturnType<typeof createEntityIndex>

/** One item, enchantment, arcana or spell: its icon opens the same card as a mention in Wiki text. */
function Piece({
  kind,
  id,
  entities,
  index,
  round,
  children,
}: {
  kind: EntityKind
  id: string
  entities: Entities
  index: EntityIndex
  round?: boolean
  children?: ReactNode
}) {
  const { locale } = useWikiContext()
  const entity = entities.get(`${kind}:${id}`)
  const name = entity ? (referenceTranslation(entity, locale)?.name ?? "") : ""
  const icon = (
    <span className="wiki-build-piece" data-round={round || undefined}>
      {entity ? (
        <EntityReferenceIcon entity={entity} className="wiki-build-icon" />
      ) : (
        <span className="wiki-build-icon wiki-build-unknown" aria-hidden="true" />
      )}
      {children}
    </span>
  )
  if (!entity) return icon
  return (
    <EntityReferencePopover entity={entity} locale={locale} context="wiki" index={index} label={name}>
      <button type="button" className="wiki-build-trigger" aria-label={name}>
        {icon}
      </button>
    </EntityReferencePopover>
  )
}

/** What a build is made of, named once: above the first build when they line up in columns, on each build otherwise. */
function useBuildLabels() {
  const { locale } = useWikiContext()
  return {
    items: wikiText(locale, "Trang bị theo thứ tự lên đồ", "Items in buying order"),
    enchantments: wikiText(locale, "Phù hiệu", "Enchantments"),
    arcana: wikiText(locale, "Ngọc", "Arcana"),
    spell: wikiText(locale, "Phụ trợ", "Talent"),
  }
}

function BuildRow({
  build,
  number,
  withArcana,
  entities,
  index,
}: {
  build: PublicBuild
  number: number
  /** Whether the list has a column for arcana at all. */
  withArcana: boolean
  entities: Entities
  index: EntityIndex
}) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  const labels = useBuildLabels()
  const spell = build.spellId ? entities.get(`spell:${build.spellId}`) : undefined
  const piece = (kind: EntityKind, id: string, round?: boolean, extra?: ReactNode) => (
    <Piece key={`${kind}:${id}`} kind={kind} id={id} entities={entities} index={index} round={round}>
      {extra}
    </Piece>
  )
  return (
    <li className="wiki-build">
      <div className="wiki-build-name">
        <h3>{text(`Bộ ${number}`, `Build ${number}`)}</h3>
        {build.positions.length > 1 && (
          <span>
            {text(
              `${build.positions.length} người chơi pro cùng chọn`,
              `Chosen by ${build.positions.length} pro players`,
            )}
          </span>
        )}
      </div>
      <dl>
        <div data-part="items">
          <dt>{labels.items}</dt>
          <dd>
            {build.items.map((item) =>
              piece("item", item.itemId, false, <span className="wiki-build-order">{item.slot}</span>),
            )}
          </dd>
        </div>
        <div data-part="enchantments">
          <dt>{labels.enchantments}</dt>
          <dd>
            {build.enchantments
              .filter((entry) => entry.slot <= 3)
              .map((entry) => piece("enchantment", entry.enchantmentId, true))}
            <span className="wiki-build-split" aria-hidden="true" />
            {build.enchantments
              .filter((entry) => entry.slot > 3)
              .map((entry) => piece("enchantment", entry.enchantmentId, true))}
          </dd>
        </div>
        {withArcana && (
          <div data-part="arcana">
            <dt>{labels.arcana}</dt>
            <dd>
              {build.arcana.length ? (
                build.arcana.map((entry) =>
                  piece("arcana", entry.arcanaId, true, <span className="wiki-build-count">×{entry.quantity}</span>),
                )
              ) : (
                <span className="wiki-build-missing">{text("Chưa có bảng ngọc", "No arcana page yet")}</span>
              )}
            </dd>
          </div>
        )}
        <div data-part="spell">
          <dt>{labels.spell}</dt>
          <dd>
            {build.spellId && piece("spell", build.spellId, true)}
            {spell && <span>{referenceTranslation(spell, locale)?.name}</span>}
          </dd>
        </div>
      </dl>
    </li>
  )
}

/** The builds of one tab of the game's recommendations, with where and when they were read. */
function BuildSourceBlock({
  source,
  regionCode,
  entities,
  index,
}: {
  source: BuildSource
  regionCode: string
  entities: Entities
  index: EntityIndex
}) {
  const { locale, options } = useWikiContext()
  const text = useWikiText()
  const labels = useBuildLabels()
  const market = [marketName(regionCode, "vi-VN"), marketName(regionCode, "en-US")]
  const patch = options?.patches.find((item) => item.code === source.patchCode)
  // A phone starts from the first build, the one the game lists first; the rest open on request.
  const limit = usePageLayout() === "compact" ? 1 : source.builds.length
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? source.builds : source.builds.slice(0, limit)
  const withArcana = source.builds.some((build) => build.arcana.length > 0)
  const hidden = source.builds.length - limit

  return (
    <div className="wiki-builds-source">
      <p className="wiki-builds-origin">
        {text(
          `${source.sourceLabel} trong game · máy chủ ${market[0]} · chụp ngày `,
          `In-game ${source.sourceLabel} · ${market[1]} server · captured `,
        )}
        <LocalTime
          value={source.capturedAt}
          sourceTimeZone={source.sourceTimeZone}
          format={CAPTURE_DAY}
          locale={locale}
        />
        {source.patchCode && (
          <>
            {` · ${text("bản", "version")} `}
            {patch ? <PatchName patch={patch} /> : source.patchCode}
          </>
        )}
        {/* Said once for the whole list instead of on every build. */}
        {!withArcana && ` · ${text("chưa ghi nhận bảng ngọc", "arcana pages not recorded yet")}`}
      </p>
      <ol className="wiki-build-list" data-arcana={withArcana || undefined}>
        {/* The column names when the builds line up as rows; each build still names its own parts for assistive technology. */}
        <li className="wiki-build-columns" aria-hidden="true">
          <span />
          <span>{labels.items}</span>
          <span>{labels.enchantments}</span>
          <span>{labels.spell}</span>
        </li>
        {shown.map((build, position) => (
          <BuildRow
            key={build.contentKey}
            build={build}
            number={position + 1}
            withArcana={withArcana}
            entities={entities}
            index={index}
          />
        ))}
      </ol>
      {hidden > 0 && (
        <button
          type="button"
          className="wiki-hero-more"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <WikiIcon name="chevron" size={16} />
          {expanded ? text("Thu gọn", "Show less") : text(`Xem thêm ${hidden} bộ`, `Show ${hidden} more`)}
        </button>
      )}
    </div>
  )
}

/**
 * The builds the game recommends for this hero, as last captured and confirmed (ADR-026). The section stays away when
 * nothing has been captured for the hero, so most pages are unchanged until captures cover them.
 */
export function HeroBuilds({ heroCode }: { heroCode: string }) {
  const scope = useWikiContext()
  const { locale, region } = scope
  const builds = useQuery(heroBuildsQuery(heroCode, region))
  const references = useQuery(wikiReferencesQuery(scope))
  const settings = references.data
  const entities = useMemo(
    () => new Map((settings?.entities ?? []).map((entity) => [`${entity.kind}:${entity.id}`, entity])),
    [settings],
  )
  const index = useMemo(
    () => createEntityIndex(settings?.entities ?? [], locale, settings?.fallbackLocale ?? "vi-VN"),
    [settings, locale],
  )
  const sources = (builds.data?.sources ?? []).filter((source) => source.builds.length > 0)
  if (!sources.length) return null

  return (
    <section className="wiki-builds" aria-labelledby="wiki-hero-builds">
      <header className="wiki-hero-section-head">
        <h2 id="wiki-hero-builds" tabIndex={-1}>
          {wikiText(locale, "Build đề cử", "Recommended builds")}
          <small>{sources.reduce((total, source) => total + source.builds.length, 0)}</small>
        </h2>
      </header>
      {sources.map((source) => (
        <BuildSourceBlock
          key={source.captureId}
          source={source}
          regionCode={builds.data!.regionCode}
          entities={entities}
          index={index}
        />
      ))}
    </section>
  )
}
