import {
  readVideoLink,
  videoCanSeek,
  videoPlayback,
  videoThumbnail,
  type VideoSource,
} from "@aov/ui/lib/video-playback"
import { matchesQuery } from "@/lib/text"

export type VideoSubjectKind = "HERO" | "SKILL" | "SKIN" | "ITEM" | "ENCHANTMENT" | "ARCANA" | "SPELL"
export type VideoPurpose =
  | "INTRO"
  | "GUIDE_BASIC"
  | "GUIDE_ADVANCED"
  | "SKILL_DEMO"
  | "SKIN_SHOWCASE"
  | "SKIN_TRAILER"
  | "LORE"
  | "PATCH_CHANGE"
  | "OTHER"
export type VideoStatus = "PUBLISHED" | "DRAFT" | "HIDDEN"
export type VideoOrigin = "MANUAL" | "IMPORT"

export interface AdminVideo {
  id: string
  subjectKind: VideoSubjectKind
  subjectId: string
  subjectKey: string | null
  purpose: VideoPurpose
  title: string
  note: string | null
  url: string
  provider: "YOUTUBE" | "FACEBOOK" | "TIKTOK" | "TWITCH" | "OTHER"
  providerVideoId: string | null
  startSeconds: number
  durationSeconds: number | null
  channelName: string | null
  publishedOn: string | null
  patchVariantId: string | null
  displayOrder: number
  status: VideoStatus
  origin: VideoOrigin
  version: number
  createdAt: string
  updatedAt: string
}

export interface VideoSubject {
  kind: VideoSubjectKind
  id: string
  key: string | null
  code: string
  name: string
  aliases: string[]
}

/** True when every word typed appears in the subject's label, code or other names, ignoring accents and the crossed d. */
export const subjectMatches = (search: string, subject: VideoSubject, label = subject.name) =>
  matchesQuery(search, label, subject.code, ...subject.aliases)

export interface SaveVideo {
  subjectKind: VideoSubjectKind
  subjectId: string
  subjectKey: string | null
  purpose: VideoPurpose
  title: string
  note: string | null
  url: string
  startSeconds: number | null
  durationSeconds: number | null
  channelName: string | null
  publishedOn: string | null
  patchVariantId: string | null
  displayOrder: number | null
  status: VideoStatus
  expectedVersion: number | null
}

export const PURPOSE_LABELS: Record<VideoPurpose, string> = {
  INTRO: "Giới thiệu",
  GUIDE_BASIC: "Cách chơi cơ bản",
  GUIDE_ADVANCED: "Combo & nâng cao",
  SKILL_DEMO: "Minh họa kỹ năng",
  SKIN_SHOWCASE: "Hiệu ứng trang phục",
  SKIN_TRAILER: "Trailer trang phục",
  LORE: "Cốt truyện",
  PATCH_CHANGE: "Thay đổi theo bản",
  OTHER: "Khác",
}

export const STATUS_LABELS: Record<VideoStatus, string> = {
  PUBLISHED: "Đang hiện",
  DRAFT: "Chờ duyệt",
  HIDDEN: "Đã ẩn",
}

export const KIND_LABELS: Record<VideoSubjectKind, string> = {
  HERO: "Tướng",
  SKILL: "Kỹ năng",
  SKIN: "Trang phục",
  ITEM: "Trang bị",
  ENCHANTMENT: "Phù hiệu",
  ARCANA: "Bảng ngọc",
  SPELL: "Phụ trợ",
}

/** The purposes an editor is most likely to want, in the order they are offered for each kind of subject. */
const PURPOSES_BY_KIND: Record<VideoSubjectKind, readonly VideoPurpose[]> = {
  HERO: ["GUIDE_BASIC", "GUIDE_ADVANCED", "INTRO", "LORE", "PATCH_CHANGE", "OTHER"],
  SKILL: ["SKILL_DEMO", "GUIDE_ADVANCED", "PATCH_CHANGE", "OTHER"],
  SKIN: ["SKIN_SHOWCASE", "SKIN_TRAILER", "OTHER"],
  ITEM: ["GUIDE_BASIC", "GUIDE_ADVANCED", "PATCH_CHANGE", "OTHER"],
  ENCHANTMENT: ["GUIDE_BASIC", "GUIDE_ADVANCED", "PATCH_CHANGE", "OTHER"],
  ARCANA: ["GUIDE_BASIC", "GUIDE_ADVANCED", "PATCH_CHANGE", "OTHER"],
  SPELL: ["GUIDE_BASIC", "GUIDE_ADVANCED", "PATCH_CHANGE", "OTHER"],
}

