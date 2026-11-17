import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CommunityPost } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { refreshPostLists } from "../../../lib/community-keys"

const REPORT_REASONS: readonly (readonly [string, string])[] = [
  ["Spam hoặc quảng cáo", "Spam or advertising"],
  ["Thông tin sai", "False information"],
  ["Ngôn từ xúc phạm", "Abusive language"],
  ["Nội dung phản cảm", "Offensive content"],
  ["Mạo danh", "Impersonation"],
]

/** Edits a post in place: the title of a news post and the text, then posts it or keeps it as a draft. */
export function PostEditForm({ post, onClose }: { post: CommunityPost; onClose: () => void }) {
  const { text } = useStreamLocale()
  const client = useQueryClient()
  const [editedBody, setEditedBody] = useState(post.body)
  const [editedTitle, setEditedTitle] = useState(post.title || "")
  const edit = useMutation({
    mutationFn: (publish: boolean) =>
      communityApi.editPost(post.pageId, post.id, {
        version: post.version,
        kind: post.kind,
        title: editedTitle,
        body: editedBody,
        videoUrl: post.videoUrl,
        imageUrls: post.imageUrls,
        asPage: post.asPage,
        publish,
      }),
    onSuccess: async () => {
      onClose()
      await refreshPostLists(client)
    },
  })
  return (
    <>
      <form
        className="cp-inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          edit.mutate(true)
        }}
      >
        {post.kind === "NEWS" && (
          <label>
            {text("Tiêu đề", "Title")}
            <input
              required
              maxLength={200}
              value={editedTitle}
              onChange={(event) => setEditedTitle(event.target.value)}
            />
          </label>
        )}
        <label>
          {text("Nội dung bài viết", "Post content")}
          <textarea
            required={post.kind !== "VIDEO"}
            maxLength={20000}
            rows={5}
            value={editedBody}
            onChange={(event) => setEditedBody(event.target.value)}
          />
        </label>
        <div className="cp-actions">
          <button className="cp-button cp-primary" disabled={edit.isPending}>
            {text("Lưu & đăng", "Save & post")}
          </button>
          <button
            type="button"
            className="cp-button"
            disabled={edit.isPending || (post.kind !== "VIDEO" && !editedBody.trim())}
            onClick={() => edit.mutate(false)}
          >
            {text("Giữ ở bản nháp", "Keep as draft")}
          </button>
          <button type="button" className="cp-button" onClick={onClose}>
            {text("Hủy", "Cancel")}
          </button>
        </div>
      </form>
      {edit.isError && (
        <p className="cp-error" role="alert">
          {edit.error.message}
        </p>
      )}
    </>
  )
}

/**
 * Reports a post, or one of its comments when `commentId` is given, to the page's moderators. Once sent it says so in
 * place of the form.
 */
export function PostReportForm({
  post,
  commentId,
  onClose,
}: {
  post: CommunityPost
  commentId?: string
  onClose: () => void
}) {
  const { text } = useStreamLocale()
  const [reason, setReason] = useState("")
  const report = useMutation({
    mutationFn: () => communityApi.report(post.pageId, { postId: post.id, commentId, reason }),
  })
  if (report.isSuccess)
    return (
      <p className="cp-success" role="status">
        {text("Đã gửi báo cáo.", "Report sent.")}
      </p>
    )
  return (
    <>
      <form
        className="cp-inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          report.mutate()
        }}
      >
        <fieldset>
          <legend>
            {commentId
              ? text("Lý do báo cáo bình luận", "Reason for reporting the comment")
              : text("Lý do báo cáo bài viết", "Reason for reporting the post")}
          </legend>
          <div className="hub-pills">
            {REPORT_REASONS.map((names) => text(...names)).map((option) => (
              <button type="button" key={option} aria-pressed={reason === option} onClick={() => setReason(option)}>
                {option}
              </button>
            ))}
          </div>
          <label>
            <span className="sr-only">{text("Mô tả lý do", "Describe the reason")}</span>
            <textarea
              required
              rows={2}
              maxLength={2000}
              placeholder={text("Chọn một lý do ở trên hoặc tự mô tả…", "Choose a reason above or describe it…")}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </fieldset>
        <div className="cp-actions">
          <button className="cp-button cp-primary" disabled={report.isPending}>
            {text("Gửi báo cáo", "Send report")}
          </button>
          <button type="button" className="cp-button" onClick={onClose}>
            {text("Hủy", "Cancel")}
          </button>
        </div>
      </form>
      {report.isError && (
        <p className="cp-error" role="alert">
          {report.error.message}
        </p>
      )}
    </>
  )
}
