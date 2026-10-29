import { safeLinkUrl } from "@aov/ui/lib/entity-rich-text"
import { ApiError } from "@/lib/api/errors"
import type { RecordKind } from "./tournament-api"

export const RECORD_KIND_LABELS: Record<RecordKind, string> = {
  teams: "Đội tuyển",
  players: "Tuyển thủ",
  tournaments: "Giải đấu",
  series: "Trận đấu",
  "roster-memberships": "Thành viên đội hình",
  games: "Ván đấu",
}
const USAGE_LABELS: Record<string, string> = {
  ROSTER_MEMBERSHIP: "Đội hình",
  SERIES: "Trận đấu",
  GAME: "Ván đấu",
  PUBLICATION_HISTORY: "Lịch sử xuất bản",
  TEAM: "Đội tuyển",
  PLAYER: "Tuyển thủ",
  TOURNAMENT: "Giải đấu",
  PARENT_TEAM: "Đội tuyển đã xóa",
  PARENT_PLAYER: "Tuyển thủ đã xóa",
  PARENT_TOURNAMENT: "Giải đấu đã xóa",
  PARENT_SERIES: "Trận đấu đã xóa",
}

export function lifecycleUsages(value: unknown): { type: string; label: string; count: number; path?: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.type !== "string" ||
      !Number.isInteger(entry.count) ||
      entry.count < 1
    )
      return []
    const path = safeLinkUrl(entry.adminPath)
    return [
      {
        type: entry.type,
        label: USAGE_LABELS[entry.type] || "Dữ liệu liên quan",
        count: entry.count,
        path: path?.startsWith("/") ? path : undefined,
      },
    ]
  })
}

export function lifecycleErrorUsages(error: unknown) {
  return error instanceof ApiError
    ? lifecycleUsages((error.problem as typeof error.problem & { usages?: unknown }).usages)
    : []
}

export function recordLabel(kind: RecordKind, value: unknown) {
  const content = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  if (typeof content.name === "string" && content.name) return content.name
  if (typeof content.nickname === "string" && content.nickname) return content.nickname
  if (kind === "games" && typeof content.number === "number") return `Ván ${content.number}`
  if (typeof content.code === "string" && content.code) return content.code
  return RECORD_KIND_LABELS[kind]
}