/** Keeps a purpose set on another kind of subject selectable when the video is moved or opened for editing. */
export function purposesFor(kind: VideoSubjectKind, current?: VideoPurpose): VideoPurpose[] {
  const offered = [...PURPOSES_BY_KIND[kind]]
  return current && !offered.includes(current) ? [...offered, current] : offered
}

export function capabilityFor(kind: VideoSubjectKind, action: "write" | "publish"): string {
  const domain =
    kind === "HERO" || kind === "SKILL" || kind === "SKIN"
      ? "hero"
      : kind === "ITEM"
        ? "item"
        : kind === "ENCHANTMENT"
          ? "enchantment"
          : kind === "ARCANA"
            ? "arcana"
            : "spell"
  return `${domain}:${action}`
}

export interface LinkPreview {
  source: VideoSource | null
  videoId: string | null
  thumbnail: string | null
  startSeconds: number | null
  playable: boolean
  seekable: boolean
}

/** A local preview only: the backend normalizes the link and decides what is stored. */
export function previewLink(url: string, pageHostname = "localhost"): LinkPreview {
  const source = readVideoLink(url)
  return {
    source,
    videoId: source?.providerVideoId ?? null,
    thumbnail: source ? videoThumbnail(source) : null,
    startSeconds: source?.startSeconds || null,
    playable: !!source && !!videoPlayback(source, pageHostname),
    seekable: !!source && videoCanSeek(source, pageHostname),
  }
}

export function isWebLink(url: string) {
  try {
    const { protocol, hostname } = new URL(url.trim())
    return (protocol === "http:" || protocol === "https:") && !!hostname
  } catch {
    return false
  }
}

export function subjectId(subject: Pick<VideoSubject, "kind" | "id" | "key">) {
  return `${subject.kind}:${subject.id}:${subject.key ?? ""}`
}

export function videoSubjectId(video: Pick<AdminVideo, "subjectKind" | "subjectId" | "subjectKey">) {
  return `${video.subjectKind}:${video.subjectId}:${video.subjectKey ?? ""}`
}

export function saveBody(video: AdminVideo, changes: Partial<SaveVideo> = {}): SaveVideo {
  return {
    subjectKind: video.subjectKind,
    subjectId: video.subjectId,
    subjectKey: video.subjectKey,
    purpose: video.purpose,
    title: video.title,
    note: video.note,
    url: video.url,
    startSeconds: video.startSeconds,
    durationSeconds: video.durationSeconds,
    channelName: video.channelName,
    publishedOn: video.publishedOn,
    patchVariantId: video.patchVariantId,
    displayOrder: video.displayOrder,
    status: video.status,
    expectedVersion: video.version,
    ...changes,
  }
}

/**
 * New display orders after moving one video within its subject. Orders are rewritten from the list position because
 * imported rows may share a value, in which case swapping two numbers would change nothing.
 */
export function reorder(videos: readonly AdminVideo[], id: string, direction: -1 | 1) {
  const list = [...videos].sort((a, b) => a.displayOrder - b.displayOrder)
  const from = list.findIndex((video) => video.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length) return []

  ;[list[from], list[to]] = [list[to], list[from]]
  return list
    .map((video, displayOrder) => ({ video, displayOrder }))
    .filter(({ video, displayOrder }) => video.displayOrder !== displayOrder)
}

/** Names a subject as readers know it: the hero first for skills and skins, then the entry. */
export function subjectLabel(subjects: readonly VideoSubject[] | undefined, video: AdminVideo) {
  const wanted = videoSubjectId(video)
  const own = subjects?.find((subject) => subjectId(subject) === wanted)
  if (video.subjectKind !== "SKILL" && video.subjectKind !== "SKIN") return own?.name ?? video.subjectId
  const hero = subjects?.find((subject) => subject.kind === "HERO" && subject.id === video.subjectId)
  return `${hero?.name ?? "Tướng chưa rõ"} · ${own?.name ?? video.subjectKey}`
}
