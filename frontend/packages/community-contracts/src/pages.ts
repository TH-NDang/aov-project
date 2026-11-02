export type ProfileKind = "ORGANIZATION" | "TEAM" | "PLAYER"
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
}
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
}
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
  ORGANIZATION: "Tổ chức",
  TEAM: "Đội tuyển",
  PLAYER: "Tuyển thủ",
}
