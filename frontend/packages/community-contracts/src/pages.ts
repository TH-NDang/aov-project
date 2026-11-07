export type ProfileKind = "ORGANIZATION" | "TEAM" | "PLAYER" | "PERSON" | "CIRCUIT"
export const personRoleLabels = {
  COACH: "Huấn luyện viên",
  TEAM_ANALYST: "Phân tích đội tuyển",
  HOST: "MC",
  INTERVIEWER: "Phỏng vấn",
  CASTER: "Bình luận viên",
  GUEST_ANALYST: "Khách mời phân tích",
} as const
export type PersonRole = keyof typeof personRoleLabels
export type PersonRoleFilter = PersonRole | "COACHING" | "BROADCAST"
export const isIndividualProfile = (kind: ProfileKind) => kind === "PLAYER" || kind === "PERSON"
export const isCommunityProfile = (kind: ProfileKind) => kind !== "CIRCUIT"
export const isCoachingRole = (role: PersonRole) => role === "COACH" || role === "TEAM_ANALYST"
export type PageRole = "OWNER" | "EDITOR" | "MODERATOR"
/** `official` marks a channel run by the organization, team or player itself. */
export type ProfileLink = { label: string; url: string; official?: boolean | null }
export type ProfileSource = { label: string; url: string; checkedOn?: string | null }
export type ProfileHistory = {
  startsOn?: string | null
  endsOn?: string | null
  title: string
  relatedPageId?: string | null
  role?: string | null
  sourceUrl?: string | null
}
export type ProfileAchievement = {
  title: string
  placement: string
  date?: string | null
  tournamentId?: string | null
  sourceUrl?: string | null
}
export type ProfileMember = {
  pageId?: string | null
  name: string
  role: string
  status?: string | null
  startsOn?: string | null
  endsOn?: string | null
  sourceUrl?: string | null
}
export type ProfileContent = {
  name: string
  shortName?: string | null
  country?: string | null
  biography?: string | null
  avatarUrl?: string | null
  coverUrl?: string | null
  links: ProfileLink[]
  sources: ProfileSource[]
  history: ProfileHistory[]
  achievements: ProfileAchievement[]
  roster: ProfileMember[]
  personRoles?: PersonRole[]
  channelOrganizationId?: string | null
}
export type TeamAffiliation = {
  teamPageId: string
  teamCode: string
  teamName: string
  teamAvatarUrl?: string | null
  member: ProfileMember
}
export type ProfilePresentation = Pick<ProfileContent, "biography" | "avatarUrl" | "coverUrl" | "links">
export type CommunityProfile = {
  id: string
  version: number | null
  code: string
  kind: ProfileKind
  entityId?: string | null
  content: ProfileContent | null
  published: boolean
  represented: boolean
  followers: number
  updatedAt: string
  /** The day of the last activity, in a list ordered by it. */
  lastActiveOn?: string | null
  /** Tied by its history to the page a picker was opened from. */
  related?: boolean
  /** Present while the page is broadcasting. */
  live?: PageLive | null
}
/** A running broadcast of a page; see spec 04, live status. */
export type PageLive = { url: string; title: string; startedAt: string }
export type PageClaim = {
  id: string
  version: number
  pageId: string
  pageName: string
  name: string
  evidence: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  resolution?: string | null
  createdAt: string
}
export type PageManager = { id: string; name: string; role: PageRole; self: boolean }
/** An unused owner handover code; the code itself is returned only once, when issued. */
export type PageHandover = { pending: boolean; expiresAt: string | null }
export type PageViewer = { role: PageRole | ""; following: boolean; version: number; name: string }
export type CommunityPost = {
  id: string
  version: number
  pageId: string
  authorName: string
  asPage: boolean
  body: string
  status: "DRAFT" | "PUBLISHED" | "HIDDEN"
  createdAt: string
  own: boolean
  likes: number
  /** Always false in the anonymous public list. */
  liked: boolean
  /** Visible (not hidden) comments. */
  comments: number
  /** Absent in responses from services older than post kinds; treat as TEXT. */
  kind?: PostKind
  /** Required for NEWS, optional otherwise. */
  title?: string | null
  /** The video of a VIDEO post. */
  videoUrl?: string | null
  /** Up to four images. */
  imageUrls?: string[]
  /** Only page posts are pinned, one per page. */
  pinned?: boolean
}
export type PostKind = "TEXT" | "NEWS" | "VIDEO"
export const postKindLabels: Record<PostKind, string> = { TEXT: "Bài viết", NEWS: "Tin tức", VIDEO: "Video" }
/** The published page a feed post belongs to; the avatar follows the representative's presentation. */
export type PageCard = {
  id: string
  code: string
  kind: ProfileKind
  name: string
  avatarUrl?: string | null
  represented: boolean
}
/** An item of the cross-page feed (`GET /posts`, `GET /me/feed`). */
export type FeedPost = { post: CommunityPost; page: PageCard }
export type CommunityComment = {
  id: string
  postId: string
  authorName: string
  asPage: boolean
  body: string
  createdAt: string
  own: boolean
}
export type CommunityNotification = { id: string; pageId: string; message: string; createdAt: string; read: boolean }
export type CommunityReport = {
  id: string
  pageId: string
  postId?: string
  commentId?: string
  reason: string
  reportedContent: string
  createdAt: string
}

export const emptyProfile = (name = ""): ProfileContent => ({
  name,
  biography: "",
  links: [],
  sources: [],
  history: [],
  achievements: [],
  roster: [],
})
export const profileKindLabels: Record<ProfileKind, string> = {
  CIRCUIT: "Hệ thống giải",
  ORGANIZATION: "Tổ chức",
  TEAM: "Đội tuyển",
  PLAYER: "Tuyển thủ",
  PERSON: "Nhân sự",
}
