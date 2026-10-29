import { randomId } from "@/lib/random-id"
import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import { findResourceMediaSource } from "@aov/ui/lib/resource-media-sources"
import { importMediaSources } from "./import-media-sources"
import { ApiError } from "@/lib/api/errors"
import { importImageFile } from "./import-files"
import type { Request } from "./publishing-api"
import type { RelatedImage } from "./import-relations"
import type { UploadTicket } from "../users/avatar-upload"
import type { components } from "./generated/hero-api"

type Input = components["schemas"]["HeroImportRequest"]
type Plan = components["schemas"]["HeroImportPlan"]
export interface UploadEntry {
  input: Input
  imageUrls?: Record<string, string>
  relatedImages?: RelatedImage[]
}
interface ImageCheckpoint {
  credit?: MediaSourceInput
  source: string
  semanticType: string
  digest?: string
  assetId?: string
  uploadId?: string
  completed?: boolean
}
export interface UploadState {
  schemaVersion: 1
  label: string
  base: string
  entries: UploadEntry[]
  images: Record<string, ImageCheckpoint>
  prepared?: boolean
}
export interface UploadSession {
  id: string
  version: number
  updatedAt?: string
  state: UploadState
}
export const uploadSessionsPath = "/admin/heroes/import/upload-sessions"
const imageKey = (source: string, semanticType: string) => JSON.stringify([semanticType, source])
async function fingerprint(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
export async function createUploadSession(
  entries: UploadEntry[],
  files: Map<string, File>,
  base: string,
  label: string,
): Promise<UploadSession> {
  const images: UploadState["images"] = {}
  const localResources = entries.some(
    (entry) =>
      Object.values(entry.imageUrls ?? {}).some((path) => path.startsWith("/__resources/")) ||
      entry.relatedImages?.some((image) => image.source.startsWith("/__resources/")),
  )
  const sources = await importMediaSources(files, base, localResources)
  for (const entry of entries) {
    const targets = [
      ...Object.entries(entry.imageUrls ?? {}).map(([key, source]) => ({
        source,
        semanticType: `HERO_${key.toUpperCase()}`,
      })),
      ...(entry.relatedImages ?? []),
    ]
    for (const { source, semanticType } of targets) {
      const key = imageKey(source, semanticType)
      if (images[key]) continue
      images[key] = { source, semanticType }
      if (!source.startsWith("https:"))
        images[key].digest = await fingerprint(await importImageFile(source, files, base))
      images[key].credit = findResourceMediaSource(sources, source, images[key].digest)
    }
  }
  return {
    id: randomId(),
    version: -1,
    state: { schemaVersion: 1, label, base, entries: structuredClone(entries), images },
  }
}
export async function saveUploadSession(request: Request, session: UploadSession) {
  const saved = await request<UploadSession>(`${uploadSessionsPath}/${session.id}`, {
    method: "PUT",
    body: JSON.stringify({ version: session.version, state: session.state }),
  })
  session.version = saved.version
  return session
}

/** Checkpoint before storage writes and after completion; never persist signed URLs or credentials. */
export async function resumeUploadSession(
  request: Request,
  session: UploadSession,
  files: Map<string, File>,
  progress: (completed: number, total: number, message: string) => void,
  fetcher: typeof fetch = fetch,
) {
  const send = <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })
  const save = () => saveUploadSession(request, session)
  const run = async () => {
    const { state } = session
    if (state.schemaVersion !== 1) throw new Error("Phiên upload không tương thích. Hãy cập nhật trang.")
    if (!state.prepared) {
      await save()
      for (const entry of state.entries) {
        const latest = await send<Plan>("/admin/heroes/import/preview", entry.input)
        if (
          !latest.canApply ||
          latest.revisionId !== entry.input.expectedRevisionId ||
          latest.version !== entry.input.expectedVersion
        )
          throw new Error("Dữ liệu tướng đã thay đổi. Hãy tạo bản xem trước mới trước khi import.")
      }
      const images = Object.values(state.images)
      for (const image of images) {
        if (image.completed) continue
        progress(images.filter((item) => item.completed).length, images.length, `Đang upload: ${image.source}`)
        const complete = async () => {
          const result = await send<{ assetId: string; current: boolean }>(
            `/admin/media/uploads/${image.uploadId}/complete`,
          )
          if (!result.current || result.assetId !== image.assetId) throw new Error("Phiên bản ảnh chưa được kích hoạt.")
          image.completed = true
          await save()
        }
        if (image.uploadId) {
          try {
            await complete()
            continue
          } catch (error) {
            if (
              !(error instanceof ApiError) ||
              ![
                "MEDIA_UPLOAD_EXPIRED",
                "MEDIA_UPLOAD_NOT_FOUND",
                "MEDIA_OBJECT_NOT_FOUND",
                "MEDIA_UPLOAD_REJECTED",
              ].includes(error.code)
            )
              throw error
          }
        }
        const file = await importImageFile(image.source, files, state.base)
        const digest = await fingerprint(file)
        if (image.digest && digest !== image.digest)
          throw new Error(`Ảnh ${image.source} khác với file của phiên đã lưu. Hãy chọn lại gói ban đầu.`)
        image.digest = digest
        if (!image.assetId) {
          const asset = await send<{ id: string }>("/admin/media/assets", {
            semanticType: image.semanticType,
            source: image.credit ?? findResourceMediaSource([], image.source),
          })
          image.assetId = asset.id
          await save()
        }
        const ticket = await send<UploadTicket>(`/admin/media/assets/${image.assetId}/version-uploads`, {
          source: image.credit ?? findResourceMediaSource([], image.source),
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        })
        image.uploadId = ticket.uploadId
        await save()
        const response = await fetcher(ticket.uploadUrl, {
          method: ticket.method,
          headers: ticket.headers,
          body: file,
          credentials: "omit",
          redirect: "error",
          signal: AbortSignal.timeout(120000),
        })
        if (!response.ok) throw new Error("Upload ảnh chưa xong. Phiên đã lưu; bạn có thể tiếp tục sau.")
        await complete()
      }
      state.entries = state.entries.map((entry) => {
        const input = structuredClone(entry.input)
        for (const [key, source] of Object.entries(entry.imageUrls ?? {}))
          input.values[key] = state.images[imageKey(source, `HERO_${key.toUpperCase()}`)].assetId!
        for (const image of entry.relatedImages ?? [])
          (input.values[image.section] as Record<string, unknown>[])[image.index][image.field] =
            state.images[imageKey(image.source, image.semanticType)].assetId!
        return { input }
      })
      state.prepared = true
      await save()
    }
    progress(state.entries.length, state.entries.length, "Đang gửi tác vụ đến máy chủ")
    await send("/admin/heroes/import/jobs", { id: session.id, rows: state.entries.map((entry) => entry.input) })
    try {
      await request(`${uploadSessionsPath}/${session.id}`, { method: "DELETE" })
    } catch {
      // Job acceptance is authoritative. A leftover checkpoint can safely retry the same immutable job id.
      progress(
        state.entries.length,
        state.entries.length,
        "Máy chủ đã nhận tác vụ; checkpoint sẽ được dọn khi mở lại phiên",
      )
    }
  }
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(`hero-upload:${session.id}`, { ifAvailable: true }, (lock) => {
      if (!lock) throw new Error("Phiên này đang upload trong tab khác.")
      return run()
    })
  return run()
}
