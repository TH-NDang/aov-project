import { useMemo, useState, type CSSProperties } from "react"
import { Link, useSearchParams } from "react-router"
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

export function UnitPortrait({ unit, index, size }: { unit: Unit; index: GuideIndex; size?: "sm" | "lg" }) {
  const src = index.image(unit.portraitAssetId)
  return src ? (
    <img className="guide-portrait" data-size={size} style={costStyle(unit.cost)} src={src} alt="" loading="lazy" />
  ) : (
    <span className="guide-portrait mode-art-fallback" data-size={size} style={costStyle(unit.cost)} aria-hidden="true">
      {unit.name.slice(0, 2)}
    </span>
  )
}

export function TraitTag({ code, index }: { code: string; index: GuideIndex }) {
  const trait = index.traits.get(code)
  if (!trait) return null
  const src = index.image(trait.iconAssetId)
  return (
    <span className="guide-trait-tag" title={`${TRAIT_KIND_LABEL[trait.kind]}: ${trait.name}`}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span />}
      {trait.name}
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

function UnitsTab({ index, onOpen }: { index: GuideIndex; onOpen: (code: string) => void }) {
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

  return (
    <section className="mode-page" aria-label="Quân cờ">
      <div className="mode-toolbar">
        <input
          className="mode-search"
          type="search"
          placeholder="Tìm quân cờ, chiêu, Phe/Nghề…"
          aria-label="Tìm quân cờ"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className="mode-chip" aria-pressed={view === "cards"} onClick={() => setView("cards")}>
          Thẻ
        </button>
        <button type="button" className="mode-chip" aria-pressed={view === "table"} onClick={() => setView("table")}>
          Bảng chỉ số
        </button>
      </div>
      <div className="mode-toolbar" role="group" aria-label="Lọc theo giá">
        <button type="button" className="mode-chip" aria-pressed={cost === null} onClick={() => setCost(null)}>
          Mọi giá
        </button>
        {costs.map((value) => (
          <button
            key={value}
            type="button"
            className="mode-chip"
            style={costStyle(value)}
            aria-pressed={cost === value}
            onClick={() => setCost(cost === value ? null : value)}
          >
            <span className="guide-cost">{value} vàng</span>
          </button>
        ))}
      </div>
      <div className="mode-toolbar" role="group" aria-label="Lọc theo Phe/Nghề">
        <select
          className="mode-search"
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
        <span className="mode-meta">{units.length} quân cờ</span>
      </div>

      {view === "cards" ? (
        <div className="guide-grid">
          {units.map((unit) => (
            <button
              key={unit.code}
              type="button"
              className="guide-unit"
              style={costStyle(unit.cost)}
              onClick={() => onOpen(unit.code)}
            >
              <UnitPortrait unit={unit} index={index} />
              <span>
                <strong>{unit.name}</strong>
                <span className="guide-cost">{unit.cost}</span>{" "}
                <span>{unit.traitCodes.map((code) => index.traits.get(code)?.name).join(" · ")}</span>
                {!unit.complete && <span className="guide-note"> · thiếu dữ liệu</span>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="mode-toolbar" role="group" aria-label="Cấp sao">
            {[0, 1, 2].map((value) => (
              <button
                key={value}
                type="button"
                className="mode-chip"
                aria-pressed={star === value}
                onClick={() => setStar(value)}
              >
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
                      <button type="button" className="guide-trait-tag" onClick={() => onOpen(unit.code)}>
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
                    <td>{unit.traitCodes.map((code) => index.traits.get(code)?.name).join(", ")}</td>
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
      <header className="guide-detail-head">
        <UnitPortrait unit={unit} index={index} size="lg" />
        <div>
          <h2>{unit.name}</h2>
          <span className="guide-cost" style={costStyle(unit.cost)}>
            {unit.cost} vàng
          </span>
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
            <h3 className="mode-section-title">{unit.skill.name}</h3>
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
          <section key={traitCode} className="mode-panel">
            <h3>
              {TRAIT_KIND_LABEL[trait.kind]}: {trait.name}
            </h3>
            <TierList trait={trait} />
            <div className="guide-members">
              {index.membersOf(traitCode).map((member) => (
                <button key={member.code} type="button" title={member.name} onClick={() => onOpen(member.code)}>
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
  const needle = foldText(search.trim())
  return (
    <section className="mode-page" aria-label="Phe và Nghề">
      <input
        className="mode-search"
        type="search"
        placeholder="Tìm Phe/Nghề hoặc hiệu ứng…"
        aria-label="Tìm Phe/Nghề"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {(["FACTION", "CLASS"] as const).map((kind) => {
        const traits = index.content.traits.filter(
          (trait) =>
            trait.kind === kind &&
            (!needle || foldText([trait.name, ...trait.tiers.map((tier) => tier.effect)].join(" ")).includes(needle)),
        )
        if (!traits.length) return null
        return (
          <section key={kind} className="mode-page">
            <h2 className="mode-section-title">
              {TRAIT_KIND_LABEL[kind]} <small>{traits.length}</small>
            </h2>
            <div className="guide-traits">
              {traits.map((trait) => {
                const icon = index.image(trait.iconAssetId)
                const members = index.membersOf(trait.code)
                return (
                  <article key={trait.code} className="guide-trait" id={`trait-${trait.code}`}>
                    <header className="guide-trait-head">
                      {icon ? <img className="guide-icon" data-round="true" src={icon} alt="" /> : null}
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

function ItemsTab({ index }: { index: GuideIndex }) {
  const { itemGroups, items } = index.content
  const groups = [...itemGroups, ...(items.some((item) => !item.groupCode) ? [{ code: "", name: "Khác" }] : [])]
  return (
    <section className="mode-page" aria-label="Trang bị">
      {groups.map((group) => {
        const entries = items
          .filter((item) => (item.groupCode ?? "") === group.code)
          .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99))
        const slots = "slotCount" in group ? group.slotCount : null
        return (
          <section key={group.code} className="mode-page">
            <h2 className="mode-section-title">
              {group.name}
              {slots ? <small>{`${entries.length}/${slots} ô có dữ liệu`}</small> : null}
            </h2>
            {entries.length ? (
              <div className="guide-card-list">
                {entries.map((item) => {
                  const icon = index.image(item.iconAssetId)
                  return (
                    <article key={item.code} className="guide-card">
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
    <section className="mode-page" aria-label="Chúc phúc">
      <div className="mode-toolbar">
        <input
          className="mode-search"
          type="search"
          placeholder="Tìm chúc phúc…"
          aria-label="Tìm chúc phúc"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className="mode-chip" aria-pressed={tier === null} onClick={() => setTier(null)}>
          Tất cả
        </button>
        {(Object.keys(BLESSING_TIER_LABEL) as Blessing["tier"][]).map((value) => (
          <button
            key={value}
            type="button"
            className="mode-chip"
            aria-pressed={tier === value}
            onClick={() => setTier(tier === value ? null : value)}
          >
            {BLESSING_TIER_LABEL[value]} ({index.content.blessings.filter((b) => b.tier === value).length})
          </button>
        ))}
      </div>
      <div className="guide-card-list">
        {blessings.map((blessing) => {
          const icon = index.image(blessing.iconAssetId)
          return (
            <article key={blessing.code} className="guide-card" data-tier={blessing.tier}>
              {icon ? <img className="guide-icon" src={icon} alt="" loading="lazy" /> : <span />}
              <div>
                <h3>{blessing.name}</h3>
                <span className="mode-meta">{BLESSING_TIER_LABEL[blessing.tier]}</span>
                {blessing.description && <p>{blessing.description}</p>}
              </div>
            </article>
          )
        })}
      </div>
      {!blessings.length && <p className="mode-empty">Không có chúc phúc khớp tìm kiếm.</p>}
    </section>
  )
}

function QuestsTab({ index }: { index: GuideIndex }) {
  return (
    <section className="mode-page" aria-label="Nhiệm vụ">
      <p className="mode-lead">Nhiệm vụ trong trận và phần thưởng khi hoàn thành.</p>
      <div className="guide-table-wrap">
        <table className="guide-table">
          <thead>
            <tr>
              <th scope="col">Nhiệm vụ</th>
              <th scope="col">Phần thưởng</th>
            </tr>
          </thead>
          <tbody>
            {index.content.quests.map((quest) => (
              <tr key={quest.code}>
                <td style={{ whiteSpace: "normal" }}>{quest.task}</td>
                <td>{quest.reward ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
