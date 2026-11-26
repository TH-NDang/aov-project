import { backendRequest } from "@/app/auth/session"
import type { Request } from "@/lib/api/publishing-api"
import type {
  PatchNoteChannel,
  PatchNoteFailure,
  PatchNotePostState,
  PatchNoteRegion,
  PatchNoteScheduleMode,
  PatchNoteSourceCode,
} from "./patch-watch-model"

export interface PatchNoteSource {
  code: PatchNoteSourceCode
  region: PatchNoteRegion
  channels: PatchNoteChannel[]
  pageUrl: string
  /** False when this server cannot read the source: the Indonesian page needs the page reader of the server. */
  readable: boolean
  mode: PatchNoteScheduleMode
  /** Wall-clock time in the overview's zone, `HH:mm` or `HH:mm:ss`. */
  dailyAt: string
  everyHours: number
  paused: boolean
  lastCheckedAt: string | null
  lastSuccessAt: string | null
  /** None while paused or unreadable. */
  nextCheckAt: string | null
  failures: number
  failure: PatchNoteFailure | null
  failureStatus: number | null
  version: number
}

export interface PatchWatchOverview {
  /** Whether the schedule runs on this server. */
  scheduled: boolean
  zone: string
  newCount: number
  sources: PatchNoteSource[]
}

export interface PatchNotePost {
  id: string
  source: PatchNoteSourceCode
  region: PatchNoteRegion
  channel: PatchNoteChannel
  url: string
  title: string | null
  publishedAt: string | null
  firstSeenAt: string
  state: PatchNotePostState
  stateChangedAt: string | null
  version: number
}

export interface PatchNotePostPage {
  items: PatchNotePost[]
  page: number
  size: number
  totalElements: number
}

export interface ChangeSchedule {
  mode: PatchNoteScheduleMode
  dailyAt: string
  everyHours: number
  paused: boolean
  expectedVersion: number
}

export interface AddPost {
  url: string
  title: string
  region: PatchNoteRegion
  channel: PatchNoteChannel
}

export const patchWatchKeys = {
  all: ["patch-watch"] as const,
  overview: ["patch-watch", "overview"] as const,
  posts: ["patch-watch", "posts"] as const,
  postList: (state: PatchNotePostState | null) => ["patch-watch", "posts", state ?? "ALL"] as const,
}

export function createPatchWatchApi(request: Request = backendRequest) {
  return {
    overview: (signal?: AbortSignal) => request<PatchWatchOverview>("/admin/patch-watch", { signal }),
    posts: (state: PatchNotePostState | null, page: number, size: number, signal?: AbortSignal) => {
      const params = new URLSearchParams({ page: String(page), size: String(size) })
      if (state) params.set("state", state)
      return request<PatchNotePostPage>(`/admin/patch-watch/posts?${params}`, { signal })
    },
    changeState: (post: PatchNotePost, state: PatchNotePostState) =>
      request<PatchNotePost>(`/admin/patch-watch/posts/${post.id}/state`, {
        method: "PUT",
        body: JSON.stringify({ state, expectedVersion: post.version }),
      }),
    add: (body: AddPost) =>
      request<PatchNotePost>("/admin/patch-watch/posts", { method: "POST", body: JSON.stringify(body) }),
    changeSchedule: (code: PatchNoteSourceCode, body: ChangeSchedule) =>
      request<PatchNoteSource>(`/admin/patch-watch/sources/${code}/schedule`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    checkNow: () => request<PatchWatchOverview>("/admin/patch-watch/checks", { method: "POST" }),
  }
}

export const patchWatchApi = createPatchWatchApi()
