import { backendRequest } from "@/app/auth/session"
import { ApiError } from "@/lib/api/errors"

export interface UserProfile {
  id: string | null
  displayName: string
  biography: string
  locale: string
  timeZone: string
  avatarAssetId: string | null
  avatarUrl: string | null
  version: number
  createdAt: string | null
  updatedAt: string | null
}
export type ProfileInput = Pick<UserProfile, "displayName" | "biography" | "locale" | "timeZone" | "avatarAssetId"> & {
  expectedVersion: number
}
export interface UserPage {
  items: UserProfile[]
  page: number
  size: number
  totalElements: number
}
export const userKeys = { self: ["user-profile", "me"] as const, all: ["user-profile"] as const }
export const selfProfile = (signal?: AbortSignal) => backendRequest<UserProfile>("/users/me", { signal })
export const getProfile = (id: string, signal?: AbortSignal) =>
  backendRequest<UserProfile>(`/admin/users/${id}`, { signal })
export const listProfiles = (search: string, page: number, signal?: AbortSignal) =>
  backendRequest<UserPage>(`/admin/users?search=${encodeURIComponent(search)}&page=${page}&size=20`, { signal })
export const saveProfile = (id: string | null, input: ProfileInput) =>
  backendRequest<UserProfile>(id ? `/admin/users/${id}` : "/users/me", { method: "PUT", body: JSON.stringify(input) })

export function profileError(error: unknown) {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      USER_PROFILE_CONFLICT:
        "Hồ sơ đã thay đổi ở nơi khác. Hãy tải bản mới trước khi lưu lại; nội dung đang nhập vẫn được giữ.",
      USER_PROFILE_INVALID: "Tên, ngôn ngữ hoặc múi giờ chưa hợp lệ. Hãy kiểm tra lại.",
      USER_AVATAR_INVALID: "Ảnh chưa được xác nhận hoặc không thuộc lượt tải lên của bạn.",
      FORBIDDEN: "Bạn chưa có quyền thực hiện thao tác này.",
      STORAGE_UNAVAILABLE: "Kho ảnh đang không kết nối được. Bạn có thể thử lại sau.",
      INVALID_MEDIA_OBJECT: "Ảnh không hợp lệ. Hãy chọn PNG, JPEG hoặc WebP, tối đa 25 MB.",
      MEDIA_UPLOAD_EXPIRED: "Lượt tải ảnh đã hết hạn. Vui lòng chọn lại ảnh.",
      USER_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ người dùng.",
    }
    return messages[error.code] ?? "Không thể xử lý yêu cầu. Vui lòng thử lại."
  }
  return error instanceof Error ? error.message : "Không thể kết nối máy chủ."
}
