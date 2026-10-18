import type { components } from "./generated/hero-api"

export const IMPORT_STATUS: Record<components["schemas"]["HeroImportPlan"]["classification"], string> = {
  NEW_TO_CATALOG: "Chưa có trong kho",
  BASELINE: "Mốc dữ liệu bổ sung",
  CHANGED: "Có khác biệt",
  UNCHANGED: "Không đổi",
  INSUFFICIENT_DATA: "Thiếu mốc so sánh",
}

export function ImportValue({ value }: { value: unknown }) {
  if (value == null || value === "" || (Array.isArray(value) && !value.length))
    return <span className="text-muted-foreground">Chưa có dữ liệu</span>
  if (Array.isArray(value))
    return (
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li key={i} className="rounded-md border p-2">
            <ImportValue value={item} />
          </li>
        ))}
      </ul>
    )
  if (typeof value === "object")
    return (
      <dl className="space-y-1">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt className="text-xs font-medium text-muted-foreground">{key}</dt>
            <dd>
              <ImportValue value={item} />
            </dd>
          </div>
        ))}
      </dl>
    )
  return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{String(value)}</span>
}
