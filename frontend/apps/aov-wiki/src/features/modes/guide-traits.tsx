import { useSearchParams } from "react-router"
import { MODE_PARAMS, readModeParam, writeParam } from "../../lib/search-params"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiText } from "../../context/wiki-context"
import { TRAIT_KIND_NAMES, type Trait } from "./auto-chess-model"
import { GoldIcon } from "./gold-icon"
import { ModeDialog, ModeHeading } from "./mode-ui"
import {
  ChoiceSwitch,
  costStyle,
  GuideText,
  TierList,
  TraitIcon,
  TraitTag,
  UnitPortrait,
  type GuideIndex,
} from "./guide-ui"

const TRAIT_KINDS = ["FACTION", "CLASS"] as const

/**
 * The traits tab like the game's interaction screen: every trait in an index, the chosen one in full beside it (in a
 * drawer on phones), plus the game's table of units by faction and class. The choice lives in the address.
 */
export function TraitsTab({ index, onOpen }: { index: GuideIndex; onOpen: (code: string) => void }) {
  const layout = usePageLayout()
  const text = useWikiText()
  const [params, setParams] = useSearchParams()
  const table = readModeParam(params, MODE_PARAMS.view) === "table"
  const linked = index.traits.get(params.get("trait") ?? "")
  const selected = linked ?? (layout === "wide" ? index.content.traits[0] : undefined)
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
      // On wide screens the detail sits beside the index, so picking from the table goes back to it.
      if (code && layout === "wide") writeParam(next, MODE_PARAMS.view, null)
      if (code) next.set("trait", code)
      else next.delete("trait")
    })

  return (
    <section className="wiki-guide-tab-body" aria-label={text("Phe và Nghề", "Factions and Classes")}>
      <div className="wiki-guide-toolbar">
        <ChoiceSwitch
          label={text("Cách xem", "View")}
          value={table ? "table" : "detail"}
          onChange={(view) => change((next) => writeParam(next, MODE_PARAMS.view, view === "table" ? "table" : null))}
          options={[
            {
              value: "detail",
              label: text("Từng Phe/Nghề", "Each faction or class"),
              icon: <WikiIcon name="detail" size={16} />,
            },
            {
              value: "table",
              label: text("Bảng Phe × Nghề", "Faction × Class table"),
              icon: <WikiIcon name="table" size={16} />,
            },
          ]}
        />
      </div>
      {table ? (
        <TraitTable index={index} onOpen={onOpen} onPick={pick} />
      ) : (
        <div className="wiki-guide-trait-browser">
          <div className="wiki-guide-trait-index">
            {TRAIT_KINDS.map((kind) => {
              const traits = index.content.traits.filter((trait) => trait.kind === kind)
              if (!traits.length) return null
              return (
                <section key={kind} className="wiki-mode-section" aria-labelledby={`trait-kind-${kind}`}>
                  <ModeHeading
                    id={`trait-kind-${kind}`}
                    title={text(...TRAIT_KIND_NAMES[kind])}
                    count={traits.length}
                  />
                  <div className="wiki-guide-trait-index-grid">
                    {traits.map((trait) => (
                      <button
                        key={trait.code}
                        type="button"
                        className="wiki-guide-trait-index-item"
                        aria-pressed={selected?.code === trait.code}
                        onClick={() => pick(trait.code)}
                      >
                        <TraitIcon trait={trait} index={index} size={40} />
                        <span>
                          <strong>{trait.name}</strong>
                          <small>
                            {index.membersOf(trait.code).length}{" "}
                            {text("quân", index.membersOf(trait.code).length === 1 ? "unit" : "units")} ·{" "}
                            {trait.tiers.map((tier) => tier.count).join("/")}
                          </small>
                        </span>
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
        <ModeDialog
          open={!!linked}
          onClose={() => pick(null)}
          label={linked?.name ?? text("Phe/Nghề", "Faction/Class")}
          title={text("Phe & Nghề", "Factions & Classes")}
        >
          {linked && <TraitDetail trait={linked} index={index} onOpen={onOpen} />}
        </ModeDialog>
      )}
    </section>
  )
}

/** One trait in full: its tiers, the units that carry it and the traits those units bring along. */
function TraitDetail({ trait, index, onOpen }: { trait: Trait; index: GuideIndex; onOpen: (code: string) => void }) {
  const text = useWikiText()
  const members = [...index.membersOf(trait.code)].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "vi"))
  const partners = new Map<string, number>()
  for (const member of members)
    for (const code of member.traitCodes) if (code !== trait.code) partners.set(code, (partners.get(code) ?? 0) + 1)
  const together = [...partners].sort((a, b) => b[1] - a[1])
  return (
    <article className="wiki-guide-trait-detail" aria-label={`${text(...TRAIT_KIND_NAMES[trait.kind])} ${trait.name}`}>
      <header className="wiki-guide-trait-detail-head">
        <TraitIcon trait={trait} index={index} size={56} />
        <div>
          <span className="wiki-mode-meta">{text(...TRAIT_KIND_NAMES[trait.kind])}</span>
          <h2>{trait.name}</h2>
          <span className="wiki-mode-meta">
            {text(
              `${members.length} quân cờ · mốc`,
              `${members.length} ${members.length === 1 ? "unit" : "units"} · thresholds`,
            )}{" "}
            {trait.tiers.map((tier) => tier.count).join(" / ")}
          </span>
        </div>
      </header>
      {trait.description && (
        <p className="wiki-mode-prose">
          <GuideText text={trait.description} />
        </p>
      )}
      <TierList trait={trait} />
      {trait.note && <p className="wiki-guide-note">{trait.note}</p>}
      <section className="wiki-guide-detail-block" aria-label={text("Quân cờ liên quan", "Related units")}>
        <h3>{text("Quân cờ liên quan", "Related units")}</h3>
        {members.length ? (
          <div className="wiki-guide-trait-members">
            {members.map((member) => (
              <button
                key={member.code}
                type="button"
                className="wiki-guide-trait-member"
                style={costStyle(member.cost)}
                onClick={() => onOpen(member.code)}
              >
                <UnitPortrait unit={member} index={index} size="md" />
                <span>{member.name}</span>
                <small className="wiki-guide-cost" aria-label={text(`${member.cost} vàng`, `${member.cost} gold`)}>
                  <GoldIcon size={12} />
                  {member.cost}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="wiki-mode-meta">
            {text("Chưa có quân cờ trong bản đã thu thập.", "No units in the collected edition yet.")}
          </p>
        )}
      </section>
      {together.length > 0 && (
        <section className="wiki-guide-detail-block" aria-label={text("Hay đi cùng", "Often paired with")}>
          <h3>{text("Hay đi cùng", "Often paired with")}</h3>
          <div className="wiki-guide-trait-tags">
            {together.map(([code, count]) => (
              <TraitTag key={code} code={code} index={index} count={count} />
            ))}
          </div>
          <p className="wiki-mode-meta">
            {text("Số là số quân cờ có cả hai Phe/Nghề.", "The number is how many units have both Factions/Classes.")}
          </p>
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
  const text = useWikiText()
  const factions = index.content.traits.filter((trait) => trait.kind === "FACTION")
  const classes = index.content.traits.filter((trait) => trait.kind === "CLASS")
  const head = (trait: Trait) => (
    <button
      type="button"
      title={`${text(...TRAIT_KIND_NAMES[trait.kind])}: ${trait.name}`}
      onClick={() => onPick(trait.code)}
    >
      <TraitIcon trait={trait} index={index} size={28} />
      <span>{trait.name}</span>
    </button>
  )
  return (
    <>
      <p className="wiki-mode-meta">
        {text(
          "Hàng là Nghề, cột là Phe. Bấm tên để xem Phe/Nghề, bấm quân cờ để xem quân cờ.",
          "Rows are classes, columns are factions. Tap a name to open it, tap a piece to open the piece.",
        )}
      </p>
      <div
        className="wiki-guide-trait-table-scroll"
        role="region"
        aria-label={text("Bảng Phe × Nghề", "Faction × Class table")}
        tabIndex={0}
      >
        <table className="wiki-guide-trait-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="wiki-mode-meta">{text("Nghề \\ Phe", "Class \\ Faction")}</span>
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
                          title={text(`${unit.name} · ${unit.cost} vàng`, `${unit.name} · ${unit.cost} gold`)}
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
