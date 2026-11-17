import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChangeKindLabel } from "./patch-changes-row"
import { WikiIcon } from "./wiki-icon"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { changeFieldLabel, changeSkillLabel, type HeroChangeItem } from "../lib/wiki-change-format"
import type { HeroDetail, PublicSkill } from "../lib/hero-api"
import { SkillIcon } from "./hero-skill-icon"
import { readChangeValues, writtenForReaders, type LevelTable } from "../lib/change-values"
import "./change-list.css"

/** A before and an after this short together read as "a → b" on one line; longer ones take a line each. */
const INLINE_PAIR = 28

export function ChangeKind({ kind }: { kind?: string | null }) {
  if (!kind) return null
  return (
    <span className="wiki-change-kind" data-kind={kind}>
      <ChangeKindLabel kind={kind} />
    </span>
  )
}

/** "a → b": the old value quiet, the new one strong. */
function Shift({ before, after }: { before: string; after: string }) {
  const { locale } = useWikiContext()
  return (
    <>
      <span className="wiki-change-old">{before}</span>
      <span aria-hidden="true" className="wiki-change-arrow">
        →
      </span>
      <span className="sr-only">{wikiText(locale, "thành", "to")}</span>
      <span className="wiki-change-new">{after}</span>
    </>
  )
}

/**
 * A formula whose lines break only before an operator, so a term such as "20% physical attack" is never split across
 * two lines. A term wider than the whole line still wraps inside itself.
 */
function Formula({ value }: { value: string }) {
  const terms = value.split(/ (?=[+−-] )/)
  if (terms.length < 2) return <>{value}</>
  return (
    <>
      {terms.map((term, index) => (
        <Fragment key={index}>
          {index > 0 && " "}
          <span className="wiki-change-term">{term}</span>
        </Fragment>
      ))}
    </>
  )
}

/** Before and after, side by side when both are short, otherwise one above the other with the values lined up. */
function ValuePair({ before, after }: { before: string; after: string }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  if (before.length + after.length <= INLINE_PAIR)
    return (
      <p className="wiki-change-values">
        <Shift before={before} after={after} />
      </p>
    )
  return (
    <dl className="wiki-change-compare">
      <div data-side="before">
        <dt>{text("Trước", "Before")}</dt>
        <dd>
          <Formula value={before} />
        </dd>
      </div>
      <div data-side="after">
        <dt>{text("Sau", "After")}</dt>
        <dd>
          <Formula value={after} />
        </dd>
      </div>
    </dl>
  )
}

/**
 * A value at each skill level, before and after. What a formula adds on top of its base, the share of a stat that is
 * the same at every level, takes a line of its own under the table instead of a column a phone would hide.
 */
