import type { components } from "../../generated/hero-api"

export type ImportWarning = components["schemas"]["HeroImportWarning"]

/** What the import review says for each warning code of a preview; the server sends the code and its parameters. */
const WARNING_TEXT = {
  MISSING_ROLES: () => "Cần bổ sung trước khi xuất bản: vai trò tướng.",
  MISSING_SKILL_DESCRIPTION: ({ skillKey, locale }) =>
    `Cần bổ sung trước khi xuất bản: mô tả kỹ năng ${skillKey} (${locale}).`,
  STALE_SKILL_SUMMARY: ({ skillKey, locale }) =>
    `Cần xem lại tóm tắt kỹ năng ${skillKey} (${locale}): mô tả đã đổi, tóm tắt cũ được giữ nguyên.`,
  SKILL_SOURCE_NEEDS_REVIEW: ({ skillKey }) =>
    `Cần kiểm tra nguồn kỹ năng ${skillKey}: dữ liệu thu thập còn cảnh báo; không tự suy đoán nội dung bị thiếu.`,
  NO_SNAPSHOT_TO_CORRECT: () => "Chưa có mốc dữ liệu tại patch này để sửa. Hãy nhập dữ liệu ban đầu.",
  NO_EARLIER_SNAPSHOT: () =>
    "Chưa có mốc trước patch này để so sánh. Hãy nhập dữ liệu ban đầu; không suy ngược từ tương lai.",
  BASELINE_IS_KNOWN_STATE: () =>
    "Đây là trạng thái đã biết tại patch đã chọn, không phải xác nhận tướng mới ra mắt hay vừa được cập nhật.",
  SNAPSHOT_DIFFERENCE_UNPROVEN: () =>
    "Khác biệt giữa các mốc chưa chứng minh game thay đổi ở patch này. Kiểm tra nguồn trước khi ghi changelog; hệ thống không tự tạo changelog.",
} satisfies Record<ImportWarning["code"], (warning: ImportWarning) => string>

/** A code the server sends before Admin knows it shows the code itself rather than nothing. */
export function importWarningText(warning: ImportWarning): string {
  const text: ((warning: ImportWarning) => string) | undefined = WARNING_TEXT[warning.code]
  return text ? text(warning) : warning.code
}

/** Two warnings of one row differ by code, skill or language. */
export const importWarningKey = (warning: ImportWarning) =>
  [warning.code, warning.skillKey ?? "", warning.locale ?? ""].join(":")
