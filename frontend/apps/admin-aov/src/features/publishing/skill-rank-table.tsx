import { useState } from "react"
import { cn } from "@aov/ui/lib/utils"
import { AdminEntityText } from "../terminology/catalog"
import { rankFieldLabel, type RankComparison } from "./skill-rank-values"
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
                        data.changed[index] && (side === "before" ? "bg-amber-500/10" : "bg-sky-500/10"),
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

export function SkillRankValues({
  columns,
  values,
  label,
  summary,
  locale,
}: {
  columns: string[]
  values: (string | null)[]
  label: string
  summary: string | null
  locale?: string
}) {
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
        <tbody>
          <tr>
            <th scope="row" className="sticky left-0 bg-card px-3 py-3 font-medium">
              {rankFieldLabel(label)}
            </th>
            {values.map((value, index) => (
              <td key={index} className="px-2 py-3 text-center">
                <AdminEntityText text={value ?? "—"} />
              </td>
            ))}
            <td className="min-w-36 border-l bg-muted/15 px-3 py-3">
              <AdminEntityText text={summary ?? "—"} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
