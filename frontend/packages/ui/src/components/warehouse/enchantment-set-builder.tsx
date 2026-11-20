import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import {
  choosePrimaryBranch,
  chooseSecondaryBranch,
  chooseEnchantment,
  primaryBranch,
  secondaryBranches,
  slotChoices,
  slotEnchantment,
  type EnchantmentSet,
  type SetEnchantment,
} from "@aov/ui/lib/enchantment-set"
import { enchantmentUseFacts, type EnchantmentUse } from "@aov/ui/lib/enchantment-use"
import "./enchantment-set-builder.css"

export interface SetBuilderBranch {
  code: string
  name: string
  color: string
  suitability?: string | null
  icon: ReactNode
}

export interface SetBuilderEnchantment extends SetEnchantment {
  name: string
  summary?: string | null
  description?: string | null
  icon: ReactNode
  use?: EnchantmentUse
}

type Text = (vi: string, en: string) => string
type Open = { kind: "branch"; slot: 1 | 4 | 5 } | { kind: "slot"; slot: number } | null
type Focus = { kind: "branch"; code: string } | { kind: "enchantment"; id: string } | null

const ROMAN = ["", "I", "II", "III"]

/**
 * An enchantment set laid out as the game draws it: the primary branch's emblem joined by a line to tiers I and II and
 * the larger centre enchantment of tier III, then two secondary pairs of a branch and its enchantment. A press on a spot
 * opens an arc of what may go there, highest place on top as in the game, with each choice's short label; the panel
 * beside it reads the branch or enchantment last chosen. Without `onChange` it only shows a set.
 */
