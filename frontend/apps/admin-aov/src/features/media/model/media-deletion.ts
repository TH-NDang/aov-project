import { backendRequest, communityRequest } from "@/app/auth/session"
import { isApiError } from "@/lib/api/errors"

export interface MediaDeletion {
  assetId: string
  state: "PREPARED" | "ORIGIN_DELETED" | "COMPLETE"
  expectedVersion: number
  objects: number
  publicUrls: number
  lastError: string | null
  requestedAt: string
  completedAt: string | null
}

export async function readMediaDeletion(assetId: string, signal?: AbortSignal): Promise<MediaDeletion | null> {
  try {
    const result = await backendRequest<MediaDeletion>(`/admin/media/assets/${assetId}/deletion`, { signal })
    if (!Number.isSafeInteger(result.expectedVersion) || result.expectedVersion < 0)
      throw new Error("Máy chủ cần được cập nhật để tiếp tục yêu cầu xóa ảnh. Hãy khởi động lại dịch vụ Wiki.")
    return result
  } catch (error) {
    if (isApiError(error, "MEDIA_DELETION_NOT_FOUND")) return null
    if (isApiError(error) && error.status === 404)
      throw new Error("Chức năng xóa ảnh chưa sẵn sàng. Hãy khởi động lại dịch vụ Wiki với phiên bản mới.")
    throw error
  }
}

/** Include drafts, trash and publication history, not just currently visible records. */
export async function readDeletionReferences(assetId: string, signal?: AbortSignal) {
  const [wiki, competition] = await Promise.all([
    backendRequest<{ counts: { current: number; draft: number; historical: number } }>(
      `/admin/media/assets/${assetId}/usages`,
      { signal },
    ),
    communityRequest<{ references: number }>(`/admin/media-assets/${assetId}/usage`, { signal }),
  ])
  const counts = [wiki.counts.current, wiki.counts.draft, wiki.counts.historical, competition.references]
  if (counts.some((count) => !Number.isSafeInteger(count) || count < 0))
    throw new Error("Chưa xác minh được nơi sử dụng ảnh. Hãy kiểm tra lại trước khi xóa.")
  return counts.reduce((total, count) => total + count, 0)
}

export function deleteMediaAsset(assetId: string, expectedVersion: number, reason: string) {
  return backendRequest<MediaDeletion>(`/admin/media/assets/${assetId}/delete`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion, reason: reason.trim() }),
  })
}