function LevelView({ label, table }: { label: string; table: LevelTable }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const sides = [
    { key: "before" as const, name: text("Trước", "Before") },
    { key: "after" as const, name: text("Sau", "After") },
  ]
  return (
    <>
      <div
        className="wiki-change-rank-table"
        tabIndex={0}
        role="region"
        aria-label={`${text("Bảng theo cấp", "By level")}: ${label}`}
      >
        <table>
          <caption className="sr-only">
            {label}: {text("trước và sau theo từng cấp chiêu", "before and after at each ability level")}
          </caption>
          <thead>
            <tr>
              <td />
              {table.columns.map((column) => (
                <th scope="col" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sides.map((side) => (
              <tr key={side.key} data-side={side.key}>
                <th scope="row">{side.name}</th>
                {table.rows[side.key].map((value, index) => (
                  <td key={index} data-changed={table.rows.changed[index] || undefined}>
                    {value}
                    {side.key === "after" && table.rows.changed[index] && (
                      <span className="sr-only"> · {text("Đã đổi", "Changed")}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.shares.length > 0 && (
        <dl className="wiki-change-shares">
          {table.shares.map((share) => (
            <div key={share.key}>
              <dt>{share.name}</dt>
              <dd>
                {share.before === share.after ? share.after : <Shift before={share.before} after={share.after} />}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}

function ChangeRow({ change, skill, marked }: { change: HeroChangeItem; skill?: PublicSkill; marked: boolean }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [byLevel, setByLevel] = useState(false)
  const valueKey = change.fieldKey ?? change.statKey
  // A note about the hero as a whole has no name of its own; its sentence says everything.
  const label = valueKey
    ? changeFieldLabel(valueKey, locale)
    : (writtenForReaders(change.mechanicKey) ??
      (change.type === "HERO_OTHER_CHANGE" ? null : text("Cơ chế", "Mechanic")))
  // A hero without a public profile has no skill record, but the key still tells the slot and so the number of levels.
  const rankSkill = skill ?? (change.skillKey ? { skillKey: change.skillKey, kind: "ACTIVE" } : undefined)
  const read = valueKey && label ? readChangeValues(change, rankSkill, label, locale) : null
  const table = read?.view === "levels" || byLevel ? read?.table : undefined
  const mark = marked && change.changeKind !== "OTHER" ? <ChangeKind kind={change.changeKind} /> : null

  const values =
    read && label ? (
      table ? (
        <LevelView label={label} table={table} />
      ) : (
        read.view === "pair" && <ValuePair before={read.before} after={read.after} />
      )
    ) : null
  // A value that grows by skill level reads as one line first; its table opens on request.
  const toggle = read?.view === "pair" && read.table && (
    <button
      type="button"
      className="wiki-rank-toggle"
      aria-pressed={byLevel}
      aria-label={`${text("Bảng theo cấp chiêu", "Table by ability level")}: ${label}`}
      onClick={() => setByLevel(!byLevel)}
    >
      <WikiIcon name="table" size={14} />
      {text("Theo cấp", "By level")}
    </button>
  )

  // A note with no name of its own carries its mark at the start of its sentence instead of on a line above it.
  const markInSentence = !label && !!change.description
  return (
    <li>
      {(label || (mark && !markInSentence) || toggle) && (
        <div className="wiki-change-head">
          <div className="wiki-change-title">
            {label && <strong>{label}</strong>}
            {!markInSentence && mark}
          </div>
          {toggle}
        </div>
      )}
      {change.description && (
        <p>
          {markInSentence && mark}
          {change.description}
        </p>
      )}
      {values}
    </li>
  )
}

/** How much of a change set shows before it is cut short: a few fields of one ability. */
const previewHeight = () => (window.matchMedia("(max-width: 640px)").matches ? 420 : 440)

/** A set only this much over the limit is not worth hiding the end of. */
const FOLD_SLACK = 160

/** Changes show right away. A long set is cut short, with a way to read the rest. */
export function ChangeDisclosure({
  count,
  open,
  onToggle,
  onLongChange,
  children,
}: {
  count: number
  open: boolean
  onToggle: () => void
  /** Told whether the set is long enough to be cut, so a page can offer to open every long set at once. */
  onLongChange?: (long: boolean) => void
  children: ReactNode
}) {
  const { locale } = useWikiContext()
  const contentId = useId()
  const content = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const [long, setLong] = useState(false)
  const report = useRef(onLongChange)

  useEffect(() => {
    report.current = onLongChange
  })

  useLayoutEffect(() => {
    const inner = content.current?.firstElementChild
    if (!inner) return
    const measure = () => setLong(inner.getBoundingClientRect().height > previewHeight() + FOLD_SLACK)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    report.current?.(long)
  }, [long])

  const clipped = long && !open
  return (
    <>
      <div
        ref={content}
        id={contentId}
        className="wiki-change-detail"
        data-clipped={clipped || undefined}
        style={clipped ? { maxHeight: previewHeight() } : undefined}
        // Moving through the page by keyboard must not land on something hidden by the cut.
        onFocus={(event) => {
          if (clipped && event.target.matches(":focus-visible")) onToggle()
        }}
      >
        <div className="wiki-change-detail-inner">{children}</div>
      </div>
      {long && (
        <button
          ref={toggle}
          type="button"
          className="wiki-change-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => {
            onToggle()
            // Collapsing a long set should not leave the reader far below where it now ends.
            if (open) requestAnimationFrame(() => toggle.current?.scrollIntoView({ block: "nearest" }))
          }}
        >
          <WikiIcon name="chevron" size={16} />
          {open
            ? wikiText(locale, "Thu gọn", "Show less")
            : count > 1
              ? wikiText(locale, `Xem tất cả ${count} thay đổi`, `Show all ${count} changes`)
              : wikiText(locale, "Xem thêm", "Show more")}
        </button>
      )}
    </>
  )
}

/** Where a skill sits in the kit: the passive first, then the skills by slot. Other keys keep their order after them. */
function kitOrder(key: string) {
  if (key === "passive" || key === "capture-passive") return 0
  const slot = /^(?:capture-)?skill-(\d+)/.exec(key)?.[1]
  return slot === undefined ? Number.MAX_SAFE_INTEGER : Number(slot)
}

/** The changes of one change set: each skill keeps its fields together under its own heading, other changes follow. */
export function ChangeList({
  changes,
  hero,
  skillAction,
  overallKind,
}: {
  changes: HeroChangeItem[]
  /** Supplies skill names and artwork; without it, skills fall back to their slot. */
  hero?: HeroDetail
  /** Shown beside a skill's heading, such as a way to its full description. */
  skillAction?: (skillKey: string, skill?: PublicSkill) => ReactNode
  /** The kind already shown for the whole set. When every change is of that kind, none repeats it. */
  overallKind?: string | null
}) {
  const { locale } = useWikiContext()
  if (!changes.length) return null

  const groups = new Map<string, HeroChangeItem[]>()
  for (const change of changes) {
    const key = change.skillKey ?? ""
    groups.set(key, [...(groups.get(key) ?? []), change])
  }
  const ordered = [...groups].sort(([a], [b]) => kitOrder(a) - kitOrder(b))
  const skills = hero?.content.skills?.skills ?? []
  const marked = !overallKind || changes.some((change) => change.changeKind !== overallKind)

  return (
    <ul className="wiki-change-groups">
      {ordered.map(([key, rows]) => {
        const skill = skills.find((candidate) => candidate.skillKey === key)
        const title = [changeSkillLabel(key, locale), skill?.name].filter(Boolean).join(" · ")
        return (
          <li key={key || "other"} className="wiki-change-group">
            {key && (
              <div className="wiki-change-group-head">
                <h4>
                  {hero && skill && (
                    <span className="wiki-change-skill-art">
                      <SkillIcon hero={hero} skill={skill} locale={locale} />
                    </span>
                  )}
                  {title || wikiText(locale, "Kỹ năng", "Ability")}
                </h4>
                {skillAction?.(key, skill)}
              </div>
            )}
            <ul className="wiki-change-list">
              {rows.map((change) => (
                <ChangeRow key={change.id} change={change} skill={skill} marked={marked} />
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
