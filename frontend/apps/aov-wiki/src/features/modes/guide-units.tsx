import { useState } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext } from "../../context/wiki-context"
import { encodeLineup, TRAIT_KIND_LABEL, type Unit } from "./auto-chess-model"
import { GoldIcon } from "./gold-icon"
import { StarLevel } from "./star-level"
import { FilterSummary, UnitFilters, useUnitFilter } from "./guide-filters"
import {
  ChoiceSwitch,
  costStyle,
  GuideText,
  TierList,
  TraitIcon,
  UnitPortrait,
  UnitTraits,
  type GuideIndex,
} from "./guide-ui"

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
const isStat = (key: SortKey): key is StatKey => key !== "cost" && key !== "name"

/**
 * Every unit, by price: on wide screens one row per price, the way the game's shop lays them out, so a price never
 * spills a lone unit onto a row of its own. The table compares their stats.
 */
export function UnitsTab({ index, onOpen }: { index: GuideIndex; onOpen: (code: string) => void }) {
  const compact = usePageLayout() === "compact"
  const filter = useUnitFilter(index)
  const [view, setView] = useState<"cards" | "table">("cards")
  const [star, setStar] = useState(0)
  const [sorts, setSorts] = useState<SortRule[]>([{ key: "cost", desc: false }])
  const [multiSort, setMultiSort] = useState(false)

  const value = (unit: Unit, key: SortKey) =>
    key === "cost" ? unit.cost : key === "name" ? 0 : (unit.stats?.[key]?.[star] ?? -1)
  const units = [...filter.units].sort((a, b) => {
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
      <th
        key={key}
        scope="col"
        className={className}
        aria-sort={rule ? (rule.desc ? "descending" : "ascending") : "none"}
      >
        <button
          type="button"
          className="sort-head"
          data-active={!!rule}
          title={compact ? undefined : "Bấm để sắp xếp, giữ Shift để thêm cột"}
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
  // A phone keeps one stat column, the one the table sorts by, so the table never scrolls sideways.
  const phoneStat = (sorts.find((rule) => isStat(rule.key))?.key ?? "health") as StatKey
  const shownStats = compact ? STATS.filter((stat) => stat.key === phoneStat) : STATS
  const byCost = filter.costs
    .map((cost) => ({ cost, units: units.filter((unit) => unit.cost === cost) }))
    .filter((group) => group.units.length)

  return (
    <section className="guide-tab-body" aria-label="Quân cờ">
      <UnitFilters
        index={index}
        filter={filter}
        end={
          <ChoiceSwitch
            label="Kiểu xem"
            value={view}
            onChange={setView}
            labels={!compact}
            options={[
              { value: "cards", label: "Theo giá", icon: <WikiIcon name="cards" size={16} /> },
              { value: "table", label: "Chỉ số", icon: <WikiIcon name="stats" size={16} /> },
            ]}
          />
        }
      />
      <FilterSummary index={index} filter={filter} />

      {!units.length ? (
        <p className="mode-empty">Không có quân cờ phù hợp. Thử tên khác hoặc bỏ bớt điều kiện lọc.</p>
      ) : view === "cards" ? (
        <div className="unit-ladder">
          {byCost.map((group) => (
            <section key={group.cost} className="unit-rank" style={costStyle(group.cost)}>
              <h2 className="unit-rank-label">
                <span className="guide-cost">
                  <GoldIcon size={18} />
                  {group.cost}
                  <span className="sr-only"> vàng</span>
                </span>
                <small>{group.units.length} quân</small>
              </h2>
              <div className="unit-grid">
                {group.units.map((unit) => (
                  <button key={unit.code} type="button" className="unit-tile" onClick={() => onOpen(unit.code)}>
                    <UnitPortrait unit={unit} index={index} size="md" />
                    <strong>{unit.name}</strong>
                    {!compact && <UnitTraits unit={unit} index={index} as="icons" />}
                    {!unit.complete && (
                      <i className="unit-incomplete" title="Chưa đủ dữ liệu">
                        <span className="sr-only">Chưa đủ dữ liệu</span>
                      </i>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="guide-toolbar">
            <ChoiceSwitch
              label="Cấp sao"
              value={star}
              onChange={setStar}
              labels={false}
              options={[0, 1, 2].map((level) => ({
                value: level,
                label: `${level + 1} sao`,
                icon: <StarLevel level={level + 1} />,
              }))}
            />
            {compact ? (
              <label className="guide-select">
                <span>Chỉ số</span>
                <select
                  value={phoneStat}
                  onChange={(event) => setSorts([{ key: event.target.value as StatKey, desc: true }])}
                >
                  {STATS.map((stat) => (
                    <option key={stat.key} value={stat.key}>
                      {stat.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="sort-rules" role="group" aria-label="Thứ tự sắp xếp">
                <span>Sắp xếp</span>
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
                        <WikiIcon name="close" size={14} />
                      </button>
                    )}
                  </span>
                ))}
                <button
                  type="button"
                  className="mode-chip"
                  aria-pressed={multiSort}
                  title="Bấm thêm tiêu đề cột để sắp xếp tiếp theo cột đó; giữ Shift khi bấm cũng được."
                  onClick={() => setMultiSort(!multiSort)}
                >
                  <WikiIcon name="sort" size={16} />
                  Nhiều cột
                </button>
              </div>
            )}
          </div>
          <div className="guide-table-wrap">
            <table className="guide-table unit-table">
              <thead>
                <tr>
                  {sortHead("name", "Quân cờ")}
                  {sortHead("cost", "Giá", "num")}
                  {shownStats.map((stat) => sortHead(stat.key, stat.label, "num"))}
                  {!compact && <th scope="col">Phe/Nghề</th>}
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.code}>
                    <td>
                      <button type="button" className="guide-name-button" onClick={() => onOpen(unit.code)}>
                        <UnitPortrait unit={unit} index={index} size="sm" />
                        <span>
                          {unit.name}
                          {compact && <UnitTraits unit={unit} index={index} as="names" />}
                        </span>
                      </button>
                    </td>
                    <td className="num" style={costStyle(unit.cost)}>
                      <span className="guide-cost">{unit.cost}</span>
                    </td>
                    {shownStats.map((stat) => (
                      <td key={stat.key} className="num">
                        {unit.stats?.[stat.key]?.[star]?.toLocaleString("vi-VN") ?? "—"}
                      </td>
                    ))}
                    {!compact && (
                      <td>
                        <UnitTraits unit={unit} index={index} as="tags" />
                      </td>
                    )}
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

/** One unit in full, in the drawer: its skill, its stats per star level, and each of its traits with its members. */
export function UnitDetail({
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
          <span className="guide-cost">
            <GoldIcon />
            {unit.cost} vàng
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
        <section className="guide-detail-block" aria-label="Chỉ số">
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
        </section>
      )}
      {unit.traitCodes.map((traitCode) => {
        const trait = index.traits.get(traitCode)
        if (!trait) return null
        return (
          <section key={traitCode} className="guide-detail-block">
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
                  aria-label={member.name}
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
        <p className="guide-detail-block mode-meta">
          Có trong đội hình đề xuất: {lineups.map((lineup) => lineup.name).join(", ")}
        </p>
      )}
      <div className="guide-actions">
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
