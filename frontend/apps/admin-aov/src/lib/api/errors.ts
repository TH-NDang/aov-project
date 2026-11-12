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
  MEDIA_ASSET_IN_USE: "Ảnh còn được sử dụng trong dữ liệu, bản nháp hoặc lịch sử. Gỡ liên kết trước khi xoá.",
  MEDIA_UPLOAD_IN_PROGRESS: "Ảnh đang được tải lên. Chờ hoàn tất rồi thử lại.",
  MEDIA_ASSET_VERSION_CONFLICT: "Ảnh vừa thay đổi. Kiểm tra thông tin mới và xác nhận lại trước khi xoá.",
  MEDIA_DELETION_IN_PROGRESS: "Một yêu cầu khác đang xoá ảnh này. Tiến trình sẽ được cập nhật; hãy chờ rồi thử lại.",
  MEDIA_CACHE_PURGE_NOT_CONFIGURED:
    "Chưa bật cấu hình xoá cache ảnh. Kiểm tra cấu hình rồi khởi động lại dịch vụ Wiki.",
  MEDIA_CACHE_PURGE_FAILED: "File ảnh đã xoá nhưng chưa dọn xong bản lưu đệm. Chọn Tiếp tục xoá để thử lại.",
  MEDIA_COMPETITION_CHECK_FAILED:
    "Chưa xác minh được liên kết thi đấu. Kiểm tra dịch vụ thi đấu và quyền truy cập rồi thử lại.",
  HERO_IMPORT_CONTEXT_CONFLICT: "Patch không thuộc bộ quy tắc đã chọn. Hãy chọn lại mùa và patch.",
  HERO_IMPORT_SNAPSHOT_EXISTS: "Patch này đã có mốc dữ liệu. Chọn loại nhập “Bổ sung / sửa dữ liệu”.",
  HERO_IMPORT_MISSING_BASELINE: "Chưa có mốc dữ liệu phù hợp. Chọn “Dữ liệu ban đầu” để ghi nhận trạng thái đã biết.",
  HERO_IMPORT_DRAFT_CONFLICT:
    "Tướng đang có bản nháp ở patch hoặc loại nhập khác. Hoàn tất hoặc bỏ bản nháp đó trước khi tiếp tục.",
  HERO_REVISION_VERSION_CONFLICT: "Draft đã được người khác sửa. Hãy tải bản mới trước khi tiếp tục.",
  HERO_PATCH_CHANGE_CONFLICT: "Tướng đã có change set trong variant này. Kiểm tra lịch sử đã ghi trước khi thử lại.",
  HERO_DRAFT_EXISTS: "Tướng đã có draft trong ruleset này. Hãy mở draft hiện có.",
  HERO_CODE_EXISTS: "Mã tướng đã tồn tại. Hãy mở tướng trong danh mục backend.",
  HERO_INVALID_CONTENT: "Nội dung section chưa đầy đủ hoặc không hợp lệ. Kiểm tra các trường và nguồn.",
  HERO_INVALID_MEDIA: "Ảnh chưa sẵn sàng hoặc không đúng loại. Chọn asset đã hoàn tất upload.",
  HERO_GALLERY_ITEM_CONFLICT: "Ảnh đã có trong thư viện của tướng, hoặc vừa được sửa ở nơi khác. Tải lại rồi thử lại.",
  HERO_GALLERY_ITEM_NOT_FOUND: "Ảnh không còn trong thư viện của tướng. Tải lại trang.",
  HERO_REVISION_NOT_EDITABLE: "Phiên bản này không còn là draft có thể sửa.",
  HERO_BADGE_NOT_FOUND: "Không tìm thấy nhãn trang phục. Hãy tải lại danh sách.",
  HERO_BADGE_CONFLICT: "Nhãn trang phục vừa được thay đổi. Hãy tải bản mới trước khi chỉnh tiếp.",
  HERO_BADGE_GROUP_NOT_FOUND: "Nhóm bậc hoặc chủ đề không còn tồn tại. Hãy chọn lại nhóm.",
  HERO_BADGE_GROUP_CONFLICT: "Nhóm vừa được thay đổi hoặc mã nhóm đã tồn tại. Hãy tải lại rồi kiểm tra mã nhóm.",
  PATCH_CONTEXT_UNAVAILABLE: "Vùng chưa có ruleset và lịch phát hành có hiệu lực.",
  PATCH_CONFLICT: "Dữ liệu patch trùng hoặc timeline chồng lấn với dữ liệu đã có.",
  PATCH_INVALID: "Thông tin patch chưa hợp lệ. Kiểm tra ruleset, thứ tự và timeline vùng.",
  FORBIDDEN: "Tài khoản chưa có quyền thực hiện thao tác này.",
  VERSION_CONFLICT: "Dữ liệu vừa được người khác thay đổi. Hãy tải lại rồi chỉnh tiếp.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  VIDEO_NOT_FOUND: "Video này không còn tồn tại. Hãy tải lại danh sách.",
  VIDEO_SUBJECT_NOT_FOUND: "Mục được gắn video không còn tồn tại.",
  VIDEO_INVALID: "Thông tin video chưa hợp lệ. Kiểm tra liên kết, tiêu đề và mục được gắn.",
  VIDEO_DUPLICATE: "Video này đã được gắn vào mục đó. Muốn dùng lại cùng video, hãy đặt mốc bắt đầu khác.",
  VIDEO_CONFLICT: "Video vừa được thay đổi ở nơi khác. Hãy tải lại rồi thử lại.",
  INVALID_REQUEST: "Dữ liệu gửi lên chưa hợp lệ.",
  ITEM_CATALOG_INVALID: "Danh mục trang bị chưa hợp lệ.",
  PORTRAIT_TARGET_INVALID: "Nơi nhận ảnh chưa hợp lệ.",
  DATA_UNAVAILABLE: "Không đọc được dữ liệu mẫu.",
  BUILD_CAPTURE_EXISTS: "Lần chụp này đã được nhập.",
  BUILD_CAPTURE_NOT_FOUND: "Không còn lần chụp này.",
  BUILD_NOT_FOUND: "Không còn bộ này trong lần chụp.",
  BUILD_HERO_NOT_FOUND: "Không có tướng này.",
  BUILD_VERSION_CONFLICT: "Người khác vừa sửa mục này. Tải lại trang rồi thử lại.",
  BUILD_REVIEW_OPEN: "Còn bộ chờ duyệt, nên chưa xác nhận được cả lần chụp.",
  BUILD_INVALID: "Dữ liệu build chưa hợp lệ.",
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const required = error.problem.errors?.filter((item) => item.code === "HERO_PUBLICATION_REQUIRED")
    if (required?.length)
      return `Chưa thể xuất bản. Cần bổ sung: ${required
        .map((item) =>
          item.path === "PROFILE.roles"
            ? "vai trò tướng"
            : item.path
                .replace("SKILLS.skills", "kỹ năng")
                .replace(".translations", " · bản dịch")
                .replace(".description", " · mô tả"),
        )
        .join("; ")}.`
    const base = MESSAGES[error.code] ?? "Thao tác không thành công."
    return error.problem.errors?.length ? `${base} ${error.problem.errors[0].message}` : base
  }
  return error instanceof Error ? error.message : "Đã có lỗi không xác định."
}

/** Calls `assign` for every field error of an ApiError so forms can show them inline. */
export function forEachFieldError(error: unknown, assign: (path: string, message: string) => void) {
  if (error instanceof ApiError) for (const item of error.problem.errors ?? []) assign(item.path, item.message)
}
