import type { PageSlice } from "@aov/community-contracts"
import { streamText } from "../components/stream-locale"
import { COMMUNITY_API_ROOT, createApiRequest, readAllPages, WIKI_API_ROOT } from "./api-client"
import { accessToken } from "./stream-auth"

const PROBLEMS: Record<string, [string, string]> = {
  PAGE_NOT_FOUND: ["Không tìm thấy nội dung đã xuất bản.", "This published content could not be found."],
  PAGE_CONFLICT: [
    "Nội dung vừa được thay đổi. Vui lòng tải lại trước khi lưu.",
    "This content has just changed. Please reload before saving.",
  ],
  PAGE_ACTION_FORBIDDEN: ["Bạn chưa có quyền thực hiện thao tác này.", "You are not allowed to do this yet."],
  PAGE_INVALID_CONTENT: [
    "Thông tin chưa hợp lệ hoặc trạng thái đã thay đổi. Hãy kiểm tra lại trước khi gửi.",
    "Some details are not valid, or the status has changed. Please check again before sending.",
  ],
  TRANSLATION_RATE_LIMITED: [
    "Bạn đã dịch nhiều bài trong giờ qua. Thử lại sau nhé.",
    "You have translated many posts in the last hour. Try again later.",
  ],
  TRANSLATION_UNAVAILABLE: ["Tạm thời chưa dịch được bài viết.", "Posts cannot be translated right now."],
  TRANSLATION_FAILED: [
    "Chưa dịch được bài này. Thử lại sau nhé.",
    "This post could not be translated. Try again later.",
  ],
}

/**
 * The words of a community-service failure in the reader's language. A screen that knows what a code means for its
 * own action (a duplicate claim, say) reads `ApiError.code` and says it itself.
 */
function communityProblemText(status: number, code?: string) {
  const known = PROBLEMS[code ?? ""]
  if (known) return streamText(...known)
  if (status === 404) return streamText(...PROBLEMS.PAGE_NOT_FOUND!)
  if (status === 401) return streamText("Vui lòng đăng nhập lại.", "Please sign in again.")
  return streamText(
    "Chưa kết nối được máy chủ. Vui lòng thử lại.",
    "The server could not be reached. Please try again.",
  )
}

/** community-service: the reader's token goes only to `/me` routes, so public reads stay cacheable. */
export const communityRequest = createApiRequest({
  root: COMMUNITY_API_ROOT,
  token: (path) => (path.startsWith("/me") ? accessToken() : null),
  describe: (status, problem) => communityProblemText(status, problem.code),
})

/** Every row of a community list. */
export const communityGetAll = <T>(path: string, options?: { signal?: AbortSignal; size?: number }) =>
  readAllPages<T>((page, request) => communityRequest<PageSlice<T>>(page, request), path, options)

/** wiki-service's public catalog, read without the reader's token so its answers stay cacheable. */
export const wikiPublicRequest = createApiRequest({
  root: WIKI_API_ROOT,
  token: () => null,
  describe: (status, problem) => problem.detail || `HTTP ${status}`,
})

/** wiki-service, for the shared user profile; every one of these requests is the reader's own. */
export const wikiRequest = createApiRequest({
  root: WIKI_API_ROOT,
  token: () => accessToken(),
  describe: (status, problem) => problem.detail || `HTTP ${status}`,
})
