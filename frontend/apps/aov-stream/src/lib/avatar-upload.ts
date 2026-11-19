import type { ApiRequest } from "./api-client.ts"
export interface UploadTicket {
  uploadId: string
  assetId: string
  method: string
  uploadUrl: string
  headers: Record<string, string>
  expiresAt: string
}
export interface AvatarResult {
  assetId: string
  avatarUrl: string
}
type Request = <T>(path: string, request?: ApiRequest) => Promise<T>

export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const AVATAR_MAX_BYTES = 25 * 1024 * 1024

/**
 * Avatars are the user's own images: the ticket request carries only the file facts, never a source or owner.
 * Signed storage requests never receive the API token or browser cookies.
 */
export async function uploadAvatar(
  file: File,
  request: Request,
  signal: AbortSignal,
  progress: (step: string) => void,
  fetcher: typeof fetch = fetch,
  locale = "vi-VN",
): Promise<AvatarResult> {
  const text = (vi: string, en: string) => (locale.startsWith("en") ? en : vi)
  if (!AVATAR_TYPES.includes(file.type) || file.size === 0 || file.size > AVATAR_MAX_BYTES)
    throw new Error(
      text(
        "Chọn ảnh PNG, JPEG hoặc WebP có dung lượng từ 1 byte đến 25 MB.",
        "Choose a PNG, JPEG or WebP image from 1 byte to 25 MB in size.",
      ),
    )
  progress(text("Đang chuẩn bị tải ảnh…", "Preparing to upload the image…"))
  const ticket = await request<UploadTicket>("/users/me/avatar-uploads", {
    method: "POST",
    signal,
    body: { fileName: file.name, contentType: file.type, sizeBytes: file.size },
  })
  progress(text("Đang tải ảnh lên kho lưu trữ…", "Uploading the image to storage…"))
  const response = await fetcher(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.headers,
    body: file,
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
  })
  if (!response.ok)
    throw new Error(
      text(
        "Tải ảnh lên kho lưu trữ chưa thành công. Hãy thử lại.",
        "The image could not be uploaded to storage. Please try again.",
      ),
    )
  progress(text("Đang kiểm tra ảnh…", "Checking the image…"))
  return request<AvatarResult>(`/users/me/avatar-uploads/${ticket.uploadId}/complete`, { method: "POST", signal })
}
