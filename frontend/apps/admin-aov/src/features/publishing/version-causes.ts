/**
 * Why a version exists, in plain words shared by the hero page and the warehouse sheets, so one cause reads the same
 * everywhere. `note` says what the name means, for the place that has room for one line.
 */
const causes = {
  DATA_BASELINE: {
    name: "Nhập dữ liệu",
    note: "Số liệu lấy từ game hoặc nguồn tham khảo, không phải thay đổi do patch.",
  },
  GAME_PATCH: { name: "Cập nhật theo patch", note: "Số liệu đổi vì game ra patch." },
  CONTENT_CORRECTION: { name: "Sửa nội dung", note: "Sửa lỗi hoặc bổ sung nội dung; gameplay giữ nguyên." },
  TRANSLATION: { name: "Cập nhật bản dịch", note: "Chỉ đổi bản dịch." },
  TRANSLATION_UPDATE: { name: "Cập nhật bản dịch", note: "Chỉ đổi bản dịch." },
  IMPORT_CORRECTION: {
    name: "Sửa dữ liệu đã nhập",
    note: "Sửa chỗ nhập sai từ nguồn, không phải thay đổi do patch.",
  },
  VISUAL_UPDATE: { name: "Thay ảnh", note: "Đổi ảnh, giữ nguyên nội dung." },
  OTHER: { name: "Khác", note: "Thay đổi không thuộc các loại trên." },
} satisfies Record<string, { name: string; note: string }>

export type VersionCause = keyof typeof causes

export const VERSION_CAUSES: Record<VersionCause, { name: string; note: string }> = causes

export const CAUSE_NAMES = Object.fromEntries(
  Object.entries(causes).map(([cause, { name }]) => [cause, name]),
) as Record<VersionCause, string>
