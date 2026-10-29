import { creditHttpUrl, type MediaSourceInput } from "@aov/ui/lib/media-credit"
import { errorMessage } from "@/lib/api/errors"
import type { Request } from "../publishing/publishing-api"
import type { Asset } from "../publishing/types"

export interface MediaSourceTarget {
  assetId: string
  versionId: string
  previewUrl: string | null
  label: string
}

export interface MediaSourceResult {
  target: MediaSourceTarget
  state: "pending" | "saving" | "success" | "error" | "changed"
  message?: string
}

export function bulkSourceValidation(source: MediaSourceInput) {
  if (!source.label.trim() || source.label.trim().length > 200) return "Điền tên nguồn, tối đa 200 ký tự."
  if ((source.ownerName?.trim().length ?? 0) > 200) return "Tên chủ sở hữu / credit tối đa 200 ký tự."
  if (
    [source.url, source.contactUrl].some(
      (url) => url?.trim() && (!creditHttpUrl(url.trim()) || url.trim().length > 2048),
    )
  )
    return "Điền URL HTTP(S) hợp lệ, tối đa 2048 ký tự."
  return null
}

/** Pin each write to the selected version and keep successful writes out of retries. */
export async function addMediaSourcesInBulk(
  request: Request,
  targets: readonly MediaSourceTarget[],
  source: MediaSourceInput,
  onProgress: (result: MediaSourceResult) => void,
  shouldStop: () => boolean = () => false,
) {
  if (bulkSourceValidation(source)) throw new Error("Invalid bulk media source.")
  const unique = [...new Map(targets.map((target) => [target.assetId, target])).values()]
  const results: MediaSourceResult[] = unique.map((target) => ({ target, state: "pending" }))
  const body = JSON.stringify({
    ...source,
    type: source.type ?? "OTHER",
    label: source.label.trim(),
    ownerName: source.ownerName?.trim() || null,
    url: source.url?.trim() || null,
    contactUrl: source.contactUrl?.trim() || null,
  })
  let next = 0
  const report = (index: number, state: MediaSourceResult["state"], message?: string) => {
    const result = { target: unique[index], state, message }
    results[index] = result
    onProgress(result)
  }
  async function worker() {
    while (!shouldStop() && next < unique.length) {
      const index = next++
      const target = unique[index]
      const assetPath = `/admin/media/assets/${encodeURIComponent(target.assetId)}`
      report(index, "saving")
      try {
        const current = await request<Asset>(assetPath)
        if (shouldStop()) {
          report(index, "pending")
          break
        }
        if (current.state !== "ACTIVE" || current.currentVersionId !== target.versionId) {
          report(index, "changed", "Ảnh đã đổi phiên bản hoặc ngừng hoạt động. Hãy đóng và chọn lại ảnh.")
          continue
        }
        const saved = await request<Asset>(`${assetPath}/versions/${encodeURIComponent(target.versionId)}/sources`, {
          method: "POST",
          body,
        })
        report(
          index,
          "success",
          saved.currentVersionId === target.versionId
            ? "Đã bổ sung nguồn / credit."
            : "Đã lưu cho phiên bản đã chọn; ảnh đang dùng vừa thay đổi, cần kiểm tra lại.",
        )
      } catch (error) {
        report(index, "error", errorMessage(error))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, unique.length) }, () => worker()))
  return results
}
