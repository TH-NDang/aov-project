import { useState } from "react"
import { AlertTriangle, ChevronDown, Clock3, Droplets, ExternalLink, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { AdminEntityText } from "../terminology/catalog"
import type { Skill } from "./types"
import { heroReviewItems, sourceHttpUrl, sourceReviewNotes } from "./hero-source-review"
import { hasRankFormula, skillSourceTable } from "./skill-rank-values"
import { SkillTagsEditor, SkillTableEditor } from "./skill-source-editor"
import { SkillRankSummaryHeading } from "./skill-rank-summary-heading"

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

export function SkillSourceDetails({
  skill,
  collapseSources = false,
  locale = "vi-VN",
  onChange,
}: {
  skill: Skill
  collapseSources?: boolean
  locale?: string
  onChange?: (effects: Skill["effects"]) => void
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
  if (!onChange && !source) return null
  const cooldown = record(source?.cooldown)
  const energy = record(source?.energyCost)
  const rawCooldownText =
    text(cooldown?.display) || (typeof cooldown?.seconds === "number" ? `Hồi chiêu: ${cooldown.seconds} giây` : "")
  const energyText = text(energy?.display) || (typeof energy?.value === "number" ? `Tiêu hao: ${energy.value}` : "")
  const { columns, rows, derived } = skillSourceTable(skill)
  const cooldownText = derived && hasRankFormula(rawCooldownText) ? "" : rawCooldownText
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
      {(cooldownText || energyText || (!onChange && tags.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
          {!onChange &&
            tags.map((tag, index) => (
              <Badge key={index} variant="outline">
                <AdminEntityText text={tag} />
              </Badge>
            ))}
        </div>
      )}
      {onChange && (
        <>
          <p className="type-meta">Đặc tính và thông số dùng chung cho các ngôn ngữ của chiêu.</p>
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
      {collapseSources && (notes.length > 0 || sourceImageUrl) ? (
        <details className="group/source border-t pt-3">
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
