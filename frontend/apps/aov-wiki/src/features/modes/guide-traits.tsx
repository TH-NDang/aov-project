import { useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { TRAIT_KIND_LABEL, type Trait } from "./auto-chess-model"
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
  const [params, setParams] = useSearchParams()
  const table = params.get("xem") === "bang"
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
      if (code && layout === "wide") next.delete("xem")
      if (code) next.set("trait", code)
      else next.delete("trait")
    })

  return (
    <section className="guide-tab-body" aria-label="Phe và Nghề">
      <div className="guide-toolbar">
        <ChoiceSwitch
          label="Cách xem"
          value={table ? "table" : "detail"}
          onChange={(view) => change((next) => (view === "table" ? next.set("xem", "bang") : next.delete("xem")))}
          options={[
            { value: "detail", label: "Từng Phe/Nghề", icon: <WikiIcon name="detail" size={16} /> },
            { value: "table", label: "Bảng Phe × Nghề", icon: <WikiIcon name="table" size={16} /> },
          ]}
        />
      </div>
      {table ? (
        <TraitTable index={index} onOpen={onOpen} onPick={pick} />
      ) : (
        <div className="trait-browser">
          <div className="trait-index">
            {TRAIT_KINDS.map((kind) => {
              const traits = index.content.traits.filter((trait) => trait.kind === kind)
              if (!traits.length) return null
              return (
                <section key={kind} className="mode-section" aria-labelledby={`trait-kind-${kind}`}>
                  <ModeHeading id={`trait-kind-${kind}`} title={TRAIT_KIND_LABEL[kind]} count={traits.length} />
                  <div className="trait-index-grid">
                    {traits.map((trait) => (
                      <button
                        key={trait.code}
                        type="button"
                        className="trait-index-item"
                        aria-pressed={selected?.code === trait.code}
                        onClick={() => pick(trait.code)}
                      >
                        <TraitIcon trait={trait} index={index} size={40} />
                        <span>
                          <strong>{trait.name}</strong>
                          <small>
                            {index.membersOf(trait.code).length} quân ·{" "}
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
        <TraitIcon trait={trait} index={index} size={56} />
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
      <section className="guide-detail-block" aria-label="Quân cờ liên quan">
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
        <section className="guide-detail-block" aria-label="Hay đi cùng">
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
      <TraitIcon trait={trait} index={index} size={28} />
      <span>{trait.name}</span>
    </button>
  )
  return (
    <>
      <p className="mode-meta">Hàng là Nghề, cột là Phe. Bấm tên để xem Phe/Nghề, bấm quân cờ để xem quân cờ.</p>
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
