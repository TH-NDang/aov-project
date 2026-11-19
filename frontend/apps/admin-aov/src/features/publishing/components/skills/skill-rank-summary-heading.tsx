import { Info } from "lucide-react"
import { AdminTermHint } from "../../../terminology/catalog"

export function SkillRankSummaryHeading({ locale }: { locale?: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      Tổng quan
      <AdminTermHint termId="thong-so-theo-cap-chieu" locale={locale}>
        <button
          type="button"
          aria-label="Cách đọc thông số theo cấp chiêu"
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Info className="size-4" aria-hidden="true" />
        </button>
      </AdminTermHint>
    </span>
  )
}
