import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { postKindLabels, type PageRole, type PostKind } from "@aov/community-contracts"
import { StreamIcon, type StreamIconName } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { refreshPostLists } from "../../../lib/community-keys"
import { useCommunitySession } from "../../../lib/stream-auth"
import { AuthorMark } from "./post-comments"
import "./post-composer.css"

/** The English name of each post kind; `postKindLabels` holds the Vietnamese one. */
const postKindEnglish: Record<PostKind, string> = { TEXT: "Post", NEWS: "News", VIDEO: "Video" }
const kindIcons: Record<PostKind, StreamIconName> = { TEXT: "edit", NEWS: "news", VIDEO: "play" }
const kinds = Object.keys(postKindLabels) as PostKind[]

/** Images a post carries at most. */
const IMAGES = 4

/** Image links typed one per line. */
const imageLines = (value: string) =>
  value
    .split(/\s+/)
    .map((line) => line.trim())
    .filter(Boolean)

/**
 * The place to write a post: one line that opens into the form of the kind asked for. `manage` is the page's own
 * manager, where an owner or editor writes as the page first.
 */
export function PostComposer({
  pageId,
  pageName,
  role,
  manage,
}: {
  pageId: string
  pageName: string
  role: PageRole | ""
  manage: boolean
}) {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const [kind, setKind] = useState<PostKind | null>(null)
  return (
    <section className="pw" data-open={kind != null || undefined} aria-label={text("Viết bài mới", "Write a new post")}>
      <span className="pw-self">
        <AuthorMark name={session.name} />
      </span>
      {kind ? (
        <ComposerForm
          kind={kind}
          setKind={setKind}
          pageId={pageId}
          pageName={pageName}
          role={role}
          manage={manage}
          close={() => setKind(null)}
        />
      ) : (
        <div className="pw-line">
          <button type="button" className="pw-prompt" onClick={() => setKind("TEXT")}>
            {text(`Viết trên trang ${pageName}…`, `Write on the page of ${pageName}…`)}
          </button>
          {kinds
            .filter((value) => value !== "TEXT")
            .map((value) => (
              <button key={value} type="button" className="pw-kind" onClick={() => setKind(value)}>
                <StreamIcon name={kindIcons[value]} size={18} />
                {text(postKindLabels[value], postKindEnglish[value])}
              </button>
            ))}
        </div>
      )}
    </section>
  )
}

function ComposerForm({
  kind,
  setKind,
  pageId,
  pageName,
  role,
  manage,
  close,
}: {
  kind: PostKind
  setKind: (kind: PostKind) => void
  pageId: string
  pageName: string
  role: PageRole | ""
  manage: boolean
  close: () => void
}) {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const client = useQueryClient()
  const editor = ["OWNER", "EDITOR"].includes(role)
  const [body, setBody] = useState("")
  const [title, setTitle] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [images, setImages] = useState("")
  const [asPage, setAsPage] = useState(manage && editor)
  const imageUrls = imageLines(images)
  const ready =
    (kind === "VIDEO" ? !!videoUrl.trim() : !!body.trim()) &&
    (kind !== "NEWS" || !!title.trim()) &&
    imageUrls.length <= IMAGES
  const write = useMutation({
    mutationFn: (publish: boolean) =>
      communityApi.writePost(pageId, {
        kind,
        title: kind === "NEWS" ? title : null,
        body,
        videoUrl: kind === "VIDEO" ? videoUrl : null,
        imageUrls,
        asPage,
        publish,
      }),
    onSuccess: async () => {
      close()
      await refreshPostLists(client)
    },
  })
  return (
    <form
      className="pw-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) write.mutate(true)
      }}
    >
      <div className="pw-kinds" role="group" aria-label={text("Dạng bài viết", "Post type")}>
        {kinds.map((value) => (
          <button
            key={value}
            type="button"
            className="pw-kind"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
          >
            <StreamIcon name={kindIcons[value]} size={18} />
            {text(postKindLabels[value], postKindEnglish[value])}
          </button>
        ))}
        <button type="button" className="hub-icon-button pw-close" aria-label={text("Đóng", "Close")} onClick={close}>
          <StreamIcon name="close" size={18} />
        </button>
      </div>
      {kind === "NEWS" && (
        <label>
          <span className="sr-only">{text("Tiêu đề tin", "News title")}</span>
          <input
            required
            autoFocus
            className="pw-title"
            maxLength={200}
            value={title}
            placeholder={text("Tiêu đề tin", "News title")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
      )}
      {kind === "VIDEO" && (
        <label>
          <span className="sr-only">{text("Đường dẫn video", "Video link")}</span>
          <input
            required
            autoFocus
            type="url"
            maxLength={2000}
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder={text("Link YouTube, Facebook hoặc TikTok", "YouTube, Facebook or TikTok link")}
          />
        </label>
      )}
      <label>
        <span className="sr-only">{text("Nội dung bài viết", "Post content")}</span>
        <textarea
          required={kind !== "VIDEO"}
          autoFocus={kind === "TEXT"}
          className="pw-body"
          rows={3}
          maxLength={20000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={
            kind === "VIDEO"
              ? text("Mô tả (không bắt buộc)", "Description (optional)")
              : kind === "NEWS"
                ? text("Nội dung tin", "News content")
                : text(`Chia sẻ suy nghĩ của bạn về ${pageName}…`, `Share your thoughts about ${pageName}…`)
          }
        />
      </label>
      {imageUrls.length > 0 && imageUrls.length <= IMAGES && (
        <div className="pw-images" aria-hidden="true">
          {imageUrls.map((url, index) => (
            <img key={`${url}-${index}`} src={url} alt="" />
          ))}
        </div>
      )}
      <details className="pw-image-links">
        <summary>{text(`Thêm ảnh bằng đường dẫn (tối đa ${IMAGES})`, `Add images by link (up to ${IMAGES})`)}</summary>
        <label>
          <span className="sr-only">{text("Đường dẫn ảnh", "Image links")}</span>
          <textarea
            rows={2}
            value={images}
            onChange={(event) => setImages(event.target.value)}
            placeholder={text("Mỗi dòng một đường dẫn ảnh https://…", "One image link per line https://…")}
            aria-invalid={imageUrls.length > IMAGES || undefined}
          />
        </label>
        {imageUrls.length > IMAGES && (
          <p className="cp-field-error">
            {text(`Chỉ đính kèm được tối đa ${IMAGES} ảnh.`, `Only up to ${IMAGES} images can be attached.`)}
          </p>
        )}
      </details>
      <div className="pw-actions">
        {editor && (
          <label className="cp-inline-label">
            {text("Đăng với tư cách", "Post as")}
            <select value={asPage ? "page" : "self"} onChange={(event) => setAsPage(event.target.value === "page")}>
              <option value="self">{session.name}</option>
              <option value="page">{pageName}</option>
            </select>
          </label>
        )}
        <div className="pw-send">
          <button
            type="button"
            className="cp-button"
            disabled={write.isPending || !ready}
            onClick={() => write.mutate(false)}
          >
            {text("Lưu nháp", "Save draft")}
          </button>
          <button className="cp-button cp-primary" disabled={write.isPending || !ready}>
            <StreamIcon name="send" size={16} />
            {text("Đăng bài", "Post")}
          </button>
        </div>
      </div>
      {write.isError && (
        <p role="alert" className="cp-field-error">
          {write.error.message}
        </p>
      )}
    </form>
  )
}
