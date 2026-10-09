/** ProblemDetail shape returned by wiki-service (spec 03, section 44). */
export interface ProblemDetail {
  type?: string
  title?: string
  status: number
  detail?: string
  instance?: string
  code: string
  requestId?: string
  parameters?: Record<string, unknown>
  errors?: { path: string; code: string; message: string }[]
}

/** Error raised by the API layer. UI logic must branch on `code`, never on `detail`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly problem: ProblemDetail

  constructor(problem: ProblemDetail) {
    super(problem.detail ?? problem.code)
    this.name = "ApiError"
    this.status = problem.status
    this.code = problem.code
    this.problem = problem
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}

/** Vietnamese messages keyed by stable error codes. */
const MESSAGES: Record<string, string> = {
  VERSION_CONFLICT: "Dữ liệu vừa được người khác thay đổi. Hãy tải lại rồi chỉnh tiếp.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  INVALID_REQUEST: "Dữ liệu gửi lên chưa hợp lệ.",
  ITEM_CATALOG_INVALID: "Danh mục trang bị chưa hợp lệ.",
  PORTRAIT_TARGET_INVALID: "Nơi nhận ảnh chưa hợp lệ.",
  DATA_UNAVAILABLE: "Không đọc được dữ liệu mẫu.",
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const base = MESSAGES[error.code] ?? "Thao tác không thành công."
    return error.problem.errors?.length ? `${base} ${error.problem.errors[0].message}` : base
  }
  return error instanceof Error ? error.message : "Đã có lỗi không xác định."
}

/** Calls `assign` for every field error of an ApiError so forms can show them inline. */
export function forEachFieldError(error: unknown, assign: (path: string, message: string) => void) {
  if (error instanceof ApiError) for (const item of error.problem.errors ?? []) assign(item.path, item.message)
}
