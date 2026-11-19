import type {
  CommunityComment,
  CommunityNotification,
  CommunityPost,
  CommunityProfile,
  CompetitionView,
  FeedPost,
  PageClaim,
  PageManager,
  PageSlice,
  PageViewer,
  TeamAffiliation,
} from "@aov/community-contracts"
import { communityGetAll, communityRequest } from "./stream-api"
import type { Query } from "./community-keys"

const list = (path: string, query: Query) => `${path}?${new URLSearchParams(query)}`
const id = (value: string) => encodeURIComponent(value)

/** Every endpoint of community-service that Stream calls, so no component holds a URL. */
export const communityApi = {
  page: (pageId: string) => communityRequest<CommunityProfile>(`/pages/${id(pageId)}`),
  /** A page by its id, or by its code when the address carries one. */
  pageByAddress: (idOrCode: string) =>
    communityRequest<CommunityProfile>(
      `/pages/${/^[0-9a-f-]{36}$/i.test(idOrCode) ? id(idOrCode) : `by-code/${id(idOrCode)}`}`,
    ),
  pageByEntity: (kind: string, entityId: string) =>
    communityRequest<CommunityProfile>(`/pages/by-entity/${kind}/${entityId}`),
  pageTeams: (pageId: string) => communityRequest<TeamAffiliation[]>(`/pages/${pageId}/teams`),
  pages: (query: Query) => communityRequest<PageSlice<CommunityProfile>>(list("/pages", query)),
  /** The published teams an organization owns. */
  organizationTeams: (organizationId: string, page: number, size: number) =>
    communityRequest<PageSlice<CommunityProfile>>(
      list("/pages", { kind: "TEAM", organizationId, page: String(page), size: String(size) }),
    ),
  livePages: (size: number) => communityRequest<PageSlice<CommunityProfile>>(list("/live", { size: String(size) })),
  posts: (query: Query) => communityRequest<PageSlice<FeedPost>>(list("/posts", query)),
  feed: (query: Query) => communityRequest<PageSlice<FeedPost>>(list("/me/feed", query)),
  pagePosts: (pageId: string, query: Query, { manage, personal }: { manage: boolean; personal: boolean }) =>
    communityRequest<PageSlice<CommunityPost>>(
      list(`${manage || personal ? "/me" : ""}/pages/${pageId}/${personal ? "feed" : "posts"}`, query),
    ),
  pagePostCount: (pageId: string, kind?: "VIDEO") =>
    communityRequest<PageSlice<unknown>>(list(`/pages/${pageId}/posts`, { ...(kind ? { kind } : {}), size: "1" })),
  comments: (postId: string, page: number) =>
    communityRequest<PageSlice<CommunityComment>>(
      list(`/posts/${postId}/comments`, { page: String(page), size: "30" }),
    ),
  competitions: (query: Query) => communityRequest<PageSlice<CompetitionView>>(list("/competitions", query)),

  managedPages: () => communityRequest<CommunityProfile[]>("/me/pages"),
  claims: () => communityRequest<PageClaim[]>("/me/claims"),
  managedPage: (pageId: string) => communityRequest<CommunityProfile>(`/me/pages/${pageId}/profile`),
  viewer: (pageId: string) => communityRequest<PageViewer>(`/me/pages/${pageId}`),
  savePresentation: (pageId: string, body: { version: number; content: unknown }) =>
    communityRequest(`/me/pages/${pageId}/presentation`, { method: "PUT", body }),
  members: (pageId: string) => communityRequest<PageManager[]>(`/me/pages/${pageId}/members`),
  invite: (pageId: string, role: string) =>
    communityRequest<{ token: string }>(`/me/pages/${pageId}/invitations`, { body: { role } }),
  changeMember: (pageId: string, memberId: string, action: string) =>
    communityRequest(`/me/pages/${pageId}/members/${memberId}/${action}`, { body: {} }),
  acceptInvitation: (token: string) =>
    communityRequest<{ pageId: string }>("/me/invitations/accept", { body: { token } }),
  writePost: (pageId: string, body: Record<string, unknown>) => communityRequest(`/me/pages/${pageId}/posts`, { body }),
  editPost: (pageId: string, postId: string, body: Record<string, unknown>) =>
    communityRequest(`/me/pages/${pageId}/posts/${postId}`, { method: "PUT", body }),
  likePost: (postId: string, liked: boolean) =>
    communityRequest<{ liked: boolean; likes: number }>(`/me/posts/${postId}/like`, { body: { liked } }),
  comment: (postId: string, body: { body: string; asPage: boolean }) =>
    communityRequest(`/me/posts/${postId}/comments`, { body }),
  report: (pageId: string, body: { postId: string; commentId?: string; reason: string }) =>
    communityRequest(`/me/pages/${pageId}/reports`, { body }),
  moderate: (pageId: string, body: { postId: string; commentId?: string; hidden: boolean }) =>
    communityRequest(`/me/pages/${pageId}/moderate`, { body }),
  pin: (pageId: string, postId: string, pinned: boolean) =>
    communityRequest(`/me/pages/${pageId}/posts/${postId}/pin`, { body: { pinned } }),
  /** A claim of a page, or a correction suggested for it. */
  sendPageRequest: (pageId: string, kind: "claims" | "reports", body: { evidence: string } | { reason: string }) =>
    communityRequest(`/me/pages/${pageId}/${kind}`, { body }),
  startLive: (pageId: string, body: { url: string; title: string }) =>
    communityRequest(`/me/pages/${pageId}/live`, { method: "PUT", body }),
  endLive: (pageId: string) => communityRequest(`/me/pages/${pageId}/live/end`, { body: {} }),

  follows: async () => ({ items: await communityGetAll<CommunityProfile>("/me/follows") }),
  suggestions: (size: number) =>
    communityRequest<PageSlice<CommunityProfile>>(list("/me/suggestions", { size: String(size) })),
  follow: (pageId: string, following: boolean) =>
    communityRequest(`/me/pages/${pageId}/follow`, { body: { following } }),
  unreadNotifications: () => communityRequest<{ unread: number }>("/me/notifications/unread"),
  notifications: (page: number, size: number) =>
    communityRequest<PageSlice<CommunityNotification>>(
      list("/me/notifications", { page: String(page), size: String(size) }),
    ),
  readNotification: (notificationId: string) =>
    communityRequest(`/me/notifications/${notificationId}/read`, { body: {} }),
  readAllNotifications: () => communityRequest("/me/notifications/read-all", { body: {} }),
}
