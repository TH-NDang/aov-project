import type { QueryClient } from "@tanstack/react-query"

/** The query string of a community list. */
export type Query = Record<string, string>

/**
 * Every query key of the community feature; reads and invalidation both use these. A name ending in `all` is the
 * prefix of every key of that kind, for refreshing all of them at once.
 */
export const communityKeys = {
  publicPageAll: ["public-page"] as const,
  publicPage: (idOrCode: string) => ["public-page", idOrCode] as const,
  pageDirectory: (kind: string | null | undefined) => ["public-pages", kind] as const,
  pageWall: (kind: string) => ["page-wall", kind] as const,
  pageTeams: (pageId: string) => ["public-page-teams", pageId] as const,
  organizationTeams: (organizationId: string, size: number) => ["organization-teams", organizationId, size] as const,
  entityPage: (kind: string, entityId: string) => ["entity-page", kind, entityId] as const,
  relatedPages: (kind: string) => ["related-pages", kind] as const,
  channels: ["page-channels"] as const,
  youtubeChannel: (pageId: string, url: string) => ["youtube-channel", pageId, url] as const,
  youtubeVideos: (pageId: string, url: string) => ["youtube-videos", pageId, url] as const,
  livePageAll: ["live-pages"] as const,
  livePages: (size: number) => ["live-pages", size] as const,
  videoHighlights: ["video-highlights"] as const,
  pageSearch: (kind: string, query: string) => ["page-search", kind, query] as const,
  pageSearchList: (kind: string, query: string) => ["page-search-list", kind, query] as const,
  postSearchAll: ["post-search"] as const,
  postSearch: (query: string) => ["post-search", query] as const,
  pagePostAll: ["page-posts"] as const,
  pagePosts: (revision: number, pageId: string, manage: boolean, kind: string | undefined) =>
    ["page-posts", revision, pageId, manage, kind] as const,
  pagePostCountAll: ["page-post-count"] as const,
  pagePostCount: (pageId: string, kind?: "VIDEO") =>
    (kind ? ["page-post-count", pageId, kind] : ["page-post-count", pageId]) as readonly unknown[],
  feedAll: ["community-feed"] as const,
  feed: (following: boolean, kind: string | undefined, revision: number) =>
    ["community-feed", following, kind, revision] as const,
  comments: (postId: string) => ["post-comments", postId] as const,
  competitionPage: (filter: Query, page: number, size: number) =>
    ["published-competitions", filter, page, size] as const,
  competitionFeed: (filter: Query, size: number) => ["published-competitions", "feed", filter, size] as const,
  managedPages: (revision: number) => ["managed-pages", revision] as const,
  claims: (revision: number) => ["my-claims", revision] as const,
  managedPageAll: ["managed-page"] as const,
  managedPage: (revision: number, pageId: string) => ["managed-page", revision, pageId] as const,
  viewerAll: ["page-viewer"] as const,
  viewer: (revision: number, pageId: string) => ["page-viewer", revision, pageId] as const,
  memberAll: ["page-members"] as const,
  members: (revision: number, pageId: string) => ["page-members", revision, pageId] as const,
  followAll: ["my-follows"] as const,
  follows: (revision: number) => ["my-follows", revision] as const,
  suggestionAll: ["page-suggestions"] as const,
  suggestions: (revision: number, size: number) => ["page-suggestions", revision, size] as const,
  unreadAll: ["notifications-unread"] as const,
  unread: (revision: number) => ["notifications-unread", revision] as const,
  notificationAll: ["notifications"] as const,
  notifications: (revision: number, page: number, size: number) => ["notifications", revision, page, size] as const,
  inbox: (revision: number, size: number) => ["notifications", revision, "inbox", size] as const,
}

/**
 * Refreshes every list a post appears in or is counted in: the page's posts and its post counts, the home feed, post
 * search and the video highlights. Writing, editing, pinning, hiding or deleting a post changes all of them.
 */
export const refreshPostLists = (client: QueryClient) =>
  Promise.all(
    [
      communityKeys.pagePostAll,
      communityKeys.pagePostCountAll,
      communityKeys.feedAll,
      communityKeys.postSearchAll,
      communityKeys.videoHighlights,
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  )
