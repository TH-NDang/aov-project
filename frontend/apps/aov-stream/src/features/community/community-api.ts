import { streamText } from "../../components/stream-locale"
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
    const messages: Record<string, [string, string]> = {
      PAGE_NOT_FOUND: ["Không tìm thấy nội dung đã công bố.", "This published content could not be found."],
      PAGE_CONFLICT: [
        "Nội dung vừa được thay đổi. Vui lòng tải lại trước khi lưu.",
        "This content has just changed. Please reload before saving.",
      ],
      PAGE_ACTION_FORBIDDEN: ["Bạn chưa có quyền thực hiện thao tác này.", "You are not allowed to do this yet."],
      PAGE_INVALID_CONTENT: [
        "Thông tin chưa hợp lệ hoặc trạng thái đã thay đổi. Hãy kiểm tra lại trước khi gửi.",
        "Some details are not valid, or the status has changed. Please check again before sending.",
      ],
      TOURNAMENT_DUPLICATE_CODE: [
        "Bạn đã gửi yêu cầu này hoặc đã có quyền quản lý trang.",
        "You have already sent this request, or you already manage this page.",
      ],
    }
    const known = messages[problem.code || ""]
    throw new Error(
      known
        ? streamText(...known)
        : response.status === 401
          ? streamText("Vui lòng đăng nhập lại.", "Please sign in again.")
          : streamText(
              "Chưa kết nối được máy chủ. Vui lòng thử lại.",
              "The server could not be reached. Please try again.",
            ),
    )
  }
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : (undefined as T)
}
