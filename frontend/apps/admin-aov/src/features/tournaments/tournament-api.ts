import type {
  Catalog,
  DocumentView,
  GameContent,
  PageSlice,
  PlayerContent,
  RosterMembershipContent,
  RecordDeletionImpact,
  RecordLifecycleState,
  SeriesContent,
  TeamContent,
  TournamentContent,
} from "@aov/community-contracts"
import { communityRequest } from "@/app/auth/session"
import { ApiError } from "@/lib/api/errors"

export interface TournamentRecords {
  teams: TeamContent
  players: PlayerContent
  tournaments: TournamentContent
  series: SeriesContent
  games: GameContent
  "roster-memberships": RosterMembershipContent
}
export type RecordKind = keyof TournamentRecords
type Request = <T>(path: string, init?: RequestInit) => Promise<T>
export const tournamentKeys = { all: ["community", "tournaments"] as const }

export function createTournamentApi(request: Request = communityRequest) {
  const send = <T>(path: string, method: string, body: unknown) =>
    request<T>(path, { method, body: JSON.stringify(body) })
  return {
    me: (signal?: AbortSignal) => request<{ capabilities: string[] }>("/admin/me", { signal }),
    async list<K extends RecordKind>(
      kind: K,
      signal?: AbortSignal,
      filters?:
        string | { tournamentId?: string; teamId?: string; playerId?: string; state?: "ACTIVE" | "DELETED" | "ALL" },
    ): Promise<DocumentView<TournamentRecords[K]>[]> {
      const rows: DocumentView<TournamentRecords[K]>[] = []
      for (let page = 0; page < 100; page++) {
        const params = new URLSearchParams({ page: String(page), size: "100" })
        if (typeof filters === "string") params.set("seriesId", filters)
        else if (filters) for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
        const result = await request<PageSlice<DocumentView<TournamentRecords[K]>>>(`/admin/${kind}?${params}`, {
          signal,
        })
        rows.push(...result.items)
        if (!result.items.length || rows.length >= result.totalElements) return rows
      }
      throw new Error("Danh sách quá lớn. Hãy thu hẹp phạm vi trước khi tải lại.")
    },
    read: <K extends RecordKind>(kind: K, id: string, signal?: AbortSignal) =>
      request<DocumentView<TournamentRecords[K]>>(`/admin/${kind}/${id}`, { signal }),
    create: <K extends RecordKind>(kind: K, content: TournamentRecords[K]) =>
      send<DocumentView<TournamentRecords[K]>>(`/admin/${kind}`, "POST", { content }),
    save: <K extends RecordKind>(kind: K, entry: DocumentView<TournamentRecords[K]>, content: TournamentRecords[K]) =>
      send<DocumentView<TournamentRecords[K]>>(`/admin/${kind}/${entry.id}`, "PUT", {
        version: entry.version,
        content,
      }),
    deletionImpact: (kind: RecordKind, id: string, signal?: AbortSignal) =>
      request<RecordDeletionImpact>(`/admin/${kind}/${id}/deletion-impact`, { signal }),
    remove: (kind: RecordKind, entry: { id: string; version: number }) =>
      send<RecordLifecycleState>(`/admin/${kind}/${entry.id}/delete`, "POST", { version: entry.version }),
    restore: (kind: RecordKind, entry: { id: string; version: number }) =>
      send<RecordLifecycleState>(`/admin/${kind}/${entry.id}/restore`, "POST", { version: entry.version }),
    publish: (entry: DocumentView<GameContent>) =>
      send<DocumentView<GameContent>>(`/admin/games/${entry.id}/publish`, "POST", { version: entry.version }),
    withdraw: (entry: DocumentView<GameContent>) =>
      send<DocumentView<GameContent>>(`/admin/games/${entry.id}/withdraw`, "POST", { version: entry.version }),
    catalog: (
      scope: Pick<GameContent, "region" | "locale" | "seasonId" | "patchVariantId" | "includeUnscoped">,
      signal?: AbortSignal,
    ) => {
      const params = new URLSearchParams({ region: scope.region, locale: scope.locale })
      if (scope.seasonId) params.set("seasonId", scope.seasonId)
      if (scope.patchVariantId) params.set("patchVariantId", scope.patchVariantId)
      if (scope.includeUnscoped) params.set("includeUnscoped", "true")
      return request<Catalog>(`/admin/catalog?${params}`, { signal })
    },
  }
}
export const tournamentApi = createTournamentApi()

export function tournamentIssueFields(error: unknown): string[] {
  if (!(error instanceof ApiError)) return []
  const problem = error.problem as typeof error.problem & { missingFields?: unknown; violations?: unknown }
  const fields = problem.missingFields ?? problem.violations
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === "string") : []
}

export function tournamentError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    if (error.status === 403) return "Tài khoản chưa có quyền quản lý giải đấu. Hãy kiểm tra quyền trong Keycloak."
    if (error.code === "TOURNAMENT_RECORD_IN_USE") return "Chưa thể xóa: mục này còn được dữ liệu khác sử dụng."
    if (error.code === "TOURNAMENT_RESTORE_BLOCKED") return "Chưa thể khôi phục: cần khôi phục dữ liệu liên quan trước."
    if (error.code === "TOURNAMENT_RECORD_DELETED") return "Mục đang ở thùng rác. Khôi phục trước khi chỉnh sửa."
    if (error.code === "TOURNAMENT_DUPLICATE_CODE")
      return "Mã đã được dùng hoặc số ván đã tồn tại trong trận này. Chọn mã / số khác."
    if (error.status === 409) return "Dữ liệu đã thay đổi. Hãy tải bản mới trước khi lưu lại."
    if (error.status === 422 || error.status === 400)
      return "Thông tin chưa hợp lệ. Kiểm tra các ô đã nhập và danh sách còn thiếu."
    if (error.status === 502 || error.status === 503)
      return "Chưa kết nối được dịch vụ giải đấu hoặc danh mục Wiki. Bạn có thể thử lại."
    return "Chưa thể hoàn tất thao tác. Vui lòng thử lại."
  }
  return error instanceof Error ? error.message : "Chưa kết nối được dịch vụ giải đấu."
}
