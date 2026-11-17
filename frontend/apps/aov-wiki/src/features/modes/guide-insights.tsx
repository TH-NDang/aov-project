import { useContext, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { useWikiContext, wikiText, useWikiText } from "../../context/wiki-context"
import { ModeHeading } from "./mode-ui"
import { insightsQuery } from "./mode-api"
import { GuideLinks, TraitIcon, UnitPortrait, type GuideIndex } from "./guide-ui"

type Row = { key: string; label: ReactNode; value: number }

/** Plain bars, the longest row full width, each with its exact number at the end. */
function Bars({ rows, label }: { rows: Row[]; label: string }) {
  const { locale } = useWikiContext()
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <ol className="insight-bars" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className="insight-bar">
          <span className="insight-label">{row.label}</span>
          <span className="insight-track" aria-hidden="true">
            <i style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <b>{row.value.toLocaleString(locale)}</b>
        </li>
      ))}
    </ol>
  )
}

/** Rows of empty bars while the numbers load, so the section keeps its shape. */
function BarsLoading({ rows }: { rows: number }) {
  const { locale } = useWikiContext()
  return (
    <ol className="insight-bars" role="status" aria-label={wikiText(locale, "Đang tải thống kê", "Loading statistics")}>
      {Array.from({ length: rows }, (_, at) => (
        <li key={at} className="insight-bar" data-loading="">
          <span className="insight-label" />
          <span className="insight-track" />
          <b />
        </li>
      ))}
    </ol>
  )
}

