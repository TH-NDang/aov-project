import { useId, type ReactNode } from "react"
import { Swords } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { selectSkillTranslation, skillLabel, skillVariantLabel } from "./hero-skills"
import { SkillArtwork } from "./skill-artwork"
import type { Skill } from "./types"

/** Group by exact skill identity at its first occurrence, preserving the order of fields and standalone rows. */
export function SkillChangeList<T>({
  entries,
  skillKeyOf,
  skills = [],
  locale,
  heroId,
  className,
  renderRow,
  groupAction,
}: {
  entries: T[]
  skillKeyOf: (entry: T) => string | undefined
  skills?: Skill[]
  locale: string
  heroId?: string
  className?: string
  renderRow: (entry: T, skill?: Skill) => ReactNode
  groupAction?: (skillKey: string) => ReactNode
}) {
  const listId = useId()
  const groups: { skillKey?: string; entries: T[] }[] = []
  const members = new Map<string, T[]>()
  for (const entry of entries) {
    const skillKey = skillKeyOf(entry)
    const existing = skillKey && members.get(skillKey)
    if (existing) existing.push(entry)
    else {
      const group = [entry]
      groups.push({ skillKey, entries: group })
      if (skillKey) members.set(skillKey, group)
    }
  }
  return (
    <ul className={cn("min-w-0 space-y-2", className)}>
      {groups.map((group) => {
        if (!group.skillKey) return renderRow(group.entries[0])
        const key = group.skillKey
        const skill = skills.find((s) => s.skillKey === key)
        const match = /^(?:capture-)?skill-(\d+)(?:-(\d+))?$/.exec(key)
        const slot = skill
          ? skillLabel(skill)
          : key === "passive" || key === "capture-passive" || match?.[1] === "0"
            ? "Nội tại"
            : match
              ? `Chiêu ${match[1]}`
              : "Kỹ năng chưa xác định"
        const name = skill && selectSkillTranslation(skill, locale)?.name
        const form = skill
          ? skill.formKey || skillVariantLabel(skill, skills)
          : match?.[2]
            ? `Biến thể ${match[2]}`
            : null
        const titleId = `${listId}-${encodeURIComponent(key)}`
        return (
          <li key={`skill:${key}`} className="min-w-0 overflow-hidden rounded-lg border">
            <section aria-labelledby={titleId}>
              <header className="flex items-center gap-2.5 bg-muted/40 px-3 py-2">
                {skill ? (
                  <SkillArtwork skill={skill} heroId={heroId} className="size-9" preview />
                ) : (
                  <Swords aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                )}
                <h4 id={titleId} className="type-section-title min-w-0 break-words">
                  {[slot, name, form].filter(Boolean).join(" · ")}
                </h4>
              </header>
              <ul className="mx-3 divide-y">{group.entries.map((entry) => renderRow(entry, skill))}</ul>
              {groupAction && <div className="px-3 pb-2">{groupAction(key)}</div>}
            </section>
          </li>
        )
      })}
    </ul>
  )
}
