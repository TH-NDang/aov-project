import type { ReactNode } from "react"
import { wikiText } from "../../../context/wiki-context"
import "./skill-summary.css"

/** True when the skill has a summary to show. */
export const hasSkillSummary = (summary: string | null | undefined): summary is string => !!summary?.trim()

/**
 * The short plain text an editor wrote beside a skill's full description: what the skill does, for readers new to the
 * game. It renders nothing without a summary, so a page can place it unconditionally. `render` lets the page pass the
 * text through its own recognizer, so game terms in the summary get the same explanations as in the description.
 * `labelDescription` adds the heading for the full description that follows; leave it off when nothing follows.
 */
export function SkillSummary({
  summary,
  locale,
  render = (text) => text,
  labelDescription = false,
}: {
  summary: string | null | undefined
  locale: string
  render?: (text: string) => ReactNode
  labelDescription?: boolean
}) {
  if (!hasSkillSummary(summary)) return null
  return (
    <>
      <section className="wiki-skill-summary" data-slot="skill-summary">
        <h4>{wikiText(locale, "Tóm tắt", "Summary")}</h4>
        <p>{render(summary.trim())}</p>
      </section>
      {labelDescription && (
        <h4 className="wiki-skill-summary-next">{wikiText(locale, "Mô tả đầy đủ", "Full description")}</h4>
      )}
    </>
  )
}
