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

const pages = ["community-pages"] as const
const directory = [...pages, "directory"] as const
/**
 * Every cache key of the community pages. A save invalidates `all`, which also refreshes the directory, kept under it;
 * most keys name whose session read them, since an editor sees unpublished pages that a reader does not.
 */
export const pageKeys = {
  all: pages,
  /** One page, read by an editor (`actorKey`) or as the public site shows it (`"public"`). */
  page: (actorKey: string, id: string | null | undefined) => [...pages, actorKey, id] as const,
  members: (pageId: string) => [...pages, pageId, "members"] as const,
  handover: (pageId: string) => [...pages, pageId, "handover"] as const,
  teams: (actorKey: string, pageId: string) => [...pages, actorKey, pageId, "teams"] as const,
  /** The team pages an organization owns. */
  ownedTeams: (actorKey: string, organizationId: string) =>
    [...pages, actorKey, organizationId, "owned-teams"] as const,
  claims: (actorKey: string) => [...pages, actorKey, "claims"] as const,
  reports: (actorKey: string) => [...pages, actorKey, "reports"] as const,
  picker: (actorKey: string, search: string) => [...pages, actorKey, "picker", search] as const,
  referencePicker: (actorKey: string, kind: ProfileKind | "", search: string) =>
    [...pages, actorKey, "reference-picker", kind, search] as const,
  rosterPicker: (actorKey: string, group: string, search: string, teamPageId: string | undefined) =>
    [...pages, actorKey, "roster-picker", group, search, teamPageId] as const,
  directory: {
    all: directory,
    count: (actorKey: string, kind: ProfileKind, group: PersonRoleFilter | undefined) =>
      [...directory, actorKey, "count", kind, group] as const,
    profilesOf: (actorKey: string, kind: ProfileKind, ids: string[]) =>
      [...directory, actorKey, "profiles-of", kind, ids] as const,
    competitionPages: (actorKey: string, kind: ProfileKind, search: string, sort: "NAME" | "ACTIVE") =>
      [...directory, actorKey, kind, search, sort] as const,
    competitionPageStats: (actorKey: string) => [...directory, actorKey, "competition-page-stats"] as const,
    people: (actorKey: string, group: string, role: PersonRoleFilter | undefined, search: string, sort: string) =>
      [...directory, actorKey, "people", group, role, search, sort] as const,
    players: (
      actorKey: string,
      search: string,
      filters: { country: string; lane: string; status: string },
      sort: string,
    ) => [...directory, actorKey, "players", search, filters.country, filters.lane, filters.status, sort] as const,
    teams: (actorKey: string, search: string, country: string, sort: string) =>
      [...directory, actorKey, "teams", search, country, sort] as const,
  },
}
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
  /** Team pages that name this organization as their owner, by name. */
  ownedTeams: (organizationId: string, page = 0) =>
    communityRequest<PageSlice<CommunityProfile>>(
      `/admin/pages?${new URLSearchParams({ kind: "TEAM", organizationId, sort: "NAME", page: String(page), size: "24" })}`,
    ),
  teams: (id: string) => communityRequest<TeamAffiliation[]>(`/admin/pages/${id}/teams`),
  /** `allowSameName` confirms a namesake after the server named players of the same country (spec 04). */
  create: (kind: ProfileKind, code: string, content: ProfileContent, entityId?: string, allowSameName = false) =>
    send<CommunityProfile>(allowSameName ? "/admin/pages?allowSameName=true" : "/admin/pages", "POST", {
      kind,
      code,
      content,
      entityId,
    }),
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
  if (code === "PAGE_NOT_FOUND") return "Không tìm thấy hồ sơ hoặc nội dung chưa được xuất bản."
  if (code === "DUPLICATE_RECORD") return "Mã hoặc hồ sơ liên kết đã tồn tại. Hãy kiểm tra lại danh sách."
  if (code === "PAGE_INVALID_CONTENT")
    return "Kiểm tra thông tin bắt buộc, đường dẫn nguồn, giải và hồ sơ được liên kết, tổ chức chủ quản và quyền đại diện. Yêu cầu phải do người khác xét duyệt."
  return "Chưa hoàn tất thao tác. Hãy kiểm tra kết nối và thử lại."
}
