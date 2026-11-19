import { backendRequest } from "@/app/auth/session"
import type { Request } from "@/lib/api/publishing-api"
import type { ImportVideo } from "./crawl-import"
import type {
  AdminVideo,
  SaveVideo,
  VideoOrigin,
  VideoPurpose,
  VideoStatus,
  VideoSubject,
  VideoSubjectKind,
} from "./video-model"

export interface VideoFilter {
  subjectKind?: VideoSubjectKind
  subjectId?: string
  subjectKey?: string
  status?: VideoStatus
  purpose?: VideoPurpose
  origin?: VideoOrigin
  q?: string
  page?: number
  size?: number
}

export interface VideoPage {
  items: AdminVideo[]
  page: number
  size: number
  totalElements: number
}

export interface ImportResult {
  created: number
  skipped: number
  rejected: { index: number; reason: string }[]
}

export const videoKeys = {
  lists: ["admin-videos", "list"] as const,
  list: (filter: VideoFilter) => ["admin-videos", "list", filter] as const,
  subjects: ["admin-videos", "subjects"] as const,
}

function filterQuery(filter: VideoFilter) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value))
  }
  return params.size ? `?${params}` : ""
}

export function createVideoApi(request: Request = backendRequest) {
  return {
    list: (filter: VideoFilter, signal?: AbortSignal) =>
      request<VideoPage>(`/admin/videos${filterQuery(filter)}`, { signal }),
    subjects: async (signal?: AbortSignal) =>
      (await request<{ items: VideoSubject[] }>("/admin/videos/subjects", { signal })).items,
    create: (body: SaveVideo) => request<AdminVideo>("/admin/videos", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: SaveVideo) =>
      request<AdminVideo>(`/admin/videos/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (video: AdminVideo) =>
      request<void>(`/admin/videos/${video.id}?expectedVersion=${video.version}`, { method: "DELETE" }),
    importBatch: (items: ImportVideo[]) =>
      request<ImportResult>("/admin/videos/import", { method: "POST", body: JSON.stringify({ items }) }),
  }
}

export const videoApi = createVideoApi()

export interface VideoLookup {
  title: string
  channelName: string
}

/** Asks YouTube for the public title and channel of a pasted link; filling the form by hand still works without it. */
export async function lookupYoutubeVideo(url: string, signal?: AbortSignal): Promise<VideoLookup | null> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
      signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    })
    if (!response.ok) return null
    const body = (await response.json()) as { title?: unknown; author_name?: unknown }
    return typeof body.title === "string"
      ? { title: body.title, channelName: typeof body.author_name === "string" ? body.author_name : "" }
      : null
  } catch {
    return null
  }
}