/** How often units and traits appear in the lineups editors and readers build, and how the units compare. */
export function InsightsTab({
  code,
  index,
  onOpen,
}: {
  code: string
  index: GuideIndex
  onOpen: (code: string) => void
}) {
  const text = useWikiText()
  const insights = useQuery(insightsQuery(code))
  const links = useContext(GuideLinks)
  const { units, traits } = index.content
  const byCost = new Map<number, number>()
  units.forEach((unit) => byCost.set(unit.cost, (byCost.get(unit.cost) ?? 0) + 1))
  const leaders = (key: "health" | "physicalAttack") =>
    [...units]
      .filter((unit) => unit.stats?.[key]?.length === 3)
      .sort((a, b) => (b.stats![key][2] ?? 0) - (a.stats![key][2] ?? 0))
      .slice(0, 5)
  const unitLabel = (unitCode: string) => {
    const unit = index.units.get(unitCode)
    return unit ? (
      <button type="button" className="guide-name-button" onClick={() => onOpen(unit.code)}>
        <UnitPortrait unit={unit} index={index} size="xs" />
        {unit.name}
      </button>
    ) : (
      unitCode
    )
  }
  const traitLabel = (traitCode: string) => {
    const trait = index.traits.get(traitCode)
    if (!trait) return traitCode
    const body = (
      <>
        <TraitIcon trait={trait} index={index} size={22} />
        {trait.name}
      </>
    )
    return links ? (
      <Link className="guide-name-button" to={links.traitHref(trait.code)}>
        {body}
      </Link>
    ) : (
      <span className="guide-name-button">{body}</span>
    )
  }
  const failed = (
    <div className="guide-state" role="alert">
      <p>{text("Chưa tải được thống kê đội hình.", "Lineup statistics could not be loaded.")}</p>
      <button type="button" className="mode-chip" onClick={() => void insights.refetch()}>
        {text("Thử lại", "Retry")}
      </button>
    </div>
  )
  const editorial = insights.data ? insights.data.lineupCount - insights.data.communityLineupCount : 0
  const community = insights.data?.communityLineupCount ?? 0

  return (
    <div className="guide-tab-body">
      <p className="insights-lead">
        {insights.data
          ? text(
              `Tính từ ${editorial} đội hình đề xuất và ${community} đội hình cộng đồng. `,
              `Counted from ${editorial} recommended and ${community} community lineups. `,
            )
          : ""}
        {text(
          "Đây là xu hướng xếp đội hình của biên tập viên và người đọc, không phải tỷ lệ thắng.",
          "This shows how editors and readers build lineups, not win rates.",
        )}
      </p>
      {/* Phones read the sections in this order; wide screens place them in two columns (see guide.css). */}
      <div className="insights">
        <section className="mode-section" data-area="units" aria-labelledby="insight-units">
          <ModeHeading
            id="insight-units"
            title={text("Quân cờ được dùng nhiều", "Most used units")}
            note={text(
              "Điểm = số lần có trong đội hình × (1 + lượt thích).",
              "Score = appearances in lineups × (1 + likes).",
            )}
          />
          {insights.isPending ? (
            <BarsLoading rows={12} />
          ) : insights.isError ? (
            failed
          ) : (
            <Bars
              label={text("Quân cờ được dùng nhiều", "Most used units")}
              rows={insights.data.units.slice(0, 12).map((row) => ({
                key: row.code,
                label: unitLabel(row.code),
                value: row.weighted,
              }))}
            />
          )}
        </section>
        <section className="mode-section" data-area="traits" aria-labelledby="insight-traits">
          <ModeHeading
            id="insight-traits"
            title={text("Phe & Nghề hay kích hoạt", "Most activated Factions & Classes")}
            note={text(
              "Số đội hình đạt ít nhất một mốc của Phe/Nghề.",
              "Lineups that reach at least one tier of the Faction/Class.",
            )}
          />
          {insights.isPending ? (
            <BarsLoading rows={10} />
          ) : insights.isError ? (
            failed
          ) : (
            <Bars
              label={text("Phe & Nghề hay kích hoạt", "Most activated Factions & Classes")}
              rows={insights.data.traits.slice(0, 10).map((row) => ({
                key: row.code,
                label: traitLabel(row.code),
                value: row.activations,
              }))}
            />
          )}
        </section>
        <section className="mode-section" data-area="costs" aria-labelledby="insight-costs">
          <ModeHeading id="insight-costs" title={text("Số quân cờ theo giá", "Number of units by cost")} />
          <Bars
            label={text("Số quân cờ theo giá", "Number of units by cost")}
            rows={[...byCost.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([cost, count]) => ({
                key: String(cost),
                label: text(`${cost} vàng`, `${cost} gold`),
                value: count,
              }))}
          />
        </section>
        <section className="mode-section" data-area="health" aria-labelledby="insight-health">
          <ModeHeading id="insight-health" title={text("Máu cao nhất ở 3 sao", "Highest HP at 3 stars")} />
          <Bars
            label={text("Máu cao nhất ở 3 sao", "Highest HP at 3 stars")}
            rows={leaders("health").map((unit) => ({
              key: unit.code,
              label: unitLabel(unit.code),
              value: unit.stats!.health[2]!,
            }))}
          />
        </section>
        <section className="mode-section" data-area="attack" aria-labelledby="insight-attack">
          <ModeHeading
            id="insight-attack"
            title={text("Công vật lý cao nhất ở 3 sao", "Highest Attack Damage at 3 stars")}
          />
          <Bars
            label={text("Công vật lý cao nhất ở 3 sao", "Highest Attack Damage at 3 stars")}
            rows={leaders("physicalAttack").map((unit) => ({
              key: unit.code,
              label: unitLabel(unit.code),
              value: unit.stats!.physicalAttack[2]!,
            }))}
          />
        </section>
        <section className="mode-section" data-area="members" aria-labelledby="insight-members">
          <ModeHeading
            id="insight-members"
            title={text("Phe & Nghề theo số quân cờ", "Factions & Classes by number of units")}
            note={text(
              "Bao nhiêu quân cờ mang mỗi Phe/Nghề trong bản Bách khoa.",
              "How many units carry each Faction/Class in the Encyclopedia edition.",
            )}
          />
          <Bars
            label={text("Phe & Nghề theo số quân cờ", "Factions & Classes by number of units")}
            rows={[...traits]
              .map((trait) => ({
                key: trait.code,
                label: traitLabel(trait.code),
                value: index.membersOf(trait.code).length,
              }))
              .sort((a, b) => b.value - a.value)}
          />
        </section>
      </div>
    </div>
  )
}
