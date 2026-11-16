import { imageTypeLabel } from "@/lib/image-types"
import type { BucketRole, CapacityLevel, SourceCategory } from "./files-api"

/** Names of the source file functions, as Admin shows them (ADR-030 section 4). */
export const CATEGORY_LABELS: Record<SourceCategory, string> = {
  HERO_CAPTURE: "Ảnh tướng theo patch",
  SHOP_CAPTURE: "Ảnh cửa hàng",
  BUILD_CAPTURE: "Ảnh build đề cử",
  RANKING_CAPTURE: "Ảnh xếp hạng",
  GAME_MODE_SOURCE: "Ảnh nguồn chế độ chơi",
  ESPORTS_SOURCE: "Nguồn thi đấu",
  IMPORT_DATA: "Dữ liệu nhập",
  ARCHIVE: "Lưu trữ",
}

export const CATEGORY_HINTS: Record<SourceCategory, string> = {
  HERO_CAPTURE: "Bộ chụp trang tướng, chụp lại, ảnh trong trận",
  SHOP_CAPTURE: "Giá tướng, cách nhận trang phục",
  BUILD_CAPTURE: "Màn hình Đề cử Pro",
  RANKING_CAPTURE: "Bảng Phân Bậc Tướng",
  GAME_MODE_SOURCE: "Trang bách khoa Cờ Liên Quân, sảnh đã che UID",
  ESPORTS_SOURCE: "Ảnh và dữ liệu mẫu giải đấu",
  IMPORT_DATA: "JSON, CSV, Markdown, script của công cụ nhập",
  ARCHIVE: "Tệp gốc chỉ giữ để dựng lại",
}

export const BUCKET_LABELS: Record<BucketRole, string> = {
  MEDIA_ASSETS: "Ảnh công khai",
  SOURCES: "Tệp nguồn riêng tư",
  STAGING: "Tải lên đang chờ",
}

export const BUCKET_HINTS: Record<BucketRole, string> = {
  MEDIA_ASSETS: "Ảnh Wiki hiển thị, phục vụ qua CDN",
  SOURCES: "Ảnh đối chứng và dữ liệu nhập; chỉ Admin xem",
  STAGING: "Tệp đã cấp URL tải lên nhưng chưa kiểm tra xong",
}

export function groupLabel(role: BucketRole, key: string) {
  return role === "SOURCES" ? (CATEGORY_LABELS[key as SourceCategory] ?? key) : imageTypeLabel(key)
}

export const LEVEL_LABELS: Record<CapacityLevel, string> = {
  OK: "Trong mức miễn phí",
  WARNING: "Gần ngưỡng",
  CRITICAL: "Sắp hết mức miễn phí",
  OVER: "Đã vượt mức miễn phí",
}

/** Fill and track of a meter; the track is a lighter step of the same color, so the state reads across the bar. */
export const LEVEL_COLORS: Record<CapacityLevel, { fill: string; track: string; ink: string }> = {
  OK: { fill: "var(--aov-chart)", track: "var(--aov-accent-soft)", ink: "var(--aov-text-soft)" },
  WARNING: { fill: "var(--aov-warning)", track: "var(--aov-warning-soft)", ink: "var(--aov-warning)" },
  CRITICAL: { fill: "var(--aov-danger)", track: "var(--aov-danger-soft)", ink: "var(--aov-danger)" },
  OVER: { fill: "var(--aov-danger)", track: "var(--aov-danger-soft)", ink: "var(--aov-danger)" },
}

const GIGABYTE = 1_000_000_000

/**
 * Bytes in the decimal units R2 bills in (one GB is 10^9 bytes, ADR-030 section 9), with a Vietnamese decimal comma.
 */
export function formatStorage(bytes: number) {
  const units = [
    [GIGABYTE, "GB"],
    [1_000_000, "MB"],
    [1_000, "KB"],
  ] as const
  for (const [size, unit] of units)
    if (Math.abs(bytes) >= size) return `${decimal(bytes / size, bytes / size < 10 ? 2 : 1)} ${unit}`
  return `${bytes} B`
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value)
}

export function formatShare(share: number) {
  return `${decimal(share * 100, share < 0.1 ? 1 : 0)}%`
}

/** A "2026-11" month key as its Vietnamese label, for example month 11 of 2026. */
export function formatMonth(month: string) {
  const [year, number] = month.split("-")
  return `Tháng ${Number(number)}/${year}`
}

function decimal(value: number, digits: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(value)
}

/** The kind of a file, from its type, for a short column. */
export function fileKind(contentType: string) {
  if (contentType.startsWith("image/")) return "Ảnh " + contentType.slice(6).toUpperCase()
  if (contentType === "application/json") return "JSON"
  if (contentType === "application/zip") return "ZIP"
  if (contentType === "text/csv") return "CSV"
  if (contentType === "text/markdown") return "Markdown"
  return "Văn bản"
}
