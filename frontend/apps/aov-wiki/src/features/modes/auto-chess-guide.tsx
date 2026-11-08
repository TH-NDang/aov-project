import { useMemo, useState, type CSSProperties } from "react"
import { Link, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext } from "../../context/wiki-context"
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

/** The game's unit icon in a frame of its cost color, the way the game shows a unit's price. */
export function UnitPortrait({ unit, index, size }: { unit: Unit; index: GuideIndex; size?: "sm" | "md" | "lg" }) {
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

export function TraitTag({ code, index, count }: { code: string; index: GuideIndex; count?: number }) {
  const trait = index.traits.get(code)
  if (!trait) return null
  return (
    <span className="guide-trait-tag" title={`${TRAIT_KIND_LABEL[trait.kind]}: ${trait.name}`}>
      <TraitIcon trait={trait} index={index} size={18} />
      {count !== undefined && <b>{count}</b>}
      {trait.name}
    </span>
  )
}

const TIER_STYLE: Record<Blessing["tier"], CSSProperties> = {
  NORMAL: { "--tier-color": "#7d8aa0" } as CSSProperties,
  EPIC: { "--tier-color": "#b46cff" } as CSSProperties,
  LEGENDARY: { "--tier-color": "#f2b440" } as CSSProperties,
}

/**
 * The game ships blessing icons as white drawings on black. Screen blending turns the black into the tier color, so the
 * icon reads as a colored badge instead of a black square.
 */
function BlessingIcon({ blessing, index }: { blessing: Blessing; index: GuideIndex }) {
  const src = index.image(blessing.iconAssetId)
  return (
    <span className="blessing-icon" style={TIER_STYLE[blessing.tier]} aria-hidden="true">
      {src && <img src={src} alt="" loading="lazy" decoding="async" />}
    </span>
  )
}

export function AutoChessGuide({ code, tab, guide }: { code: string; tab: GuideTab; guide: PublicGuide }) {
  const index = useGuideIndex(guide)
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
    <>
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
      <ModeDialog open={!!selected} onClose={() => showUnit(null)} label={selected?.name ?? "Quân cờ"}>
        {selected && <UnitDetail unit={selected} index={index} code={code} onOpen={showUnit} />}
      </ModeDialog>
    </>
  )
}

type StatKey = "health" | "physicalAttack" | "armor" | "magicResistance"
const STATS: { key: StatKey; label: string }[] = [
  { key: "health", label: "Máu" },
  { key: "physicalAttack", label: "Công vật lý" },
  { key: "armor", label: "Giáp" },
  { key: "magicResistance", label: "Giáp phép" },
]

function CostChips({
  costs,
  value,
  onChange,
}: {
  costs: number[]
  value: number | null
  onChange: (cost: number | null) => void
}) {
  return (
    <div className="mode-chip-row" role="group" aria-label="Lọc theo giá">
      <button type="button" className="mode-chip" aria-pressed={value === null} onClick={() => onChange(null)}>
        Mọi giá
      </button>
      {costs.map((cost) => (
        <button
          key={cost}
          type="button"
          className="mode-chip"
          style={costStyle(cost)}
          aria-pressed={value === cost}
          onClick={() => onChange(value === cost ? null : cost)}
        >
          <span className="guide-cost">{cost} vàng</span>
        </button>
      ))}
    </div>
  )
}

