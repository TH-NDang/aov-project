import { createContext, Fragment, useContext, useMemo, useState, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext } from "../../context/wiki-context"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import {
  BLESSING_TIER_LABEL,
  encodeLineup,
  foldText,
  TRAIT_KIND_LABEL,
  type Blessing,
  type GuideContent,
  type ModeImage,
  type Trait,
  type Unit,
} from "./auto-chess-model"
import { BuilderTab, InsightsTab, LineupsTab } from "./auto-chess-lineups"
import type { PublicGuide } from "./mode-api"
import { GoldIcon } from "./gold-icon"
import { StarLevel } from "./star-level"
import { formatDay, ModeDialog } from "./mode-ui"

export const GUIDE_TABS = [
  { key: "tong-quan", label: "Tổng quan" },
  { key: "quan-co", label: "Quân cờ" },
  { key: "phe-nghe", label: "Phe & Nghề" },
  { key: "trang-bi", label: "Trang bị" },
  { key: "chuc-phuc", label: "Chúc phúc" },
  { key: "nhiem-vu", label: "Nhiệm vụ" },
  { key: "doi-hinh", label: "Đội hình" },
  { key: "xep-doi-hinh", label: "Xếp đội hình" },
  { key: "phan-tich", label: "Phân tích" },
] as const

export type GuideTab = (typeof GUIDE_TABS)[number]["key"]

const COST_COLOR: Record<number, string> = {
  1: "#9aa4b2",
  2: "#4fbf7a",
  3: "#4f9be0",
  4: "#b46cff",
  5: "#f2b440",
  6: "var(--aov-wiki-danger)",
}

export const costStyle = (cost: number) => ({ "--cost-color": COST_COLOR[cost] ?? "#9aa4b2" }) as CSSProperties

/** Look-ups shared by every tab of the guide. */
export interface GuideIndex {
  content: GuideContent
  images: Record<string, ModeImage>
  units: Map<string, Unit>
  traits: Map<string, Trait>
  items: Map<string, GuideContent["items"][number]>
  membersOf: (traitCode: string) => Unit[]
  image: (assetId?: string | null) => string | undefined
}

export function useGuideIndex(guide: PublicGuide): GuideIndex {
  return useMemo(() => {
    const { content, images } = guide
    const members = new Map<string, Unit[]>()
    for (const unit of content.units) {
      for (const trait of unit.traitCodes) members.set(trait, [...(members.get(trait) ?? []), unit])
    }
    for (const list of members.values()) list.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "vi"))
    return {
      content,
      images,
      units: new Map(content.units.map((unit) => [unit.code, unit])),
      traits: new Map(content.traits.map((trait) => [trait.code, trait])),
      items: new Map(content.items.map((item) => [item.code, item])),
      membersOf: (code) => members.get(code) ?? [],
      image: (assetId) => (assetId ? images[assetId]?.url : undefined),
    }
  }, [guide])
}

/** What guide text can point at, and where a trait tag leads. Empty outside a guide. */
const GuideLinks = createContext<{ entities: EntityReference[]; traitHref: (code: string) => string } | null>(null)

const plain = (value?: string | null) => (value ?? "").replace(/<[^>]+>/g, "")

/**
 * The guide's own traits, units and items as references, so a name in a description gets a card like a term does.
 * Each points at its place in the guide.
 */
