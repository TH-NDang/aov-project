import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { compareSkillRanks, rankFieldLabel, type RankComparison } from "@aov/ui/lib/skill-rank-values"
import { ChangeKindLabel } from "../../components/patch-changes-row"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  changeFieldLabel,
  changeSkillLabel,
  formatChangeValue,
  type HeroChangeItem,
} from "../../lib/wiki-change-format"
import type { HeroDetail, PublicSkill } from "../hero/hero-api"
import { SkillIcon } from "../hero/hero-skill-icon"

/** Values longer than this read better on their own lines than either side of an arrow. */
const LONG_VALUE = 40

const ENGLISH_RANK_TERMS: [RegExp, string][] = [
  [/Công vật lý cộng thêm/g, "bonus Attack Damage"],
  [/Công vật lý/g, "Attack Damage"],
  [/Công phép/g, "Ability Power"],
  [/Máu tối đa/g, "Max HP"],
  [/cấp chiêu/g, "ability level"],
  [/cấp tướng/g, "hero level"],
  [/Cấp (\d+)/g, "Lv $1"],
  // The shared reader writes decimals the Vietnamese way.
  [/(\d),(\d)/g, "$1.$2"],
]

/** Rank values are worded in Vietnamese by the shared formula reader. */
function rankText(value: string | null, locale: string) {
  if (!value) return "—"
  if (!locale.startsWith("en")) return value
  return ENGLISH_RANK_TERMS.reduce((text, [term, english]) => text.replace(term, english), value)
}

export function ChangeKind({ kind }: { kind?: string | null }) {
  if (!kind) return null
  return (
    <span className="wiki-change-kind" data-kind={kind}>
      <ChangeKindLabel kind={kind} />
    </span>
  )
}

/** A value that scales with skill level, before and after, one column per level. */
function RankTable({ data, label }: { data: RankComparison; label: string }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  // A table of formulas does not fit a phone, and a long formula in every cell takes several lines each anywhere, so both
  // start from the one-line summary.
  const [detailed, setDetailed] = useState(
    () =>
      !window.matchMedia("(max-width: 640px)").matches &&
      ![...data.before, ...data.after].some((value) => String(value ?? "").length > 16),
  )
  const sides = [
    { key: "before", name: text("Trước", "Before"), values: data.before, summary: data.summary.before },
    { key: "after", name: text("Sau", "After"), values: data.after, summary: data.summary.after },
  ]
  return (
    <div className="wiki-rank">
      <div className="wiki-rank-head">
        <span>{text("Theo cấp chiêu", "By ability level")}</span>
        <button
          type="button"
          aria-label={`${detailed ? text("Xem tóm tắt", "Show summary") : text("Xem bảng chi tiết", "Show table")} ${label}`}
          onClick={() => setDetailed(!detailed)}
        >
          {detailed ? text("Tóm tắt", "Summary") : text("Bảng chi tiết", "Table")}
        </button>
      </div>
      {detailed ? (
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
                <th scope="col">{rankFieldLabel(label)}</th>
                {data.columns.map((column) => (
                  <th scope="col" key={column}>
                    {rankText(column, locale)}
                  </th>
                ))}
                <th scope="col" className="wiki-rank-summary">
                  {text("Tổng quan", "Overview")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sides.map((side) => (
                <tr key={side.key} data-side={side.key}>
                  <th scope="row">{side.name}</th>
                  {side.values.map((value, index) => (
                    <td key={index} data-changed={data.changed[index] || undefined}>
                      {rankText(value, locale)}
                      {side.key === "after" && data.changed[index] && (
                        <span className="sr-only"> · {text("Đã đổi", "Changed")}</span>
                      )}
                    </td>
                  ))}
                  <td className="wiki-rank-summary">{rankText(side.summary, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <dl className="wiki-change-compare">
          {sides.map((side) => (
            <div key={side.key}>
              <dt>{side.name}</dt>
              <dd>{rankText(side.summary, locale)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function ChangeRow({ change, skill }: { change: HeroChangeItem; skill?: PublicSkill }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const valueKey = change.fieldKey ?? change.statKey
  const label = valueKey ? changeFieldLabel(valueKey, locale) : text("Cơ chế", "Mechanic")
  // A hero without a public profile has no skill record, but the key still tells the slot and so the number of levels.
  const rankSkill = skill ?? (change.skillKey ? { skillKey: change.skillKey, kind: "ACTIVE" } : undefined)
  const ranks = valueKey ? compareSkillRanks(change.oldValue, change.newValue, rankSkill, rankSkill) : null
  const before = formatChangeValue(change.oldValue, locale)
  const after = formatChangeValue(change.newValue, locale)

  let values: ReactNode = null
  if (ranks) values = <RankTable data={ranks} label={label} />
  else if (valueKey && (before.length > LONG_VALUE || after.length > LONG_VALUE))
    values = (
      <dl className="wiki-change-compare">
        <div>
          <dt>{text("Trước", "Before")}</dt>
          <dd>{before}</dd>
        </div>
        <div>
          <dt>{text("Sau", "After")}</dt>
          <dd>{after}</dd>
        </div>
      </dl>
    )
  else if (valueKey)
    values = (
      <p className="wiki-change-values">
        <span className="wiki-change-old">{before}</span>
        <span aria-label={text("thành", "to")} className="wiki-change-arrow">
          →
        </span>
        <span>{after}</span>
      </p>
    )

  return (
    <li>
      <div className="wiki-change-head">
        <strong>{label}</strong>
        <ChangeKind kind={change.changeKind} />
      </div>
      {change.description && <p>{change.description}</p>}
      {values}
    </li>
  )
}

/** How much of a change set shows at first: about a skill's worth, enough to tell what the set is about. */
const previewHeight = () => (window.matchMedia("(max-width: 640px)").matches ? 190 : 280)

/** Changes show right away. A long set is cut short, with a way to read the rest. */
export function ChangeDisclosure({
  count,
  open,
  onToggle,
  children,
}: {
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { locale } = useWikiContext()
  const contentId = useId()
  const content = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const [long, setLong] = useState(false)

  useLayoutEffect(() => {
    const inner = content.current?.firstElementChild
    if (!inner) return
    // A set only slightly over the limit is not worth hiding a few lines of.
    const measure = () => setLong(inner.getBoundingClientRect().height > previewHeight() + 60)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

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

/** The changes of one change set: each skill keeps its fields together under its own heading, other changes follow. */
export function ChangeList({
  changes,
  hero,
  skillAction,
}: {
  changes: HeroChangeItem[]
  /** Supplies skill names and artwork; without it, skills fall back to their slot. */
  hero?: HeroDetail
  /** Shown beside a skill's heading, such as a way to its full description. */
  skillAction?: (skillKey: string, skill?: PublicSkill) => ReactNode
}) {
  const { locale } = useWikiContext()
  if (!changes.length) return null

  const groups = new Map<string, HeroChangeItem[]>()
  for (const change of changes) {
    const key = change.skillKey ?? ""
    groups.set(key, [...(groups.get(key) ?? []), change])
  }
  const skills = hero?.content.skills?.skills ?? []

  return (
    <ul className="wiki-change-groups">
      {[...groups].map(([key, rows]) => {
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
                <ChangeRow key={change.id} change={change} skill={skill} />
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
