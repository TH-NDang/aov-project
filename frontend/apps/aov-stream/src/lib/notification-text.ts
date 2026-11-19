import type { CommunityNotification, NotificationKind } from "@aov/community-contracts"
import type { LocaleText } from "@aov/ui/lib/locale-text"

type Wording = (parameters: Record<string, string | undefined>) => readonly [vi: string, en: string]

/** Every kind of notification in Vietnamese and in English, worded from its parameters. */
const NOTIFICATION_WORDING: Record<NotificationKind, Wording> = {
  PAGE_POST_PUBLISHED: ({ pageName }) => [`${pageName} vừa đăng bài mới.`, `${pageName} published a new post.`],
  PAGE_LIVE_STARTED: ({ pageName, title }) => [
    `${pageName} đang phát trực tiếp: ${title}`,
    `${pageName} is live: ${title}`,
  ],
  POST_COMMENTED: () => ["Bài viết của bạn có bình luận mới.", "Your post has a new comment."],
  REPORT_RESOLVED: () => ["Báo cáo của bạn đã được xử lý.", "Your report has been handled."],
  PAGE_CLAIM_APPROVED: () => [
    "Yêu cầu quản lý trang đã được chấp thuận.",
    "Your request to manage the page was approved.",
  ],
  PAGE_CLAIM_REJECTED: () => [
    "Yêu cầu quản lý trang cần được xem lại.",
    "Your request to manage the page needs another look.",
  ],
  PAGE_OWNERSHIP_RECEIVED: () => ["Bạn đã nhận quyền quản trị chính của trang.", "You are now the owner of the page."],
  PAGE_MEMBERSHIP_REVOKED: () => [
    "Quyền quản lý trang của bạn đã được thu hồi.",
    "Your access to manage the page was revoked.",
  ],
}

/**
 * The sentence a notification shows, in the language `text` picks. A line sent before kinds existed keeps the sentence
 * it was stored with; a kind this app does not know yet shows that sentence too, or a general one.
 */
export function notificationText(
  item: Pick<CommunityNotification, "kind" | "parameters" | "message">,
  text: LocaleText,
) {
  const wording = item.kind ? (NOTIFICATION_WORDING as Partial<Record<string, Wording>>)[item.kind] : undefined
  if (wording) return text(...wording(item.parameters ?? {}))
  return item.message || text("Bạn có thông báo mới.", "You have a new notification.")
}