export function EnchantmentSetBuilder({
  branches,
  enchantments,
  value,
  onChange,
  text,
  renderText = (body) => body,
  actions,
}: {
  branches: SetBuilderBranch[]
  enchantments: SetBuilderEnchantment[]
  value: EnchantmentSet
  onChange?: (next: EnchantmentSet) => void
  text: Text
  /** Draws a description, such as the Wiki's rich text with its links. */
  renderText?: (body: string) => ReactNode
  /** Under the panel, such as sharing the set. */
  actions?: ReactNode
}) {
  const [open, setOpen] = useState<Open>(null)
  const [focus, setFocus] = useState<Focus>(null)
  const [brief, setBrief] = useState(false)
  const root = useRef<HTMLElement>(null)
  const codes = branches.map((branch) => branch.code)
  const branchOf = (code: string | null | undefined) => branches.find((branch) => branch.code === code)
  const entryOf = (slot: number) => slotEnchantment(value, slot, enchantments) as SetBuilderEnchantment | undefined
  const primary = branchOf(primaryBranch(value, enchantments))
  const editable = !!onChange

  // An open arc closes on a press elsewhere or on Escape.
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.(".esb-spot[data-open]")) setOpen(null)
    }
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null)
    document.addEventListener("pointerdown", away)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", away)
      document.removeEventListener("keydown", escape)
    }
  }, [open])

  const toggle = (next: NonNullable<Open>) =>
    setOpen((current) => (current && current.kind === next.kind && current.slot === next.slot ? null : next))

  const tone = (code: string | null | undefined) =>
    ({ "--esb-tone": branchOf(code)?.color ?? "var(--aov-accent, #d6ad57)" }) as CSSProperties

  /** One round spot: a branch emblem or an enchantment, with its arc of choices when open. */
  const spot = ({
    key,
    label,
    icon,
    tier,
    center = false,
    emblem = false,
    color,
    opened,
    choices,
    onPress,
    edge,
  }: {
    key: string
    label: string
    icon: ReactNode | null
    tier?: number
    center?: boolean
    emblem?: boolean
    color: string | null | undefined
    opened: boolean
    choices: ReactNode
    onPress: () => void
    edge?: "start" | "end"
  }) => (
    <div key={key} className="esb-spot" data-open={opened || undefined} data-edge={edge} style={tone(color)}>
      <button
        type="button"
        className="esb-node"
        data-center={center || undefined}
        data-emblem={emblem || undefined}
        data-empty={icon ? undefined : ""}
        aria-label={label}
        aria-expanded={editable ? opened : undefined}
        onClick={onPress}
      >
        <span className="esb-node-art">{icon}</span>
        {tier ? <span className="esb-tier">{ROMAN[tier]}</span> : null}
      </button>
      {opened && (
        <div className="esb-arc" role="group" aria-label={label}>
          {choices}
        </div>
      )}
    </div>
  )

  const branchChoices = (slot: 1 | 4 | 5) => {
    const allowed = slot === 1 ? codes : secondaryBranches(value, enchantments, codes)
    const current = slot === 1 ? primary?.code : entryOf(slot)?.branchCode
    return branches
      .filter((branch) => allowed.includes(branch.code))
      .map((branch) => (
        <button
          key={branch.code}
          type="button"
          className="esb-choice"
          aria-pressed={branch.code === current}
          style={tone(branch.code)}
          onClick={() => {
            setFocus({ kind: "branch", code: branch.code })
            setOpen(null)
            if (!onChange || branch.code === current) return
            onChange(
              slot === 1
                ? choosePrimaryBranch(value, branch.code, enchantments, codes)
                : chooseSecondaryBranch(value, slot, branch.code, enchantments),
            )
          }}
        >
          <span className="esb-choice-art">{branch.icon}</span>
          <span className="esb-choice-label">{branch.name}</span>
        </button>
      ))
  }

  const enchantmentChoices = (slot: number) =>
    // The game lists a tier's enchantments from the highest place down.
    [...(slotChoices(value, slot, enchantments) as SetBuilderEnchantment[])].reverse().map((entry) => (
      <button
        key={entry.id}
        type="button"
        className="esb-choice"
        aria-pressed={entry.id === value[slot - 1]}
        onClick={() => {
          setFocus({ kind: "enchantment", id: entry.id })
          setOpen(null)
          if (onChange && entry.id !== value[slot - 1]) onChange(chooseEnchantment(value, slot, entry.id, enchantments))
        }}
      >
        <span className="esb-choice-art">{entry.icon}</span>
        <span className="esb-choice-label">{entry.summary || entry.name}</span>
      </button>
    ))

  const enchantmentSpot = (slot: number, edge?: "start" | "end") => {
    const entry = entryOf(slot)
    const label =
      slot <= 3
        ? text(`Phù hiệu chính bậc ${ROMAN[slot]}`, `Primary tier ${ROMAN[slot]}`)
        : text(`Phù hiệu phụ ${slot - 3}`, `Secondary ${slot - 3}`)
    return spot({
      key: `slot-${slot}`,
      label: entry ? `${label}: ${entry.name}` : label,
      icon: entry?.icon ?? null,
      tier: entry?.tier ?? (slot <= 3 ? slot : undefined),
      center: slot === 3,
      color: entry?.branchCode ?? (slot <= 3 ? primary?.code : undefined),
      opened: open?.kind === "slot" && open.slot === slot,
      choices: enchantmentChoices(slot),
      edge,
      onPress: () => {
        if (entry) setFocus({ kind: "enchantment", id: entry.id })
        if (editable) toggle({ kind: "slot", slot })
      },
    })
  }

  const branchSpot = (slot: 1 | 4 | 5, edge?: "start" | "end") => {
    const code = slot === 1 ? primary?.code : entryOf(slot)?.branchCode
    const branch = branchOf(code)
    return spot({
      key: `branch-${slot}`,
      label:
        (slot === 1 ? text("Hệ chính", "Primary branch") : text(`Hệ phụ ${slot - 3}`, `Secondary branch ${slot - 3}`)) +
        (branch ? `: ${branch.name}` : ""),
      icon: branch?.icon ?? null,
      emblem: true,
      color: code,
      opened: open?.kind === "branch" && open.slot === slot,
      choices: branchChoices(slot),
      edge,
      onPress: () => {
        if (branch) setFocus({ kind: "branch", code: branch.code })
        if (editable) toggle({ kind: "branch", slot })
      },
    })
  }

  const line = (code: string | null | undefined, key: string) => (
    <span key={key} className="esb-line" style={tone(code)} aria-hidden />
  )

  const focused =
    focus?.kind === "enchantment"
      ? enchantments.find((entry) => entry.id === focus.id)
      : focus?.kind === "branch"
        ? undefined
        : (entryOf(1) ?? undefined)
  const focusedBranch =
    focus?.kind === "branch" ? branchOf(focus.code) : focused ? branchOf(focused.branchCode) : primary

  return (
    <section ref={root} className="esb" style={tone(primary?.code)} aria-label={text("Bộ phù hiệu", "Enchantment set")}>
      <div className="esb-stage">
        <div className="esb-row">
          {branchSpot(1, "start")}
          {line(primary?.code, "l1")}
          {enchantmentSpot(1)}
          {line(primary?.code, "l2")}
          {enchantmentSpot(2)}
          {line(primary?.code, "l3")}
          {enchantmentSpot(3, "end")}
        </div>
        <div className="esb-row esb-row-side">
          <div className="esb-pair">
            {branchSpot(4, "start")}
            {line(entryOf(4)?.branchCode, "l4")}
            {enchantmentSpot(4)}
          </div>
          <div className="esb-pair">
            {branchSpot(5)}
            {line(entryOf(5)?.branchCode, "l5")}
            {enchantmentSpot(5, "end")}
          </div>
        </div>
      </div>
      <aside className="esb-panel" aria-live="polite" style={tone(focusedBranch?.code)}>
        {focus?.kind === "branch" && focusedBranch ? (
          <div className="esb-panel-branch">
            <span className="esb-panel-emblem">{focusedBranch.icon}</span>
            <strong>{focusedBranch.name}</strong>
            {focusedBranch.suitability && (
              <p>
                <span>{text("Thích hợp:", "Suits:")}</span> {focusedBranch.suitability}
              </p>
            )}
          </div>
        ) : focused ? (
          <>
            <div className="esb-panel-head">
              <span className="esb-panel-art">
                {focused.icon}
                <span className="esb-tier">{ROMAN[focused.tier]}</span>
              </span>
              <span>
                <strong>{focused.name}</strong>
                <small>{branchOf(focused.branchCode)?.name}</small>
              </span>
            </div>
            <div className="esb-panel-body">
              {brief ? (
                <>
                  {focused.summary && <p className="esb-panel-summary">{focused.summary}</p>}
                  <dl>
                    {enchantmentUseFacts(focused.use ?? {}, text).map((fact) => (
                      <div key={fact.key}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                focused.description && <div>{renderText(focused.description)}</div>
              )}
            </div>
            <div className="esb-switch" role="group" aria-label={text("Cách đọc", "View")}>
              <button type="button" aria-pressed={brief} onClick={() => setBrief(true)}>
                {text("Tóm tắt", "Summary")}
              </button>
              <button type="button" aria-pressed={!brief} onClick={() => setBrief(false)}>
                {text("Chi tiết", "Details")}
              </button>
            </div>
          </>
        ) : (
          <p className="esb-panel-empty">{text("Chọn một phù hiệu để xem.", "Pick an enchantment to read it.")}</p>
        )}
        {actions && <div className="esb-actions">{actions}</div>}
      </aside>
    </section>
  )
}
