/** Community pages, requests and notifications as community-service answers them, shared by the account tests. */
import type {
  CommunityNotification,
  CommunityProfile,
  PageClaim,
  PageManager,
  PageSlice,
  PageViewer,
  ProfileContent,
} from "@aov/community-contracts"

/** One page holding all of `items`. */
export const slice = <T>(items: T[], size = 50): PageSlice<T> => ({ items, totalElements: items.length, page: 0, size })

export function page(id: string, name: string, change: Partial<CommunityProfile> = {}): CommunityProfile {
  const content: ProfileContent = {
    name,
    biography: `About ${name}`,
    avatarUrl: null,
    coverUrl: null,
    links: [],
    sources: [],
    history: [],
    achievements: [],
    roster: [],
  }
  return {
    id,
    version: 3,
    code: id.replace("page-", ""),
    kind: "TEAM",
    content,
    published: true,
    represented: true,
    followers: 1200,
    updatedAt: "2026-11-01T08:00:00Z",
    ...change,
  }
}

export function claim(id: string, pageName: string, status: PageClaim["status"], resolution?: string): PageClaim {
  return {
    id,
    version: 1,
    pageId: `page-${id}`,
    pageName,
    name: "Linh",
    evidence: "Team captain",
    status,
    resolution,
    createdAt: "2026-11-01T08:00:00Z",
  }
}

export function notification(id: string, message: string, read: boolean): CommunityNotification {
  return { id, pageId: "page-saigon", message, createdAt: "2026-11-15T08:00:00Z", read }
}

export const viewer = (role: PageViewer["role"], version = 3): PageViewer => ({
  role,
  following: true,
  version,
  name: "Linh",
})

export const managers: PageManager[] = [
  { id: "member-self", name: "Linh", role: "OWNER", self: true },
  { id: "member-an", name: "An", role: "EDITOR", self: false },
]
