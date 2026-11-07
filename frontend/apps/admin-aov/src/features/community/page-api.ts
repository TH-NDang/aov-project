import type {
  CommunityProfile,
  PageSlice,
  ProfileContent,
  ProfileKind,
  PageClaim,
  PageManager,
  PageHandover,
  PageLive,
  CommunityReport,
  PersonRoleFilter,
  TeamAffiliation,
} from "@aov/community-contracts"
import { communityRequest } from "@/app/auth/session"

export const pageKeys = ["community-pages"] as const
export const publicSite = import.meta.env?.VITE_STREAM_URL || "http://localhost:5174"
const send = <T>(path: string, method: string, body?: unknown) =>
  communityRequest<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
export const pageApi = {
  readPublic: (id: string) => communityRequest<CommunityProfile>(`/pages/${id}`),
  /** Pages for a picker: an exact name, then those tied to `relatedPageId`, then whoever was active last. */
  list: (kind: ProfileKind | "", q: string, page = 0, personRole?: PersonRoleFilter, relatedPageId?: string) =>
    communityRequest<PageSlice<CommunityProfile>>(
      `/admin/pages?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(personRole ? { personRole } : {}), ...(relatedPageId ? { relatedPageId } : {}), q, sort: "ACTIVE", page: String(page), size: "24" })}`,
    ),
  read: (id: string) => communityRequest<CommunityProfile>(`/admin/pages/${id}`),
  teams: (id: string) => communityRequest<TeamAffiliation[]>(`/admin/pages/${id}/teams`),
  create: (kind: ProfileKind, code: string, content: ProfileContent, entityId?: string) =>
    send<CommunityProfile>("/admin/pages", "POST", { kind, code, content, entityId }),
  save: (entry: CommunityProfile, content: ProfileContent) =>
    send<CommunityProfile>(`/admin/pages/${entry.id}`, "PUT", { version: entry.version, content }),
  publish: (entry: CommunityProfile, publish: boolean) =>
    send<CommunityProfile>(`/admin/pages/${entry.id}/${publish ? "publish" : "withdraw"}`, "POST", {
      version: entry.version,
    }),
  /** Only never-published drafts without representatives or activity can be deleted. */
  remove: (entry: CommunityProfile) =>
    send<void>(`/admin/pages/${entry.id}/delete`, "POST", { version: entry.version }),
  claims: (page = 0) => communityRequest<PageSlice<PageClaim>>(`/admin/page-claims?page=${page}&size=30`),
  decide: (entry: PageClaim, approve: boolean, resolution: string) =>
    send<PageClaim>(`/admin/page-claims/${entry.id}/decision`, "POST", { version: entry.version, approve, resolution }),
  members: (id: string) => communityRequest<PageManager[]>(`/me/pages/${id}/members`),
  revoke: (id: string, memberId: string) => send<void>(`/me/pages/${id}/members/${memberId}/revoke`, "POST"),
  handover: (id: string) => communityRequest<PageHandover>(`/admin/pages/${id}/handover`),
  issueHandover: (id: string) => send<{ token: string; expiresAt: string }>(`/admin/pages/${id}/handover`, "POST"),
  cancelHandover: (id: string) => send<void>(`/admin/pages/${id}/handover/cancel`, "POST"),
  /** Announces or updates a live broadcast; followers hear about it once when it starts. */
  startLive: (id: string, url: string, title: string) =>
    send<PageLive>(`/admin/pages/${id}/live`, "PUT", { url, title }),
  endLive: (id: string) => send<void>(`/admin/pages/${id}/live/end`, "POST"),
  reports: (page = 0) => communityRequest<PageSlice<CommunityReport>>(`/admin/community-reports?page=${page}&size=30`),
  resolve: (id: string, resolution: string, hide: boolean) =>
    send<void>(`/admin/community-reports/${id}/resolve`, "POST", { resolution, hide }),
}

/** `conflict` replaces the default stale-version message for actions whose conflicts have other causes. */
export function pageError(error: unknown, conflict?: string): string {
  const code = (error as { code?: string })?.code
  if (code === "PAGE_CONFLICT") return conflict ?? "Hồ sơ vừa thay đổi. Hãy tải lại để xem bản mới trước khi lưu."
  if (code === "PAGE_ACTION_FORBIDDEN") return "Bạn chưa có quyền thực hiện thao tác này trên trang."
  if (code === "PAGE_NOT_FOUND") return "Không tìm thấy hồ sơ hoặc nội dung chưa được công bố."
  if (code === "TOURNAMENT_DUPLICATE_CODE") return "Mã hoặc hồ sơ liên kết đã tồn tại. Hãy kiểm tra lại danh sách."
  if (code === "PAGE_INVALID_CONTENT")
    return "Kiểm tra thông tin bắt buộc, đường dẫn nguồn và quyền đại diện. Yêu cầu phải do người khác xét duyệt."
  return "Chưa hoàn tất thao tác. Hãy kiểm tra kết nối và thử lại."
}
