import { useState, type ReactNode } from "react"
import { AlertTriangle, ChevronDown, Clock3, Droplets, ExternalLink, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { AdminEntityText } from "../terminology/catalog"
import type { Skill } from "./types"
import { heroReviewItems, sourceHttpUrl, sourceReviewNotes } from "./hero-source-review"
import { hasRankFormula, skillSourceTable } from "./skill-rank-values"
import { SkillTagsEditor, SkillTableEditor } from "./skill-source-editor"
import { SkillRankSummaryHeading } from "./skill-rank-summary-heading"
import {
  COOLDOWN_COLOR,
  ENERGY_COLOR,
  SkillCostField,
  costNumber,
  costSeconds,
  type CostField,
  type CostStyle,
} from "./skill-cost-fields"

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
const text = (value: unknown): string => (typeof value === "string" ? value : "")

function snapshot(skill: Skill) {
  return skill.effects.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata ?? null
}

export function heroReviewNotes(skills: Skill[]): string[] {
  return [...new Set(heroReviewItems(skills).map((item) => item.note))]
}

/** What the skill costs, written on its source, unless its rank table already shows the cooldown formula. */
function skillCosts(skill: Skill) {
  const source = snapshot(skill)
  const cooldown = record(source?.cooldown)
  const energy = record(source?.energyCost)
  const rawCooldown =
    text(cooldown?.display) || (typeof cooldown?.seconds === "number" ? `Hồi chiêu: ${cooldown.seconds} giây` : "")
  return {
    cooldownText: skillSourceTable(skill).derived && hasRankFormula(rawCooldown) ? "" : rawCooldown,
    energyText: text(energy?.display) || (typeof energy?.value === "number" ? `Tiêu hao: ${energy.value}` : ""),
  }
}

/** A skill's cost and traits as loose badges, for a row of its own or beside the skill's name. */
export function SkillSourceBadges({ skill, showTags = true }: { skill: Skill; showTags?: boolean }) {
  const { cooldownText, energyText } = skillCosts(skill)
  const tags = showTags ? strings(snapshot(skill)?.tags) : []
  return (
    <>
      {cooldownText && (
        <Badge variant="secondary" className="gap-1.5">
          <Clock3 className="size-3" />
          <AdminEntityText text={cooldownText} />
        </Badge>
      )}
      {energyText && (
        <Badge variant="secondary" className="gap-1.5">
          <Droplets className="size-3" />
          <AdminEntityText text={energyText} />
        </Badge>
      )}
      {tags.map((tag, index) => (
        <Badge key={index} variant="outline">
          <AdminEntityText text={tag} />
        </Badge>
      ))}
    </>
  )
}

export function SkillSourceDetails({
  skill,
  collapseSources = false,
  locale = "vi-VN",
  onChange,
  showBadges = true,
  children,
  costStyles,
  onCostStyle,
}: {
  skill: Skill
  collapseSources?: boolean
  locale?: string
  onChange?: (effects: Skill["effects"]) => void
  /** Off when the page already shows the badges beside the skill's name. */
  showBadges?: boolean
  /** Goes between the rank table and where the data came from. */
  children?: ReactNode
  /** The hero's shared label and colour for each cost line, used where this skill has none yet. */
  costStyles?: Partial<Record<CostField, CostStyle>>
  /** Applies a label or colour to the line in every skill of the hero. */
  onCostStyle?: (field: CostField, style: CostStyle) => void
}) {
  const [tableOpen, setTableOpen] = useState(false)
  const source = snapshot(skill)
  function updateSource(change: RecordValue) {
    const index = skill.effects.findIndex((effect) => effect.effectType === "SOURCE_SNAPSHOT")
    const next = { effectType: "SOURCE_SNAPSHOT", metadata: { ...source, ...change } }
    onChange?.(
      index < 0
        ? [...skill.effects, next]
        : skill.effects.map((effect, i) => (i === index ? { ...effect, ...next } : effect)),
    )
  }
  if (!onChange && !source && !children) return null
  const { cooldownText, energyText } = skillCosts(skill)
  const { columns, rows } = skillSourceTable(skill)
  const notes = sourceReviewNotes(source?.reviewFlags ?? source?.review_flags)
  const sourceImageUrl = sourceHttpUrl(source?.sourceImageUrl)
  const tags = strings(source?.tags)
  const provenance = (
    <>
      {notes.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">
          {notes.map((note) => (
            <p key={note} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
              {note}
            </p>
          ))}
        </div>
      )}
      {sourceImageUrl && (
        <a
          href={sourceImageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          Xem ảnh chụp nguồn
        </a>
      )}
    </>
  )
  return (
    <div className="space-y-4">
      {showBadges && !onChange && (cooldownText || energyText || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <SkillSourceBadges skill={skill} />
        </div>
      )}
      {onChange && (
        <>
          <p className="type-meta">Đặc tính và thông số dùng chung cho các ngôn ngữ của chiêu.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SkillCostField
              title="Hồi chiêu"
              display={text(record(source?.cooldown)?.display)}
              labels={["H.chiêu"]}
              defaultLabel={costStyles?.cooldown?.label || "H.chiêu"}
              color={costStyles?.cooldown?.color ?? COOLDOWN_COLOR}
              onStyleChange={onCostStyle && ((style) => onCostStyle("cooldown", style))}
              valuePlaceholder="10s"
              onChange={(display, cost) => {
                const seconds = cost ? costSeconds(cost.value) : null
                updateSource({
                  cooldown: display
                    ? {
                        ...record(source?.cooldown),
                        display,
                        ...(cost ? { label: cost.label || undefined, seconds: seconds ?? undefined } : {}),
                      }
                    : undefined,
                })
              }}
            />
            <SkillCostField
              title="Tiêu hao"
              display={text(record(source?.energyCost)?.display)}
              labels={["N.lượng", "Nội năng cần", "Hao máu", "Máu dùng"]}
              defaultLabel={costStyles?.energyCost?.label || "N.lượng"}
              color={costStyles?.energyCost?.color ?? ENERGY_COLOR}
              onStyleChange={onCostStyle && ((style) => onCostStyle("energyCost", style))}
              valuePlaceholder="40"
              onChange={(display, cost) => {
                const value = cost ? costNumber(cost.value) : null
                updateSource({
                  energyCost: display
                    ? {
                        ...record(source?.energyCost),
                        display,
                        ...(cost ? { label: cost.label || undefined, value: value ?? undefined } : {}),
                      }
                    : undefined,
                })
              }}
            />
          </div>
          <SkillTagsEditor tags={tags} locale={locale} onChange={(tags) => updateSource({ tags })} />
        </>
      )}
      {onChange && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="type-label">Thông số theo cấp chiêu</h4>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={tableOpen}
            onClick={() => setTableOpen(!tableOpen)}
          >
            <Pencil className="size-3.5" /> {tableOpen ? "Xem bảng" : rows.length ? "Sửa bảng" : "Thêm bảng"}
          </Button>
        </div>
      )}
      {tableOpen && onChange ? (
        <SkillTableEditor
          skill={skill}
          table={record(source?.levelTable) ?? {}}
          onChange={(levelTable) => updateSource({ levelTable })}
        />
      ) : (
        rows.length > 0 && (
          <div
            className="max-w-full overflow-x-auto rounded-lg border"
            tabIndex={0}
            aria-label={`Thông số theo cấp kỹ năng ${skill.skillKey}`}
          >
            <table className="w-full border-collapse text-left text-xs tabular-nums">
              <caption className="sr-only">Thông số theo cấp chiêu</caption>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th scope="col" className="sticky left-0 z-10 min-w-28 bg-muted px-3 py-2.5 font-medium">
                    Thông số
                  </th>
                  {columns.map((column, index) => (
                    <th scope="col" key={index} className="min-w-12 px-2 py-2.5 text-center font-medium">
                      {column}
                    </th>
                  ))}
                  {columns.length > 1 && (
                    <th scope="col" className="min-w-36 border-l px-3 py-2.5 font-medium">
                      <SkillRankSummaryHeading locale={locale} />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <th scope="row" className="sticky left-0 bg-card px-3 py-2.5 font-medium">
                      <span className="flex items-center gap-2">
                        {row.label}
                        {row.reviewRequired && (
                          <span title="Nhãn và giá trị cần đối chiếu nguồn">
                            <AlertTriangle className="size-3 shrink-0 text-amber-600" />
                            <span className="sr-only">Cần đối chiếu</span>
                          </span>
                        )}
                      </span>
                    </th>
                    {row.values.map((value, cell) => (
                      <td
                        key={cell}
                        colSpan={row.values.length === 1 ? Math.max(1, columns.length) : undefined}
                        className="px-2 py-2.5 text-center"
                      >
                        <AdminEntityText text={value ?? "—"} />
                      </td>
                    ))}
                    {columns.length > 1 && (
                      <td className="min-w-36 border-l bg-muted/15 px-3 py-2.5">
                        <AdminEntityText text={row.summary ?? "—"} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {children}
      {collapseSources && (notes.length > 0 || sourceImageUrl) ? (
        <details data-review-source className="group/source border-t pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
            {notes.length > 0 ? (
              <AlertTriangle className="size-3.5 text-amber-600" />
            ) : (
              <ExternalLink className="size-3.5" />
            )}
            Nguồn & đối chiếu{notes.length > 0 ? ` · ${notes.length} ghi chú` : ""}
            <ChevronDown className="ml-auto size-3.5 transition-transform group-open/source:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3">{provenance}</div>
        </details>
      ) : (
        provenance
      )}
    </div>
  )
}