function UnitsTab({ index, onOpen }: { index: GuideIndex; onOpen: (code: string) => void }) {
  const layout = usePageLayout()
  const [search, setSearch] = useState("")
  const [cost, setCost] = useState<number | null>(null)
  const [trait, setTrait] = useState<string | null>(null)
  const [view, setView] = useState<"cards" | "table">("cards")
  const [star, setStar] = useState(0)
  const [sort, setSort] = useState<{ key: StatKey | "cost" | "name"; desc: boolean }>({ key: "cost", desc: false })
  const costs = [...new Set(index.content.units.map((unit) => unit.cost))].sort((a, b) => a - b)
  const needle = foldText(search.trim())

  const units = index.content.units
    .filter(
      (unit) =>
        (!cost || unit.cost === cost) &&
        (!trait || unit.traitCodes.includes(trait)) &&
        (!needle ||
          foldText(
            [unit.name, unit.skill?.name ?? "", ...unit.traitCodes.map((c) => index.traits.get(c)?.name ?? "")].join(
              " ",
            ),
          ).includes(needle)),
    )
    .sort((a, b) => {
      const value = (unit: Unit) =>
        sort.key === "cost" ? unit.cost : sort.key === "name" ? 0 : (unit.stats?.[sort.key]?.[star] ?? -1)
      const order =
        sort.key === "name"
          ? a.name.localeCompare(b.name, "vi")
          : value(a) - value(b) || a.cost - b.cost || a.name.localeCompare(b.name, "vi")
      return sort.desc ? -order : order
    })
  const sortBy = (key: StatKey | "cost" | "name") =>
    setSort((current) => ({ key, desc: current.key === key ? !current.desc : key !== "cost" && key !== "name" }))
  const byCost = costs
    .map((value) => ({ cost: value, units: units.filter((unit) => unit.cost === value) }))
    .filter((group) => group.units.length)

  return (
    <section className="mode-stack" aria-label="Quân cờ">
      <div className="mode-filter-bar">
        <input
          className="mode-search"
          type="search"
          placeholder="Tìm quân cờ, chiêu, Phe/Nghề…"
          aria-label="Tìm quân cờ"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="mode-select"
          aria-label="Lọc theo Phe/Nghề"
          value={trait ?? ""}
          onChange={(event) => setTrait(event.target.value || null)}
        >
          <option value="">Mọi Phe/Nghề</option>
          {(["FACTION", "CLASS"] as const).map((kind) => (
            <optgroup key={kind} label={TRAIT_KIND_LABEL[kind]}>
              {index.content.traits
                .filter((item) => item.kind === kind)
                .map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} ({index.membersOf(item.code).length})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <div className="mode-segment" role="group" aria-label="Kiểu xem">
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}>
            Thẻ
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            Chỉ số
          </button>
        </div>
      </div>
      <CostChips costs={costs} value={cost} onChange={setCost} />
      <p className="mode-meta">{units.length} quân cờ</p>

      {view === "cards" ? (
        byCost.map((group) => (
          <section key={group.cost} className="unit-group" style={costStyle(group.cost)}>
            <h2 className="unit-group-title">
              <span className="guide-cost">{group.cost} vàng</span>
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
                  title={unit.traitCodes.map((code) => index.traits.get(code)?.name).join(" · ")}
                >
                  <UnitPortrait unit={unit} index={index} size={layout === "compact" ? "md" : "lg"} />
                  <strong>{unit.name}</strong>
                  <span className="unit-traits">
                    {unit.traitCodes.map((code) => (
                      <TraitIcon key={code} trait={index.traits.get(code)} index={index} size={18} />
                    ))}
                  </span>
                  {layout === "wide" && (
                    <span className="unit-trait-names">
                      {unit.traitCodes.map((code) => index.traits.get(code)?.name).join(" · ")}
                    </span>
                  )}
                  {!unit.complete && <i className="unit-incomplete" title="Chưa đủ dữ liệu" />}
                </button>
              ))}
            </div>
          </section>
        ))
      ) : (
        <>
          <div className="mode-segment" role="group" aria-label="Cấp sao">
            {[0, 1, 2].map((value) => (
              <button key={value} type="button" aria-pressed={star === value} onClick={() => setStar(value)}>
                {"★".repeat(value + 1)}
              </button>
            ))}
          </div>
          <div className="guide-table-wrap">
            <table className="guide-table">
              <thead>
                <tr>
                  <th scope="col">
                    <button type="button" onClick={() => sortBy("name")}>
                      Quân cờ
                    </button>
                  </th>
                  <th scope="col" className="num">
                    <button type="button" onClick={() => sortBy("cost")}>
                      Giá
                    </button>
                  </th>
                  {STATS.map((stat) => (
                    <th
                      key={stat.key}
                      scope="col"
                      className="num"
                      aria-sort={sort.key === stat.key ? (sort.desc ? "descending" : "ascending") : undefined}
                    >
                      <button type="button" onClick={() => sortBy(stat.key)}>
                        {stat.label}
                        {sort.key === stat.key ? (sort.desc ? " ↓" : " ↑") : ""}
                      </button>
                    </th>
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
                      <span className="unit-traits">
                        {unit.traitCodes.map((code) => (
                          <TraitTag key={code} code={code} index={index} />
                        ))}
                      </span>
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
          <span className="guide-cost">{unit.cost} vàng</span>
          <div className="guide-trait-tags">
            {unit.traitCodes.map((trait) => (
              <TraitTag key={trait} code={trait} index={index} />
            ))}
          </div>
        </div>
      </header>
      {!unit.complete && <p className="guide-note">Quân cờ này chưa có đủ dữ liệu trong bản Bách khoa đã thu thập.</p>}
      {unit.note && <p className="guide-note">{unit.note}</p>}
      {unit.skill?.name && (
        <section className="guide-skill">
          {skillIcon ? <img className="guide-icon" src={skillIcon} alt="" /> : <span />}
          <div>
            <h3>{unit.skill.name}</h3>
            {unit.skill.description && <p>{unit.skill.description}</p>}
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
                <th scope="col" className="num">
                  ★
                </th>
                <th scope="col" className="num">
                  ★★
                </th>
                <th scope="col" className="num">
                  ★★★
                </th>
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

export function TierList({ trait, count }: { trait: Trait; count?: number }) {
  return (
    <div className="guide-tiers">
      {trait.tiers.map((tier) => (
        <p key={tier.count} className="guide-tier" data-reached={count !== undefined && count >= tier.count}>
          <b>{tier.count}</b>
          <span>{tier.effect}</span>
        </p>
      ))}
    </div>
  )
}

function TraitsTab({ index, onOpen }: { index: GuideIndex; onOpen: (code: string) => void }) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<Trait["kind"] | null>(null)
  const needle = foldText(search.trim())
  return (
    <section className="mode-stack" aria-label="Phe và Nghề">
      <div className="mode-filter-bar">
        <input
          className="mode-search"
          type="search"
          placeholder="Tìm Phe/Nghề hoặc hiệu ứng…"
          aria-label="Tìm Phe/Nghề"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="mode-segment" role="group" aria-label="Loại">
          <button type="button" aria-pressed={kind === null} onClick={() => setKind(null)}>
            Tất cả
          </button>
          {(["FACTION", "CLASS"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>
              {TRAIT_KIND_LABEL[value]}
            </button>
          ))}
        </div>
      </div>
      {(["FACTION", "CLASS"] as const)
        .filter((value) => !kind || kind === value)
        .map((value) => {
          const traits = index.content.traits.filter(
            (trait) =>
              trait.kind === value &&
              (!needle || foldText([trait.name, ...trait.tiers.map((tier) => tier.effect)].join(" ")).includes(needle)),
          )
          if (!traits.length) return null
          return (
            <section key={value} className="mode-stack">
              <h2 className="mode-section-title">
                {TRAIT_KIND_LABEL[value]} <small>{traits.length}</small>
              </h2>
              <div className="guide-traits">
                {traits.map((trait) => {
                  const members = index.membersOf(trait.code)
                  return (
                    <article key={trait.code} className="guide-trait" id={`trait-${trait.code}`}>
                      <header className="guide-trait-head">
                        <TraitIcon trait={trait} index={index} size={40} />
                        <div>
                          <h3>{trait.name}</h3>
                          <span className="mode-meta">
                            {members.length} quân cờ · mốc {trait.tiers.map((tier) => tier.count).join(" / ")}
                          </span>
                        </div>
                      </header>
                      {trait.description && <p className="mode-prose">{trait.description}</p>}
                      <TierList trait={trait} />
                      {trait.note && <p className="guide-note">{trait.note}</p>}
                      <div className="guide-members">
                        {members.map((member) => (
                          <button
                            key={member.code}
                            type="button"
                            title={`${member.name} (${member.cost} vàng)`}
                            onClick={() => onOpen(member.code)}
                          >
                            <UnitPortrait unit={member} index={index} size="sm" />
                          </button>
                        ))}
                        {!members.length && <span className="mode-meta">Chưa có quân cờ trong bản đã thu thập.</span>}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
    </section>
  )
}

/** The game sorts items by the color of their stone; the group name says which. */
function stoneColor(code: string, name: string) {
  const key = foldText(`${code} ${name}`)
  if (key.includes("xanh la")) return "#4fbf7a"
  if (key.includes("xanh lam") || key.includes("xanh duong")) return "#4f9be0"
  if (key.includes("vang")) return "#f2b440"
  if (key.includes("do")) return "#e0625a"
  return "#9aa4b2"
}

function ItemsTab({ index }: { index: GuideIndex }) {
  const { itemGroups, items } = index.content
  const groups = [...itemGroups, ...(items.some((item) => !item.groupCode) ? [{ code: "", name: "Khác" }] : [])]
  return (
    <section className="mode-stack" aria-label="Trang bị">
      {groups.map((group) => {
        const entries = items
          .filter((item) => (item.groupCode ?? "") === group.code)
          .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99))
        const slots = "slotCount" in group ? group.slotCount : null
        return (
          <section
            key={group.code}
            className="item-group"
            style={{ "--stone-color": stoneColor(group.code, group.name) } as CSSProperties}
          >
            <h2 className="mode-section-title">
              <i className="item-stone" aria-hidden="true" />
              {group.name}
              {slots ? <small>{`${entries.length}/${slots} ô có dữ liệu`}</small> : null}
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
                        {item.effect && <p>{item.effect}</p>}
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

function BlessingsTab({ index }: { index: GuideIndex }) {
  const [tier, setTier] = useState<Blessing["tier"] | null>(null)
  const [search, setSearch] = useState("")
  const needle = foldText(search.trim())
  const blessings = index.content.blessings.filter(
    (blessing) =>
      (!tier || blessing.tier === tier) &&
      (!needle || foldText(`${blessing.name} ${blessing.description ?? ""}`).includes(needle)),
  )
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
          Tất cả ({index.content.blessings.length})
        </button>
        {(Object.keys(BLESSING_TIER_LABEL) as Blessing["tier"][]).map((value) => (
          <button
            key={value}
            type="button"
            className="mode-chip"
            style={TIER_STYLE[value]}
            data-tier={value}
            aria-pressed={tier === value}
            onClick={() => setTier(tier === value ? null : value)}
          >
            {BLESSING_TIER_LABEL[value]} ({index.content.blessings.filter((b) => b.tier === value).length})
          </button>
        ))}
      </div>
      <div className="blessing-list">
        {blessings.map((blessing) => (
          <article key={blessing.code} className="blessing-card" style={TIER_STYLE[blessing.tier]}>
            <BlessingIcon blessing={blessing} index={index} />
            <div>
              <h3>{blessing.name}</h3>
              <span className="blessing-tier">{BLESSING_TIER_LABEL[blessing.tier]}</span>
              {blessing.description && <p>{blessing.description}</p>}
            </div>
          </article>
        ))}
      </div>
      {!blessings.length && <p className="mode-empty">Không có chúc phúc khớp tìm kiếm.</p>}
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
