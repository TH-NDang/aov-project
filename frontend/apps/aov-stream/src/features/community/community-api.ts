import { accessToken } from "./community-auth"

export async function communityApi<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (path.startsWith("/me")) headers.Authorization = `Bearer ${await accessToken()}`
  const response = await fetch(`/api/community/v1${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers,
    credentials: "omit",
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { code?: string }
    const messages: Record<string, string> = {
      PAGE_NOT_FOUND: "Không tìm thấy nội dung đã công bố.",
      PAGE_CONFLICT: "Nội dung vừa được thay đổi. Vui lòng tải lại trước khi lưu.",
      PAGE_ACTION_FORBIDDEN: "Bạn chưa có quyền thực hiện thao tác này.",
      PAGE_INVALID_CONTENT: "Thông tin chưa hợp lệ hoặc trạng thái đã thay đổi. Hãy kiểm tra lại trước khi gửi.",
      TOURNAMENT_DUPLICATE_CODE: "Bạn đã gửi yêu cầu này hoặc đã có quyền quản lý trang.",
    }
    throw new Error(
      messages[problem.code || ""] ||
        (response.status === 401 ? "Vui lòng đăng nhập lại." : "Chưa kết nối được máy chủ. Vui lòng thử lại."),
    )
  }
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : (undefined as T)
}
