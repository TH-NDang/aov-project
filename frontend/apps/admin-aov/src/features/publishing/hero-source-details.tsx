import { AlertTriangle, ChevronDown, Clock3, Droplets, ExternalLink } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { AdminEntityText } from "../terminology/catalog"
import type { Skill } from "./types"
import { sourceHttpUrl, sourceReviewNotes } from "./hero-source-review"

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
const records = (value: unknown): RecordValue[] =>
  Array.isArray(value) ? value.map(record).filter((item): item is RecordValue => item !== null) : []
const text = (value: unknown): string => (typeof value === "string" ? value : "")

function snapshot(skill: Skill) {
  return skill.effects.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata ?? null
}

export function heroReviewNotes(skills: Skill[]): string[] {
  return sourceReviewNotes(
    skills.flatMap((skill) => [...records(snapshot(skill)?.heroReviewFlags), ...records(snapshot(skill)?.reviewFlags)]),
  )
}

export function SkillSourceDetails({ skill, collapseSources = false }: { skill: Skill; collapseSources?: boolean }) {
  const source = snapshot(skill)
  if (!source) return null
  const cooldown = record(source.cooldown)
  const energy = record(source.energyCost)
  const cooldownText =
    text(cooldown?.display) || (typeof cooldown?.seconds === "number" ? `Hồi chiêu: ${cooldown.seconds} giây` : "")
  const energyText = text(energy?.display) || (typeof energy?.value === "number" ? `Tiêu hao: ${energy.value}` : "")
  const table = record(source.levelTable)
  const columns = strings(table?.column_labels)
  const rows = records(table?.rows)
  const notes = sourceReviewNotes(source.reviewFlags)
  const sourceImageUrl = sourceHttpUrl(source.sourceImageUrl)
  const tags = strings(source.tags)
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
      {(cooldownText || energyText || tags.length > 0) && (
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
          {tags.map((tag, index) => (
            <Badge key={index} variant="outline">
              <AdminEntityText text={tag} />
            </Badge>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div
          className="max-w-full overflow-x-auto rounded-lg border"
          tabIndex={0}
          aria-label={`Thông số theo cấp kỹ năng ${skill.skillKey}`}
        >
          <table className="w-full border-collapse text-left text-xs tabular-nums">
            <caption className="sr-only">Thông số theo cấp chiêu, giữ nguyên nhãn từ nguồn.</caption>
            <thead>
              <tr className="border-b bg-muted/40">
                <th scope="col" className="sticky left-0 z-10 min-w-32 bg-muted px-3 py-2.5 font-medium">
                  Thông số
                </th>
                {columns.map((column, index) => (
                  <th scope="col" key={index} className="min-w-16 px-3 py-2.5 text-center font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b last:border-0">
                  <th scope="row" className="sticky left-0 bg-card px-3 py-2.5 font-medium">
                    <span className="flex items-center gap-2">
                      {text(row.label) || "Chưa có nhãn"}
                      {row.review_required === true && (
                        <span title="Nhãn và giá trị cần đối chiếu nguồn">
                          <AlertTriangle className="size-3 shrink-0 text-amber-600" />
                          <span className="sr-only">Cần đối chiếu</span>
                        </span>
                      )}
                    </span>
                  </th>
                  {strings(row.display_values).map((value, cell) => (
                    <td key={cell} className="px-3 py-2.5 text-center">
                      <AdminEntityText text={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
