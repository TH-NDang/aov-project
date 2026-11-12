import { useMemo, type ReactNode } from "react"
import { queryOptions, useQuery } from "@tanstack/react-query"
import { EntityReferenceIcon, EntityReferencePopover } from "@aov/ui/components/entity-rich-text"
import {
  createEntityIndex,
  referenceTranslation,
  type EntityKind,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import "./hero-builds.css"

interface PublicBuild {
  contentKey: string
  positions: number[]
  items: { slot: number; itemId: string; code: string | null }[]
  enchantments: { slot: number; enchantmentId: string; code: string | null }[]
  arcanaPageId: string | null
  arcana: { arcanaId: string; code: string | null; quantity: number }[]
  arcanaPageUse: { builds: number; heroes: number } | null
  spellId: string | null
  spellCode: string | null
}

interface BuildSource {
  captureId: string
  sourceKind: "PRO" | "HOT" | "SYSTEM"
  sourceLabel: string
  capturedAt: string
  sourceTimeZone: string
  patchCode: string | null
  result: "COLLECTED" | "NO_BUILDS" | "FAILED"
  builds: PublicBuild[]
}

interface HeroBuilds {
  heroId: string
  heroCode: string
  regionCode: string
  sources: BuildSource[]
}

export function heroBuildsQuery(heroCode: string, region: string) {
  return queryOptions({
    queryKey: ["wiki", "hero-builds", heroCode, region] as const,
    queryFn: async ({ signal }): Promise<HeroBuilds> => {
      const query = new URLSearchParams({ hero: heroCode, region })
      const response = await fetch(`/api/wiki/v1/builds?${query}`, { signal, credentials: "omit" })
      if (!response.ok) throw new Error("Recommended builds are unavailable.")
      return response.json()
    },
    staleTime: 300000,
    retry: false,
  })
}

const MARKETS: Record<string, [string, string]> = { VN: ["Việt Nam", "Vietnam"] }

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
  entities: Map<string, EntityReference>
  index: ReturnType<typeof createEntityIndex>
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

function BuildCard({
  build,
  number,
  entities,
  index,
}: {
  build: PublicBuild
  number: number
  entities: Map<string, EntityReference>
  index: ReturnType<typeof createEntityIndex>
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const spell = build.spellId ? entities.get(`spell:${build.spellId}`) : undefined
  const piece = (kind: EntityKind, id: string, round?: boolean, extra?: ReactNode) => (
    <Piece key={`${kind}:${id}`} kind={kind} id={id} entities={entities} index={index} round={round}>
      {extra}
    </Piece>
  )
  return (
    <article className="wiki-build-card">
      <header>
        <h3>{text(`Bộ ${number}`, `Build ${number}`)}</h3>
        {build.positions.length > 1 && (
          <span>
            {text(
              `${build.positions.length} người chơi pro cùng chọn`,
              `Chosen by ${build.positions.length} pro players`,
            )}
          </span>
        )}
      </header>
      <dl>
        <dt>{text("Trang bị (thứ tự lên đồ)", "Items (in buying order)")}</dt>
        <dd className="wiki-build-items">
          {build.items.map((item) =>
            piece("item", item.itemId, false, <span className="wiki-build-order">{item.slot}</span>),
          )}
        </dd>
        <dt>{text("Phù hiệu", "Enchantments")}</dt>
        <dd className="wiki-build-enchantments">
          {build.enchantments
            .filter((entry) => entry.slot <= 3)
            .map((entry) => piece("enchantment", entry.enchantmentId, true))}
          <span className="wiki-build-split" aria-hidden="true" />
          {build.enchantments
            .filter((entry) => entry.slot > 3)
            .map((entry) => piece("enchantment", entry.enchantmentId, true))}
        </dd>
        <dt>{text("Ngọc", "Arcana")}</dt>
        <dd>
          {build.arcana.length ? (
            build.arcana.map((entry) =>
              piece("arcana", entry.arcanaId, true, <span className="wiki-build-count">×{entry.quantity}</span>),
            )
          ) : (
            <span className="wiki-build-missing">{text("Chưa có bảng ngọc", "No arcana page yet")}</span>
          )}
        </dd>
        <dt>{text("Phụ trợ", "Spell")}</dt>
        <dd>
          {build.spellId && piece("spell", build.spellId, true)}
          {spell && <span>{referenceTranslation(spell, locale)?.name}</span>}
        </dd>
      </dl>
    </article>
  )
}

/**
 * The builds the game recommends for this hero, as last captured and confirmed (ADR-026). The section stays away when
 * nothing has been captured for the hero, so most pages are unchanged until captures cover them.
 */
export function HeroBuilds({ heroCode }: { heroCode: string }) {
  const scope = useWikiContext()
  const { locale, region } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
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
      <h2 id="wiki-hero-builds" className="wiki-night-title" tabIndex={-1}>
        {text("Build đề cử", "Recommended builds")}
      </h2>
      {sources.map((source) => {
        const code = builds.data!.regionCode
        const market = MARKETS[code] ?? [code, code]
        const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: source.sourceTimeZone }).format(
          new Date(source.capturedAt),
        )
        return (
          <div key={source.captureId} className="wiki-builds-source">
            <p className="wiki-builds-origin">
              {text(
                `${source.sourceLabel} trong game · máy chủ ${market[0]} · chụp ngày ${date}`,
                `In-game ${source.sourceLabel} · ${market[1]} server · captured ${date}`,
              )}
              {source.patchCode && ` · ${text("bản", "patch")} ${source.patchCode}`}
            </p>
            <div className="wiki-builds-list">
              {source.builds.map((build, position) => (
                <BuildCard
                  key={build.contentKey}
                  build={build}
                  number={position + 1}
                  entities={entities}
                  index={index}
                />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
