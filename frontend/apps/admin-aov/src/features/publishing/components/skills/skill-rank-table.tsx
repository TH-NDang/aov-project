import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { AdminEntityText } from "../../../terminology/catalog"
import {
  rankFieldLabel,
  rankPartLabel,
  type RankComparison,
  type RankPart,
  type RankPartsComparison,
} from "@aov/ui/lib/skill-rank-values"
import { SkillRankSummaryHeading } from "./skill-rank-summary-heading"

export function SkillRankComparison({ data, label, locale }: { data: RankComparison; label: string; locale?: string }) {
  const [detailed, setDetailed] = useState(true)
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="type-meta">Theo cấp chiêu</span>
        <button
          type="button"
          className="type-meta min-h-8 rounded-md px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setDetailed(!detailed)}
          aria-label={`${detailed ? "Xem tóm tắt" : "Xem bảng chi tiết"} ${label}`}
        >
          {detailed ? "Tóm tắt" : "Bảng chi tiết"}
        </button>
      </div>
      {detailed ? (
        <div
          className="max-w-full overflow-x-auto rounded-lg border"
          tabIndex={0}
          role="region"
          aria-label={`Bảng theo cấp: ${label}`}
        >
          <table className="w-full border-collapse text-left text-xs tabular-nums">
            <caption className="sr-only">{label}: trước và sau theo từng cấp chiêu</caption>
            <thead>
              <tr className="border-b bg-muted/40">
                <th scope="col" className="sticky left-0 z-10 min-w-28 bg-muted px-3 py-2.5 font-medium">
                  {rankFieldLabel(label)}
                </th>
                {data.columns.map((column) => (
                  <th scope="col" key={column} className="min-w-12 px-2 py-2.5 text-center font-medium">
                    {column}
                  </th>
                ))}
                <th scope="col" className="min-w-36 border-l px-3 py-2.5 font-medium">
                  <SkillRankSummaryHeading locale={locale} />
                </th>
              </tr>
            </thead>
            <tbody>
              {(["before", "after"] as const).map((side) => (
                <tr key={side} className="border-b last:border-0">
                  <th scope="row" className="sticky left-0 bg-card px-3 py-3 font-medium">
                    {side === "before" ? "Trước" : "Sau"}
                  </th>
                  {data[side].map((value, index) => (
                    <td
                      key={index}
                      data-rank-changed={data.changed[index] || undefined}
                      className={cn(
                        "px-2 py-3 text-center align-top",
                        data.changed[index] && (side === "before" ? "bg-(--aov-warning-soft)" : "bg-(--aov-info-soft)"),
                      )}
                    >
                      {value === null ? (
                        <span className="text-muted-foreground">
                          —<span className="sr-only">Chưa ghi nhận</span>
                        </span>
                      ) : (
                        <AdminEntityText text={value} />
                      )}
                      {side === "after" && data.changed[index] && <span className="sr-only"> · Đã đổi</span>}
                    </td>
                  ))}
                  <td className="min-w-36 border-l bg-muted/15 px-3 py-3 align-top">
                    <AdminEntityText text={data.summary[side] ?? "—"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="type-body grid gap-2">
          <p>
            <span className="text-muted-foreground">Trước: </span>
            <AdminEntityText text={data.summary.before ?? "—"} />
          </p>
          <p>
            <span className="text-muted-foreground">Sau: </span>
            <AdminEntityText text={data.summary.after ?? "—"} />
          </p>
        </div>
      )}
    </div>
  )
}

/** One cell per rank, or a single cell across them when every rank has the same value. */
function RankCells({
  values,
  changed,
  side,
}: {
  values: (string | null)[]
  changed: boolean[]
  side: "before" | "after" | "same"
}) {
  const tone = (on: boolean) =>
    on && (side === "before" ? "bg-(--aov-warning-soft)" : side === "after" ? "bg-(--aov-info-soft)" : "")
  const value = (text: string | null) =>
    text === null ? (
      <span className="text-muted-foreground">
        —<span className="sr-only">Chưa ghi nhận</span>
      </span>
    ) : (
      text
    )
  if (values.length > 1 && values.every((item) => item !== null && item === values[0]))
    return (
      <td colSpan={values.length} className={cn("px-2 py-2.5 text-center", tone(changed.some(Boolean)))}>
        {value(values[0])} <span className="text-muted-foreground">· mọi cấp</span>
      </td>
    )
  return values.map((item, index) => (
    <td
      key={index}
      data-rank-changed={changed[index] || undefined}
      className={cn("px-2 py-2.5 text-center", tone(changed[index]))}
    >
      {value(item)}
    </td>
  ))
}

/**
 * A formula's change as plain numbers: one block per number it is made of (its base, then each stat share), each with
 * a before row and an after row. A number that did not change takes a single row.
 */
export function SkillRankPartsComparison({
  data,
  label,
  locale,
}: {
  data: RankPartsComparison
  label: string
  locale?: string
}) {
  const [detailed, setDetailed] = useState(true)
  const name = (part: RankPart) => rankPartLabel(part.key, label)

  if (!data.columns.length)
    // No rank columns: each number reads on one line, before and after.
    return (
      <ul className="type-body grid gap-1 tabular-nums">
        {data.parts.map((part) => (
          <li key={part.key} className="flex flex-wrap items-center gap-x-2">
            <span className="text-muted-foreground">{name(part)}</span>
            {part.changed.some(Boolean) ? (
              <>
                <span className="text-muted-foreground">{part.before[0] ?? "—"}</span>
                <ArrowRight aria-label="thành" className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{part.after[0] ?? "—"}</span>
              </>
            ) : (
              <span>{part.after[0] ?? "—"} · không đổi</span>
            )}
          </li>
        ))}
      </ul>
    )

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="type-meta">Theo cấp chiêu</span>
        <button
          type="button"
          className="type-meta min-h-8 rounded-md px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setDetailed(!detailed)}
          aria-label={`${detailed ? "Xem tóm tắt" : "Xem bảng chi tiết"} ${label}`}
        >
          {detailed ? "Tóm tắt" : "Bảng chi tiết"}
        </button>
      </div>
      {detailed ? (
        <div
          className="max-w-full overflow-x-auto rounded-lg border"
          tabIndex={0}
          role="region"
          aria-label={`Bảng theo cấp: ${label}`}
        >
          <table className="w-full border-collapse text-left text-xs tabular-nums">
            <caption className="sr-only">{label}: từng thông số, trước và sau theo cấp chiêu</caption>
            <thead>
              <tr className="border-b bg-muted/40">
                <th scope="col" className="sticky left-0 z-10 min-w-32 bg-muted px-3 py-2.5 font-medium">
                  {rankFieldLabel(label)}
                </th>
                <th scope="col" className="px-2 py-2.5">
                  <span className="sr-only">Trước hay sau</span>
                </th>
                {data.columns.map((column) => (
                  <th scope="col" key={column} className="min-w-12 px-2 py-2.5 text-center font-medium">
                    {column}
                  </th>
                ))}
                <th scope="col" className="min-w-32 border-l px-3 py-2.5 font-medium">
                  <SkillRankSummaryHeading locale={locale} />
                </th>
              </tr>
            </thead>
            {data.parts.map((part) =>
              part.changed.some(Boolean) ? (
                <tbody key={part.key} className="border-b last:border-0">
                  {(["before", "after"] as const).map((side) => (
                    <tr key={side}>
                      {side === "before" && (
                        <th
                          scope="rowgroup"
                          rowSpan={2}
                          className="sticky left-0 bg-card px-3 py-2.5 align-middle font-medium"
                        >
                          {name(part)}
                        </th>
                      )}
                      <th scope="row" className="px-2 py-2.5 font-normal text-muted-foreground">
                        {side === "before" ? "Trước" : "Sau"}
                      </th>
                      <RankCells values={part[side]} changed={part.changed} side={side} />
                      <td className="border-l bg-muted/15 px-3 py-2.5">{part.summary[side] ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              ) : (
                <tbody key={part.key} className="border-b last:border-0">
                  <tr>
                    <th scope="row" className="sticky left-0 bg-card px-3 py-2.5 font-medium">
                      {name(part)}
                    </th>
                    <td className="px-2 py-2.5 text-muted-foreground">Không đổi</td>
                    <RankCells values={part.after} changed={part.changed} side="same" />
                    <td className="border-l bg-muted/15 px-3 py-2.5">{part.summary.after ?? "—"}</td>
                  </tr>
                </tbody>
              ),
            )}
          </table>
        </div>
      ) : (
        <ul className="type-body grid gap-1.5">
          {data.parts.map((part) => (
            <li key={part.key}>
              <span className="text-muted-foreground">{name(part)}: </span>
              {part.changed.some(Boolean)
                ? `${part.summary.before ?? "—"} → ${part.summary.after ?? "—"}`
                : `${part.summary.after ?? "—"} (không đổi)`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SkillRankValues({
  columns,
  values,
  label,
  summary,
  locale,
  parts,
}: {
  columns: string[]
  values: (string | null)[]
  label: string
  summary: string | null
  locale?: string
  /** The numbers the value is made of; each takes a row of plain numbers instead of one row of formulas. */
  parts?: { key: RankPart["key"]; values: (string | null)[]; summary: string | null }[] | null
}) {
  const rows = parts?.length
    ? parts.map((part) => ({ label: rankPartLabel(part.key, label), values: part.values, summary: part.summary }))
    : [{ label: rankFieldLabel(label), values, summary }]
  return (
    <div
      className="max-w-full overflow-x-auto rounded-lg border"
      tabIndex={0}
      role="region"
      aria-label={`Thông số theo cấp: ${label}`}
    >
      <table className="w-full border-collapse text-left text-xs tabular-nums">
        <caption className="sr-only">{label} theo từng cấp chiêu</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="sticky left-0 z-10 min-w-28 bg-muted px-3 py-2.5 font-medium">
              Thông số
            </th>
            {columns.map((column) => (
              <th scope="col" key={column} className="min-w-12 px-2 py-2.5 text-center font-medium">
                {column}
              </th>
            ))}
            <th scope="col" className="min-w-36 border-l px-3 py-2.5 font-medium">
              <SkillRankSummaryHeading locale={locale} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="sticky left-0 bg-card px-3 py-3 font-medium">
                {row.label}
              </th>
              {parts?.length ? (
                <RankCells values={row.values} changed={[]} side="same" />
              ) : (
                row.values.map((value, index) => (
                  <td key={index} className="px-2 py-3 text-center">
                    <AdminEntityText text={value ?? "—"} />
                  </td>
                ))
              )}
              <td className="min-w-36 border-l bg-muted/15 px-3 py-3">
                <AdminEntityText text={row.summary ?? "—"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
