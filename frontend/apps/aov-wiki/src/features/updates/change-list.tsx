import { patchChangeLabel } from "../../components/patch-changes-row"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  changeFieldLabel,
  changeSkillLabel,
  formatChangeValue,
  type HeroChangeItem,
} from "../../lib/wiki-change-format"

const KIND_MARKS: Record<string, string> = {
  BUFF: "▲",
  NERF: "▼",
  ADJUSTMENT: "⇄",
  BALANCE: "⇄",
  REWORK: "✦",
  ADDED: "✦",
  REMOVED: "✕",
  FIX: "✓",
}

export function ChangeKind({ kind }: { kind?: string | null }) {
  const { locale } = useWikiContext()
  if (!kind) return null
  return (
    <span className="wiki-change-kind" data-kind={kind}>
      {KIND_MARKS[kind] && <i aria-hidden="true">{KIND_MARKS[kind]}</i>} {patchChangeLabel(kind, locale)}
    </span>
  )
}

/** Before and after values of one published change set, grouped by the skill they belong to. */
export function ChangeList({
  changes,
  skillName,
}: {
  changes: HeroChangeItem[]
  skillName?: (key: string) => string | null | undefined
}) {
  const { locale } = useWikiContext()
  if (!changes.length) return null
  return (
    <ul className="wiki-change-list">
      {changes.map((change) => {
        const skill = change.skillKey
          ? (skillName?.(change.skillKey) ?? changeSkillLabel(change.skillKey, locale))
          : null
        if (change.type === "HERO_MECHANIC_CHANGE" || !change.fieldKey) {
          return (
            <li key={change.id}>
              <div className="wiki-change-head">
                <strong>{skill ?? wikiText(locale, "Cơ chế", "Mechanic")}</strong>
                <ChangeKind kind={change.changeKind} />
              </div>
              {change.description && <p>{change.description}</p>}
            </li>
          )
        }
        return (
          <li key={change.id}>
            <div className="wiki-change-head">
              <strong>
                {skill && `${skill} · `}
                {changeFieldLabel(change.fieldKey, locale)}
              </strong>
              <ChangeKind kind={change.changeKind} />
            </div>
            <p className="wiki-change-values">
              <span className="wiki-change-old">{formatChangeValue(change.oldValue, locale)}</span>
              <span aria-label={wikiText(locale, "thành", "to")} className="wiki-change-arrow">
                →
              </span>
              <span>{formatChangeValue(change.newValue, locale)}</span>
            </p>
          </li>
        )
      })}
    </ul>
  )
}
