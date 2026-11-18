import type { components } from "../../generated/hero-api"

export type ComparisonWarning = components["schemas"]["HeroComparisonWarning"]

/** What the snapshot comparison says for each warning code; the server sends the code only. */
const WARNING_TEXT = {
  NO_EARLIER_SNAPSHOT:
    "Bản đầu tiên ghi lại trạng thái tướng tại một thời điểm. Khi bổ sung bản của mùa hoặc patch trước, bạn có thể chọn làm bản đối chiếu.",
  SNAPSHOT_DIFFERENCE_UNPROVEN:
    "Khác biệt giữa hai bản chưa cho biết patch nào gây ra. Kiểm tra nguồn trước khi ghi changelog.",
} satisfies Record<ComparisonWarning["code"], string>

/** A code the server sends before Admin knows it shows the code itself rather than nothing. */
export function comparisonWarningText(warning: ComparisonWarning): string {
  const text: string | undefined = WARNING_TEXT[warning.code]
  return text ?? warning.code
}