function guideReferences(index: GuideIndex, modeCode: string, href: (path: string) => string): EntityReference[] {
  const base = `/modes/${encodeURIComponent(modeCode)}`
  const translation = (name: string, description: string) => [{ locale: "vi-VN", name, aliases: [], description }]
  return [
    ...index.content.traits.map((trait) => ({
      id: `guide-trait-${trait.code}`,
      kind: "term" as const,
      translations: translation(
        trait.name,
        [
          `${TRAIT_KIND_LABEL[trait.kind]} · ${index.membersOf(trait.code).length} quân cờ`,
          ...trait.tiers.map((tier) => `(${tier.count}) ${plain(tier.effect)}`),
        ].join("\n"),
      ),
      icon: index.image(trait.iconAssetId) ?? null,
      autoMatch: true,
      destinations: { wiki: href(`${base}/phe-nghe?trait=${encodeURIComponent(trait.code)}`) },
    })),
    ...index.content.units.map((unit) => ({
      id: `guide-unit-${unit.code}`,
      kind: "term" as const,
      translations: translation(
        unit.name,
        [
          `Quân cờ ${unit.cost} vàng · ${unit.traitCodes.map((code) => index.traits.get(code)?.name).join(", ")}`,
          unit.skill?.name ? `${unit.skill.name}: ${plain(unit.skill.description)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      icon: index.image(unit.portraitAssetId) ?? null,
      autoMatch: false,
      destinations: { wiki: href(`${base}/quan-co?unit=${encodeURIComponent(unit.code)}`) },
    })),
    ...index.content.items.map((item) => ({
      id: `guide-item-${item.code}`,
      kind: "term" as const,
      translations: translation(item.name, `Trang bị Cờ Liên quân · ${plain(item.effect)}`),
      icon: index.image(item.iconAssetId) ?? null,
      autoMatch: true,
      destinations: { wiki: href(`${base}/trang-bi`) },
    })),
  ]
}

/**
 * Guide text as the editor wrote it: colors, faded parts and references, with terms recognized the same way as in the
 * Admin preview, so what the editor sees is what the reader gets.
 */
export function GuideText({ text }: { text?: string | null }) {
  const scope = useWikiContext()
  const links = useContext(GuideLinks)
  const references = useQuery(wikiReferencesQuery(scope))
  const entities = useMemo(
    () => [...(links?.entities ?? []), ...(references.data?.entities ?? [])],
    [links, references.data],
  )
  if (!text) return null
  return (
    <EntityRichText
      text={text}
      entities={entities}
      locale={scope.locale}
      fallbackLocale={references.data?.fallbackLocale}
      autoRecognize={references.data?.autoRecognize ?? false}
      context="wiki"
    />
  )
}

/** The game's unit icon in a frame of its cost color, the way the game shows a unit's price. */
export function UnitPortrait({
  unit,
  index,
  size,
}: {
  unit: Unit
  index: GuideIndex
  size?: "xs" | "sm" | "md" | "lg"
}) {
  const src = index.image(unit.portraitAssetId)
  return (
    <span className="guide-portrait" data-size={size} style={costStyle(unit.cost)}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <b aria-hidden="true">{unit.name.slice(0, 2)}</b>
      )}
    </span>
  )
}

/** A trait's round icon. The game draws it on a dark square, so it is cropped to its circle. */
export function TraitIcon({ trait, index, size = 20 }: { trait?: Trait; index: GuideIndex; size?: number }) {
  const src = trait ? index.image(trait.iconAssetId) : undefined
  return src ? (
    <img className="guide-trait-icon" src={src} alt="" width={size} height={size} loading="lazy" />
  ) : (
    <span className="guide-trait-icon" style={{ width: size, height: size }} aria-hidden="true" />
  )
}

/** A unit's traits, factions first, then classes. */
export function splitTraits(unit: Unit, index: GuideIndex) {
  const traits = unit.traitCodes.map((code) => index.traits.get(code)).filter((trait): trait is Trait => !!trait)
  return {
    factions: traits.filter((trait) => trait.kind === "FACTION"),
    classes: traits.filter((trait) => trait.kind === "CLASS"),
  }
}

/** Factions and classes of a unit with a divider between them, as icons, names or tags. */
export function UnitTraits({ unit, index, as }: { unit: Unit; index: GuideIndex; as: "icons" | "names" | "tags" }) {
  const { factions, classes } = splitTraits(unit, index)
  const part = (traits: Trait[], kind: string) =>
    traits.length > 0 && (
      <span className="unit-trait-part" data-kind={kind}>
        {as === "names"
          ? traits.map((trait) => trait.name).join(", ")
          : traits.map((trait) =>
              as === "icons" ? (
                <span
                  key={trait.code}
                  className="trait-tip"
                  role="img"
                  aria-label={`${TRAIT_KIND_LABEL[trait.kind]}: ${trait.name}`}
                  data-tip={`${TRAIT_KIND_LABEL[trait.kind]}: ${trait.name}`}
                >
                  <TraitIcon trait={trait} index={index} size={20} />
                </span>
              ) : (
                <TraitTag key={trait.code} code={trait.code} index={index} />
              ),
            )}
      </span>
    )
  return (
    <span className="unit-traits" data-as={as}>
      {part(factions, "Phe")}
      {factions.length > 0 && classes.length > 0 && <i className="unit-trait-divider" aria-hidden="true" />}
      {part(classes, "Nghề")}
    </span>
  )
}

export function TraitTag({ code, index, count }: { code: string; index: GuideIndex; count?: number }) {
  const links = useContext(GuideLinks)
  const trait = index.traits.get(code)
  if (!trait) return null
  const body = (
    <>
      <TraitIcon trait={trait} index={index} size={18} />
      {count !== undefined && <b>{count}</b>}
      {trait.name}
    </>
  )
  return links ? (
    <Link
      className="guide-trait-tag"
      data-link="true"
      to={links.traitHref(trait.code)}
      title={`${TRAIT_KIND_LABEL[trait.kind]}: ${trait.name}`}
    >
      {body}
    </Link>
  ) : (
    <span className="guide-trait-tag" title={`${TRAIT_KIND_LABEL[trait.kind]}: ${trait.name}`}>
      {body}
    </span>
  )
}

/** The game's blessing cards: blue for the normal tier, purple for epic, bronze for legendary. */
export const TIER_STYLE: Record<Blessing["tier"], CSSProperties> = {
  NORMAL: { "--tier-color": "#4fb0ff", "--tier-bg": "linear-gradient(180deg, #1b3988, #2b5cc4)" } as CSSProperties,
  EPIC: { "--tier-color": "#e277ff", "--tier-bg": "linear-gradient(180deg, #491c7a, #7f3ca8)" } as CSSProperties,
  LEGENDARY: { "--tier-color": "#ffab45", "--tier-bg": "linear-gradient(180deg, #5a3110, #96591f)" } as CSSProperties,
}

/**
 * The game ships blessing icons as white drawings on black. Screen blending drops the black, so the drawing sits on
 * the card's own color like in the game.
 */
export function BlessingIcon({ blessing, index }: { blessing: Blessing; index: GuideIndex }) {
  const src = index.image(blessing.iconAssetId)
  return (
    <span className="blessing-icon" style={TIER_STYLE[blessing.tier]} aria-hidden="true">
      {src && <img src={src} alt="" loading="lazy" decoding="async" />}
    </span>
  )
}

export function AutoChessGuide({ code, tab, guide }: { code: string; tab: GuideTab; guide: PublicGuide }) {
  const index = useGuideIndex(guide)
  const { href } = useWikiContext()
  const links = useMemo(
    () => ({
      entities: guideReferences(index, code, href),
      traitHref: (traitCode: string) =>
        href(`/modes/${encodeURIComponent(code)}/phe-nghe?trait=${encodeURIComponent(traitCode)}`),
    }),
    [index, code, href],
  )
  const [params, setParams] = useSearchParams()
  const openUnit = params.get("unit")
  const selected = openUnit ? index.units.get(openUnit) : undefined
  const showUnit = (unitCode: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (unitCode) next.set("unit", unitCode)
        else next.delete("unit")
        return next
      },
      { preventScrollReset: true },
    )

  return (
    <GuideLinks.Provider value={links}>
      <p className="guide-edition">
        {guide.content.edition ?? "Bách khoa Cờ Liên quân"}
        {guide.content.observedOn && ` · ghi nhận ${formatDay(guide.content.observedOn)}`} · Dữ liệu và hình ảnh: Garena
        / Liên Quân Mobile
      </p>
      {tab === "quan-co" && <UnitsTab index={index} onOpen={showUnit} />}
      {tab === "phe-nghe" && <TraitsTab index={index} onOpen={showUnit} />}
      {tab === "trang-bi" && <ItemsTab index={index} />}
      {tab === "chuc-phuc" && <BlessingsTab index={index} />}
      {tab === "nhiem-vu" && <QuestsTab index={index} />}
      {tab === "doi-hinh" && <LineupsTab code={code} guide={guide} index={index} onOpen={showUnit} />}
      {tab === "xep-doi-hinh" && <BuilderTab code={code} index={index} onOpen={showUnit} />}
      {tab === "phan-tich" && <InsightsTab code={code} index={index} onOpen={showUnit} />}
      <ModeDialog open={!!selected} onClose={() => showUnit(null)} label={selected?.name ?? "Quân cờ"} title="Quân cờ">
        {selected && <UnitDetail unit={selected} index={index} code={code} onOpen={showUnit} />}
      </ModeDialog>
    </GuideLinks.Provider>
  )
}

type StatKey = "health" | "physicalAttack" | "armor" | "magicResistance"
const STATS: { key: StatKey; label: string }[] = [
  { key: "health", label: "Máu" },
  { key: "physicalAttack", label: "Công vật lý" },
  { key: "armor", label: "Giáp" },
  { key: "magicResistance", label: "Giáp phép" },
]
type SortKey = StatKey | "cost" | "name"
type SortRule = { key: SortKey; desc: boolean }
const SORT_LABEL: Record<SortKey, string> = {
  name: "Tên",
  cost: "Giá",
  ...(Object.fromEntries(STATS.map((stat) => [stat.key, stat.label])) as Record<StatKey, string>),
}
/** Stats read best from the highest; names and prices from the lowest. */
const naturalDesc = (key: SortKey) => key !== "cost" && key !== "name"

/** The price filter: one segmented bar, each price as the coin and its number in the price's color. */
export function CostChips({
  costs,
  value,
  onChange,
}: {
  costs: number[]
  value: number | null
  onChange: (cost: number | null) => void
}) {
  return (
    <div className="cost-bar" role="group" aria-label="Lọc theo giá">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}>
        Mọi giá
      </button>
      {costs.map((cost) => (
        <button
          key={cost}
          type="button"
          style={costStyle(cost)}
          aria-pressed={value === cost}
          aria-label={`${cost} vàng`}
          title={`${cost} vàng`}
          onClick={() => onChange(value === cost ? null : cost)}
        >
          <GoldIcon />
          <b>{cost}</b>
        </button>
      ))}
    </div>
  )
}

/**
 * Factions and classes as icons that toggle, each naming itself on hover with the units it would show. The chosen
 * ones are also spelled out underneath, since a phone cannot hover.
 */
export function TraitFilter({
  index,
  picked,
  onChange,
  countWith,
}: {
  index: GuideIndex
  picked: string[]
  onChange: (codes: string[]) => void
  countWith: (code: string) => number
}) {
  const toggle = (code: string) =>
    onChange(picked.includes(code) ? picked.filter((entry) => entry !== code) : [...picked, code])
  return (
    <div className="trait-filter" role="group" aria-label="Lọc theo Phe/Nghề">
      {(["FACTION", "CLASS"] as const).map((kind) => (
        <div key={kind} className="trait-filter-row">
          <span>{TRAIT_KIND_LABEL[kind]}</span>
          <div className="trait-filter-icons">
            {index.content.traits
              .filter((trait) => trait.kind === kind)
              .map((trait) => {
                const count = countWith(trait.code)
                const on = picked.includes(trait.code)
                const tip = `${TRAIT_KIND_LABEL[kind]}: ${trait.name} · ${count} quân`
                return (
                  <button
                    key={trait.code}
                    type="button"
                    className="trait-filter-icon trait-tip"
                    data-tip={tip}
                    aria-label={tip}
                    aria-pressed={on}
                    data-empty={!on && count === 0}
                    onClick={() => toggle(trait.code)}
                  >
                    <TraitIcon trait={trait} index={index} size={28} />
                  </button>
                )
              })}
          </div>
        </div>
      ))}
      {picked.length > 0 && (
        <div className="trait-filter-active">
          <span className="mode-meta">Đang lọc:</span>
          {picked.map((code) => {
            const trait = index.traits.get(code)
            return (
              <button
                key={code}
                type="button"
                className="mode-chip"
                aria-label={`Bỏ lọc ${trait?.name ?? code}`}
                onClick={() => toggle(code)}
              >
                <TraitIcon trait={trait} index={index} size={16} />
                {trait?.name ?? code} ✕
              </button>
            )
          })}
          <button type="button" className="mode-chip" onClick={() => onChange([])}>
            Bỏ lọc
          </button>
        </div>
      )}
    </div>
  )
}

function UnitsTab({ index, onOpen }: { index: GuideIndex; onOpen: (code: string) => void }) {
  const layout = usePageLayout()
  const [cost, setCost] = useState<number | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [view, setView] = useState<"cards" | "table">("cards")
  const [star, setStar] = useState(0)
  const [sorts, setSorts] = useState<SortRule[]>([{ key: "cost", desc: false }])
  const [multiSort, setMultiSort] = useState(false)
  const costs = [...new Set(index.content.units.map((unit) => unit.cost))].sort((a, b) => a - b)

  // Several factions or several classes widen the choice; a faction and a class narrow it to units with both.
  const pickedOf = (kind: Trait["kind"]) => picked.filter((code) => index.traits.get(code)?.kind === kind)
  const matchesKind = (unit: Unit, codes: string[]) =>
    !codes.length || codes.some((code) => unit.traitCodes.includes(code))
  const base = index.content.units.filter((unit) => !cost || unit.cost === cost)
  const units = base
    .filter((unit) => matchesKind(unit, pickedOf("FACTION")) && matchesKind(unit, pickedOf("CLASS")))
    .sort((a, b) => {
      const value = (unit: Unit, key: SortKey) =>
        key === "cost" ? unit.cost : key === "name" ? 0 : (unit.stats?.[key]?.[star] ?? -1)
      // The first rule decides; the next ones only break its ties.
      for (const rule of sorts) {
        const order = rule.key === "name" ? a.name.localeCompare(b.name, "vi") : value(a, rule.key) - value(b, rule.key)
        if (order) return rule.desc ? -order : order
      }
      return a.cost - b.cost || a.name.localeCompare(b.name, "vi")
    })
  /** A click sorts by that column alone; with the multi-column switch on, or Shift held, it adds the column as the next rule. */
  const sortBy = (key: SortKey, add: boolean) =>
    setSorts((current) => {
      const at = current.findIndex((rule) => rule.key === key)
      if (add || multiSort) {
        if (at < 0) return [...current, { key, desc: naturalDesc(key) }]
        return current.map((rule, index) => (index === at ? { ...rule, desc: !rule.desc } : rule))
      }
      if (current.length === 1 && at === 0) return [{ key, desc: !current[0].desc }]
      return [{ key, desc: naturalDesc(key) }]
    })
  const sortHead = (key: SortKey, label: string, className?: string) => {
    const at = sorts.findIndex((rule) => rule.key === key)
    const rule = sorts[at]
    return (
      <th scope="col" className={className} aria-sort={rule ? (rule.desc ? "descending" : "ascending") : "none"}>
        <button
          type="button"
          className="sort-head"
          data-active={!!rule}
          title="Bấm để sắp xếp, giữ Shift để thêm cột"
          onClick={(event) => sortBy(key, event.shiftKey)}
        >
          {label}
          <span className="sort-mark" aria-hidden="true">
            {rule ? (rule.desc ? "↓" : "↑") : "↕"}
          </span>
          {rule && sorts.length > 1 && <b className="sort-rank">{at + 1}</b>}
        </button>
      </th>
    )
  }
  const byCost = costs
    .map((value) => ({ cost: value, units: units.filter((unit) => unit.cost === value) }))
    .filter((group) => group.units.length)

  return (
    <section className="mode-stack" aria-label="Quân cờ">
      <div className="mode-filter-bar">
        <div className="mode-segment" role="group" aria-label="Kiểu xem">
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}>
            <WikiIcon name="cards" size={16} />
            Thẻ
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            <WikiIcon name="stats" size={16} />
            Chỉ số
          </button>
        </div>
      </div>
      <TraitFilter
        index={index}
        picked={picked}
        onChange={setPicked}
        countWith={(code) => {
          const kind = index.traits.get(code)?.kind
          const other = pickedOf(kind === "FACTION" ? "CLASS" : "FACTION")
          return base.filter((unit) => unit.traitCodes.includes(code) && matchesKind(unit, other)).length
        }}
      />
      <CostChips costs={costs} value={cost} onChange={setCost} />
      <p className="mode-meta">{units.length} quân cờ</p>

      {view === "cards" ? (
        byCost.map((group) => (
          <section key={group.cost} className="unit-group" style={costStyle(group.cost)}>
            <h2 className="unit-group-title">
              <span className="guide-cost" aria-label={`${group.cost} vàng`}>
                <GoldIcon size={16} />
                {group.cost}
              </span>
              <small>{group.units.length} quân</small>
            </h2>
            <div className="unit-grid" data-layout={layout}>
              {group.units.map((unit) => (
                <button
                  key={unit.code}
                  type="button"
                  className="unit-tile"
                  style={costStyle(unit.cost)}
                  onClick={() => onOpen(unit.code)}
                >
                  <UnitPortrait unit={unit} index={index} size={layout === "compact" ? "md" : "lg"} />
                  <strong>{unit.name}</strong>
                  <UnitTraits unit={unit} index={index} as="icons" />
                  {!unit.complete && <i className="unit-incomplete" title="Chưa đủ dữ liệu" />}
                </button>
              ))}
            </div>
          </section>
        ))
      ) : (
        <>
          <div className="sort-bar">
            <div className="mode-segment" role="group" aria-label="Cấp sao">
              {[0, 1, 2].map((value) => (
                <button key={value} type="button" aria-pressed={star === value} onClick={() => setStar(value)}>
                  <StarLevel level={value + 1} />
                </button>
              ))}
            </div>
            <div className="sort-rules" role="group" aria-label="Thứ tự sắp xếp">
              <span className="mode-meta">Sắp xếp:</span>
              {sorts.map((rule, at) => (
                <span key={rule.key} className="sort-rule">
                  <button
                    type="button"
                    aria-label={`${SORT_LABEL[rule.key]} ${rule.desc ? "giảm dần" : "tăng dần"}, bấm để đảo chiều`}
                    onClick={() =>
                      setSorts((current) =>
                        current.map((entry, index) => (index === at ? { ...entry, desc: !entry.desc } : entry)),
                      )
                    }
                  >
                    {sorts.length > 1 && <b className="sort-rank">{at + 1}</b>}
                    {SORT_LABEL[rule.key]} {rule.desc ? "↓" : "↑"}
                  </button>
                  {sorts.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Bỏ sắp xếp theo ${SORT_LABEL[rule.key]}`}
                      onClick={() => setSorts((current) => current.filter((_, index) => index !== at))}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              <button
                type="button"
                className="mode-chip"
                aria-pressed={multiSort}
                onClick={() => setMultiSort(!multiSort)}
              >
                <WikiIcon name="sort" size={16} />
                Nhiều cột
              </button>
            </div>
          </div>
          <p className="mode-meta">
            {multiSort
              ? "Bấm thêm tiêu đề cột để sắp xếp tiếp theo cột đó; bấm lại để đảo chiều."
              : layout === "compact"
                ? "Bấm tiêu đề cột để sắp xếp. Bật “Nhiều cột” để sắp xếp theo nhiều cột."
                : "Bấm tiêu đề cột để sắp xếp. Bật “Nhiều cột” hoặc giữ Shift khi bấm để sắp xếp theo nhiều cột."}
          </p>
          <div className="guide-table-wrap">
            <table className="guide-table">
              <thead>
                <tr>
                  {sortHead("name", "Quân cờ")}
                  {sortHead("cost", "Giá", "num")}
                  {STATS.map((stat) => (
                    <Fragment key={stat.key}>{sortHead(stat.key, stat.label, "num")}</Fragment>
                  ))}
                  <th scope="col">Phe/Nghề</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.code}>
                    <td>
                      <button type="button" className="guide-name-button" onClick={() => onOpen(unit.code)}>
                        <UnitPortrait unit={unit} index={index} size="sm" />
                        {unit.name}
                      </button>
                    </td>
                    <td className="num" style={costStyle(unit.cost)}>
                      <span className="guide-cost">{unit.cost}</span>
                    </td>
                    {STATS.map((stat) => (
                      <td key={stat.key} className="num">
                        {unit.stats?.[stat.key]?.[star]?.toLocaleString("vi-VN") ?? "—"}
                      </td>
                    ))}
                    <td>
                      <UnitTraits unit={unit} index={index} as="tags" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function UnitDetail({
  unit,
  index,
  code,
  onOpen,
}: {
  unit: Unit
  index: GuideIndex
  code: string
  onOpen: (code: string | null) => void
}) {
  const { href } = useWikiContext()
  const skillIcon = index.image(unit.skill?.iconAssetId)
  const lineups = index.content.lineups.filter((lineup) => lineup.units.some((item) => item.unitCode === unit.code))
  return (
    <article className="guide-detail">
      <header className="guide-detail-head" style={costStyle(unit.cost)}>
        <UnitPortrait unit={unit} index={index} size="lg" />
        <div>
          <h2>{unit.name}</h2>
          <span className="guide-cost" aria-label={`${unit.cost} vàng`}>
            <GoldIcon />
            {unit.cost}
          </span>
          <UnitTraits unit={unit} index={index} as="tags" />
        </div>
      </header>
      {!unit.complete && <p className="guide-note">Quân cờ này chưa có đủ dữ liệu trong bản Bách khoa đã thu thập.</p>}
      {unit.note && <p className="guide-note">{unit.note}</p>}
      {unit.skill?.name && (
        <section className="guide-skill">
          {skillIcon ? <img className="guide-icon" src={skillIcon} alt="" /> : <span />}
          <div>
            <h3>{unit.skill.name}</h3>
            {unit.skill.description && (
              <p>
                <GuideText text={unit.skill.description} />
              </p>
            )}
            {unit.skill.values.length === 3 && (
              <p className="guide-values">
                {unit.skill.valueLabel ?? "Giá trị"}: {unit.skill.values.join(" / ")}
              </p>
            )}
          </div>
        </section>
      )}
      {unit.stats && unit.stats.health.length === 3 && (
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Chỉ số</th>
                {[1, 2, 3].map((level) => (
                  <th key={level} scope="col" className="num">
                    <StarLevel level={level} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STATS.map((stat) => (
                <tr key={stat.key}>
                  <th scope="row">{stat.label}</th>
                  {(unit.stats?.[stat.key] ?? []).map((value, at) => (
                    <td key={at} className="num">
                      {value.toLocaleString("vi-VN")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {unit.traitCodes.map((traitCode) => {
        const trait = index.traits.get(traitCode)
        if (!trait) return null
        return (
          <section key={traitCode} className="guide-detail-trait">
            <h3>
              <TraitIcon trait={trait} index={index} size={24} />
              {TRAIT_KIND_LABEL[trait.kind]}: {trait.name}
            </h3>
            <TierList trait={trait} />
            <div className="guide-members">
              {index.membersOf(traitCode).map((member) => (
                <button
                  key={member.code}
                  type="button"
                  title={member.name}
                  aria-current={member.code === unit.code || undefined}
                  onClick={() => onOpen(member.code)}
                >
                  <UnitPortrait unit={member} index={index} size="sm" />
                </button>
              ))}
            </div>
          </section>
        )
      })}
      {lineups.length > 0 && (
        <p className="mode-meta">Có trong đội hình đề xuất: {lineups.map((lineup) => lineup.name).join(", ")}</p>
      )}
      <div className="lineup-actions">
        <Link
          className="mode-chip"
          data-tone="accent"
          to={href(
            `/modes/${encodeURIComponent(code)}/xep-doi-hinh?${encodeLineup([{ unitCode: unit.code, carry: true }], [])}`,
          )}
        >
          Xếp đội hình với {unit.name}
        </Link>
        {unit.heroCode && (
          <Link className="mode-chip" to={href(`/hero/${unit.heroCode}`)}>
            Trang tướng {unit.name}
          </Link>
        )}
      </div>
    </article>
  )
}

/** Numbers in a plain effect stand out like in the game. Text that already carries markup stays as written. */
function emphasizeNumbers(text?: string | null) {
  if (!text || /[<[{]/.test(text)) return text
  return text.replace(/[+\-−]?\d+(?:[.,]\d+)?%?/g, "<b>$&</b>")
}

/** Tiers as the game draws them: the count in a ring that fills one step per tier. */
export function TierList({ trait, count }: { trait: Trait; count?: number }) {
  return (
    <div className="guide-tiers">
      {trait.tiers.map((tier, at) => (
        <p
          key={tier.count}
          className="guide-tier"
          data-reached={count !== undefined && count >= tier.count}
          style={{ "--tier-progress": (at + 1) / trait.tiers.length } as CSSProperties}
        >
          <b>{tier.count}</b>
          <span>
            <GuideText text={emphasizeNumbers(tier.effect)} />
          </span>
        </p>
      ))}
    </div>
  )
}

const TRAIT_KINDS = ["FACTION", "CLASS"] as const

/**
 * The traits tab like the game's interaction screen: every trait as an icon, the chosen one in full beside the list (in a
 * drawer on phones), plus the game's table of units by faction and class. The choice lives in the address.
 */
function TraitsTab({ index, onOpen }: { index: GuideIndex; onOpen: (code: string) => void }) {
  const layout = usePageLayout()
  const [params, setParams] = useSearchParams()
  const [kind, setKind] = useState<Trait["kind"] | null>(null)
  const table = params.get("xem") === "bang"
  const visible = index.content.traits.filter((trait) => !kind || trait.kind === kind)
  const linked = index.traits.get(params.get("trait") ?? "")
  const selected = linked ?? (layout === "wide" ? (visible[0] ?? index.content.traits[0]) : undefined)
  const change = (apply: (next: URLSearchParams) => void) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        apply(next)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  const pick = (code: string | null) =>
    change((next) => {
      // On wide screens the detail sits beside the list, so picking from the table goes back to it.
      if (code && layout === "wide") next.delete("xem")
      if (code) next.set("trait", code)
      else next.delete("trait")
    })

  return (
    <section className="mode-stack" aria-label="Phe và Nghề">
      <div className="mode-filter-bar">
        {!table && (
          <>
            <div className="mode-segment" role="group" aria-label="Loại">
              <button type="button" aria-pressed={kind === null} onClick={() => setKind(null)}>
                Tất cả
              </button>
              {TRAIT_KINDS.map((value) => (
                <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>
                  {TRAIT_KIND_LABEL[value]}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="mode-segment trait-view" role="group" aria-label="Cách xem">
          <button
            type="button"
            aria-label="Chi tiết"
            aria-pressed={!table}
            onClick={() => change((next) => next.delete("xem"))}
          >
            <WikiIcon name="detail" size={16} />
            <span className="segment-label">Chi tiết</span>
          </button>
          <button
            type="button"
            aria-label="Bảng Phe × Nghề"
            aria-pressed={table}
            onClick={() => change((next) => next.set("xem", "bang"))}
          >
            <WikiIcon name="table" size={16} />
            <span className="segment-label">Bảng Phe × Nghề</span>
          </button>
        </div>
      </div>
      {table ? (
        <TraitTable index={index} onOpen={onOpen} onPick={pick} />
      ) : (
        <div className="trait-browser">
          <div className="trait-index">
            {TRAIT_KINDS.map((value) => {
              const traits = visible.filter((trait) => trait.kind === value)
              if (!traits.length) return null
              return (
                <section key={value} className="trait-index-group" aria-label={TRAIT_KIND_LABEL[value]}>
                  <h2 className="mode-section-title">
                    {TRAIT_KIND_LABEL[value]} <small>{traits.length}</small>
                  </h2>
                  <div className="trait-index-grid">
                    {traits.map((trait) => (
                      <button
                        key={trait.code}
                        type="button"
                        className="trait-index-item"
                        aria-pressed={selected?.code === trait.code}
                        onClick={() => pick(trait.code)}
                      >
                        <TraitIcon trait={trait} index={index} size={layout === "compact" ? 40 : 44} />
                        <span>{trait.name}</span>
                        <small>
                          {index.membersOf(trait.code).length} quân
                          <span className="trait-index-tiers">
                            {" "}
                            · {trait.tiers.map((tier) => tier.count).join("/")}
                          </span>
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
          {layout === "wide" && selected && <TraitDetail trait={selected} index={index} onOpen={onOpen} />}
        </div>
      )}
      {layout === "compact" && (
        <ModeDialog open={!!linked} onClose={() => pick(null)} label={linked?.name ?? "Phe/Nghề"} title="Phe & Nghề">
          {linked && <TraitDetail trait={linked} index={index} onOpen={onOpen} />}
        </ModeDialog>
      )}
    </section>
  )
}

/** One trait in full: its tiers, the units that carry it and the traits those units bring along. */
function TraitDetail({ trait, index, onOpen }: { trait: Trait; index: GuideIndex; onOpen: (code: string) => void }) {
  const members = [...index.membersOf(trait.code)].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "vi"))
  const partners = new Map<string, number>()
  for (const member of members)
    for (const code of member.traitCodes) if (code !== trait.code) partners.set(code, (partners.get(code) ?? 0) + 1)
  const together = [...partners].sort((a, b) => b[1] - a[1])
  return (
    <article className="trait-detail" aria-label={`${TRAIT_KIND_LABEL[trait.kind]} ${trait.name}`}>
      <header className="trait-detail-head">
        <TraitIcon trait={trait} index={index} size={64} />
        <div>
          <span className="mode-meta">{TRAIT_KIND_LABEL[trait.kind]}</span>
          <h2>{trait.name}</h2>
          <span className="mode-meta">
            {members.length} quân cờ · mốc {trait.tiers.map((tier) => tier.count).join(" / ")}
          </span>
        </div>
      </header>
      {trait.description && (
        <p className="mode-prose">
          <GuideText text={trait.description} />
        </p>
      )}
      <TierList trait={trait} />
      {trait.note && <p className="guide-note">{trait.note}</p>}
      <section className="trait-detail-block" aria-label="Quân cờ liên quan">
        <h3>Quân cờ liên quan</h3>
        {members.length ? (
          <div className="trait-members">
            {members.map((member) => (
              <button
                key={member.code}
                type="button"
                className="trait-member"
                style={costStyle(member.cost)}
                onClick={() => onOpen(member.code)}
              >
                <UnitPortrait unit={member} index={index} size="md" />
                <span>{member.name}</span>
                <small className="guide-cost" aria-label={`${member.cost} vàng`}>
                  <GoldIcon size={12} />
                  {member.cost}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="mode-meta">Chưa có quân cờ trong bản đã thu thập.</p>
        )}
      </section>
      {together.length > 0 && (
        <section className="trait-detail-block" aria-label="Hay đi cùng">
          <h3>Hay đi cùng</h3>
          <div className="guide-trait-tags">
            {together.map(([code, count]) => (
              <TraitTag key={code} code={code} index={index} count={count} />
            ))}
          </div>
          <p className="mode-meta">Số là số quân cờ có cả hai Phe/Nghề.</p>
        </section>
      )}
    </article>
  )
}

/** The game's table: classes down, factions across, each unit where its two traits meet. */
function TraitTable({
  index,
  onOpen,
  onPick,
}: {
  index: GuideIndex
  onOpen: (code: string) => void
  onPick: (code: string) => void
}) {
  const factions = index.content.traits.filter((trait) => trait.kind === "FACTION")
  const classes = index.content.traits.filter((trait) => trait.kind === "CLASS")
  const head = (trait: Trait) => (
    <button type="button" title={`${TRAIT_KIND_LABEL[trait.kind]}: ${trait.name}`} onClick={() => onPick(trait.code)}>
      <TraitIcon trait={trait} index={index} size={30} />
      <span>{trait.name}</span>
    </button>
  )
  return (
    <>
      <p className="mode-meta">Hàng là Nghề, cột là Phe. Bấm icon để xem Phe/Nghề, bấm quân cờ để xem quân cờ.</p>
      <div className="trait-table-scroll" role="region" aria-label="Bảng Phe × Nghề" tabIndex={0}>
        <table className="trait-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="mode-meta">Nghề \ Phe</span>
              </th>
              {factions.map((trait) => (
                <th key={trait.code} scope="col">
                  {head(trait)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((row) => (
              <tr key={row.code}>
                <th scope="row">{head(row)}</th>
                {factions.map((column) => (
                  <td key={column.code}>
                    {index
                      .membersOf(row.code)
                      .filter((unit) => unit.traitCodes.includes(column.code))
                      .map((unit) => (
                        <button
                          key={unit.code}
                          type="button"
                          title={`${unit.name} · ${unit.cost} vàng`}
                          aria-label={unit.name}
                          onClick={() => onOpen(unit.code)}
                        >
                          <UnitPortrait unit={unit} index={index} size="xs" />
                        </button>
                      ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** The game sorts items by the color of their stone (yellow-green, blue, gold, red); the group name says which. */
function stoneColor(code: string, name: string) {
  const key = foldText(`${code} ${name}`)
  // "xanh lam" contains "xanh la", so blue is checked first.
  if (key.includes("xanh lam") || key.includes("xanh duong")) return "#3fa2f0"
  if (key.includes("xanh la")) return "#a9c63b"
  if (key.includes("vang")) return "#f0b232"
  if (key.includes("do")) return "#e2474b"
  return "#9aa4b2"
}

/** The stone of an item group: its picture when there is one, else a diamond in its color. */
function StoneMark({
  group,
  index,
  size = 24,
}: {
  group: { iconAssetId?: string | null }
  index: GuideIndex
  size?: number
}) {
  const src = index.image(group.iconAssetId)
  return src ? (
    <img className="item-stone-icon" src={src} alt="" width={size} height={size} />
  ) : (
    <i className="item-stone" aria-hidden="true" />
  )
}

function ItemsTab({ index }: { index: GuideIndex }) {
  const { itemGroups, items } = index.content
  const [stone, setStone] = useState<string | null>(null)
  const groups: { code: string; name: string; iconAssetId?: string | null }[] = [
    ...itemGroups,
    ...(items.some((item) => !item.groupCode) ? [{ code: "", name: "Khác" }] : []),
  ]
  const entriesOf = (code: string) =>
    items.filter((item) => (item.groupCode ?? "") === code).sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99))
  // A chip drops the group words and keeps the stone color: "Xanh la" style names.
  const shortName = (name: string) => {
    const short = name.replace(/^nhóm\s+/iu, "").replace(/^đá\s+/iu, "")
    return short.charAt(0).toLocaleUpperCase("vi") + short.slice(1)
  }
  return (
    <section className="mode-stack" aria-label="Trang bị">
      <div className="mode-chip-row" role="group" aria-label="Nhóm trang bị">
        <button type="button" className="mode-chip" aria-pressed={stone === null} onClick={() => setStone(null)}>
          Tất cả <span className="tier-count">{items.length}</span>
        </button>
        {groups.map((group) => (
          <button
            key={group.code}
            type="button"
            className="mode-chip stone-chip"
            style={{ "--stone-color": stoneColor(group.code, group.name) } as CSSProperties}
            aria-pressed={stone === group.code}
            onClick={() => setStone(stone === group.code ? null : group.code)}
          >
            <StoneMark group={group} index={index} size={20} />
            {shortName(group.name)}
            <span className="tier-count">{entriesOf(group.code).length}</span>
          </button>
        ))}
      </div>
      {groups
        .filter((group) => stone === null || group.code === stone)
        .map((group) => {
          const entries = entriesOf(group.code)
          return (
            <section
              key={group.code}
              className="item-group"
              style={{ "--stone-color": stoneColor(group.code, group.name) } as CSSProperties}
            >
              <h2 className="mode-section-title">
                <StoneMark group={group} index={index} />
                {group.name}
                <small>{entries.length} trang bị</small>
              </h2>
              {entries.length ? (
                <div className="guide-card-list">
                  {entries.map((item) => {
                    const icon = index.image(item.iconAssetId)
                    return (
                      <article key={item.code} className="guide-card item-card">
                        {icon ? <img className="guide-icon" src={icon} alt="" loading="lazy" /> : <span />}
                        <div>
                          <h3>{item.name}</h3>
                          {item.effect && (
                            <p>
                              <GuideText text={item.effect} />
                            </p>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <p className="guide-slots">Chưa có trang bị nào của nhóm này trong bản đã thu thập.</p>
              )}
            </section>
          )
        })}
    </section>
  )
}

const BLESSING_TIERS = ["NORMAL", "EPIC", "LEGENDARY"] as const

/**
 * A mark per blessing tier, drawn in the tier's color: a gem for the normal tier, a crest for epic, a crown for
 * legendary, so the tier reads before its name.
 */
export function TierIcon({ tier, size = 18 }: { tier: Blessing["tier"]; size?: number }) {
  return (
    <svg
      className="tier-icon"
      style={TIER_STYLE[tier]}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      {tier === "NORMAL" && (
        <>
          <path d="M10 2.2 16.6 8 10 17.8 3.4 8Z" fill="currentColor" />
          <path d="M3.4 8h13.2M7 8l3 9.8L13 8m-6 0 3-5.8L13 8" fill="none" stroke="#fff" strokeOpacity=".55" />
        </>
      )}
      {tier === "EPIC" && (
        <>
          <path d="M10 1.8 16.8 5.6v8.8L10 18.2 3.2 14.4V5.6Z" fill="currentColor" />
          <path
            d="m10 5.4 1.3 3.1 3.3.3-2.5 2.2.8 3.3L10 12.6l-2.9 1.7.8-3.3-2.5-2.2 3.3-.3Z"
            fill="#fff"
            fillOpacity=".85"
          />
        </>
      )}
      {tier === "LEGENDARY" && (
        <>
          <path d="M2.6 6.4 6.6 9.6 10 3.4l3.4 6.2 4-3.2-1.6 9H4.2Z" fill="currentColor" />
          <path d="M4.2 17.4h11.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="11.6" r="1.6" fill="#fff" fillOpacity=".85" />
        </>
      )}
    </svg>
  )
}

function BlessingsTab({ index }: { index: GuideIndex }) {
  const [tier, setTier] = useState<Blessing["tier"] | null>(null)
  const [search, setSearch] = useState("")
  const needle = foldText(search.trim())
  const matches = (blessing: Blessing) =>
    !needle || foldText(`${blessing.name} ${blessing.description ?? ""}`).includes(needle)
  const sections = BLESSING_TIERS.filter((value) => !tier || tier === value)
    .map((value) => ({
      tier: value,
      blessings: index.content.blessings.filter((blessing) => blessing.tier === value && matches(blessing)),
    }))
    .filter((section) => section.blessings.length)
  return (
    <section className="mode-stack" aria-label="Chúc phúc">
      <div className="mode-filter-bar">
        <input
          className="mode-search"
          type="search"
          placeholder="Tìm chúc phúc…"
          aria-label="Tìm chúc phúc"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="mode-chip-row" role="group" aria-label="Bậc chúc phúc">
        <button type="button" className="mode-chip" aria-pressed={tier === null} onClick={() => setTier(null)}>
          Tất cả <span className="tier-count">{index.content.blessings.length}</span>
        </button>
        {BLESSING_TIERS.map((value) => (
          <button
            key={value}
            type="button"
            className="mode-chip tier-chip"
            style={TIER_STYLE[value]}
            data-tier={value}
            aria-pressed={tier === value}
            onClick={() => setTier(tier === value ? null : value)}
          >
            <TierIcon tier={value} />
            {BLESSING_TIER_LABEL[value]}
            <span className="tier-count">{index.content.blessings.filter((b) => b.tier === value).length}</span>
          </button>
        ))}
      </div>
      {sections.map((section) => (
        <section key={section.tier} className="blessing-section" style={TIER_STYLE[section.tier]}>
          <h2 className="blessing-section-title">
            <TierIcon tier={section.tier} size={22} />
            {BLESSING_TIER_LABEL[section.tier]}
            <small>{section.blessings.length} chúc phúc</small>
          </h2>
          <div className="blessing-list">
            {section.blessings.map((blessing) => (
              <article key={blessing.code} className="blessing-card" style={TIER_STYLE[blessing.tier]}>
                <BlessingIcon blessing={blessing} index={index} />
                <div>
                  <h3>{blessing.name}</h3>
                  {blessing.description && (
                    <p>
                      <GuideText text={blessing.description} />
                    </p>
                  )}
                </div>
                <span className="blessing-tier-mark" title={BLESSING_TIER_LABEL[blessing.tier]}>
                  <TierIcon tier={blessing.tier} size={16} />
                </span>
              </article>
            ))}
          </div>
        </section>
      ))}
      {!sections.length && <p className="mode-empty">Không có chúc phúc khớp tìm kiếm.</p>}
    </section>
  )
}

function QuestsTab({ index }: { index: GuideIndex }) {
  return (
    <section className="mode-stack" aria-label="Nhiệm vụ">
      <p className="mode-lead">Nhiệm vụ trong trận và phần thưởng khi hoàn thành.</p>
      <ol className="quest-list">
        {index.content.quests.map((quest) => (
          <li key={quest.code}>
            <p>{quest.task}</p>
            <span className="quest-reward">{quest.reward ?? "Chưa ghi phần thưởng"}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
