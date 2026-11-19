import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import type { CommunityProfile, PageViewer, ProfilePresentation } from "@aov/community-contracts"
import { SOCIAL_PLATFORM_NAMES, SocialPlatformIcon, socialPlatformName } from "@aov/ui/components/social-platform-icon"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { useManagerRefresh } from "./use-manager-refresh"

type ProfileLink = ProfilePresentation["links"][number]

/** The introduction, pictures and contact channels of a page, as its managers edit them. */
export function PagePresentationForm({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const { text } = useStreamLocale()
  const refresh = useManagerRefresh()
  const [presentation, setPresentation] = useState<ProfilePresentation>({
    biography: profile.content?.biography,
    avatarUrl: profile.content?.avatarUrl,
    coverUrl: profile.content?.coverUrl,
    links: profile.content?.links || [],
  })
  const save = useMutation({
    mutationFn: () => communityApi.savePresentation(profile.id, { version: viewer.version, content: presentation }),
    onSuccess: refresh,
  })
  const readOnly = viewer.role === "MODERATOR"
  const setLink = (index: number, change: (link: ProfileLink) => ProfileLink) =>
    setPresentation({
      ...presentation,
      links: presentation.links.map((item, position) => (position === index ? change(item) : item)),
    })
  return (
    <form
      className="cp-section"
      aria-labelledby="manage-presentation"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <div className="tn-heading" data-flush="">
        <h2 id="manage-presentation">{text("Giới thiệu trang", "Page introduction")}</h2>
      </div>
      <p className="cp-section-lead">
        {readOnly
          ? text(
              "Kiểm duyệt viên xem được phần này; quản trị chính và biên tập viên mới sửa được.",
              "Moderators can see this part; only the main administrator and editors can change it.",
            )
          : text(
              "Lịch sử và kết quả thi đấu được biên tập riêng; bạn có thể đề xuất chỉnh sửa từ trang công khai.",
              "History and competition results are edited separately; you can suggest edits from the public page.",
            )}
      </p>
      <fieldset disabled={readOnly || save.isPending}>
        <label>
          {text("Giới thiệu", "Introduction")}
          <textarea
            rows={6}
            maxLength={10000}
            value={presentation.biography || ""}
            onChange={(event) => setPresentation({ ...presentation, biography: event.target.value })}
          />
        </label>
        <div className="cp-field-pair">
          <label>
            {text("Ảnh đại diện", "Avatar")}
            <input
              type="url"
              placeholder="https://…"
              value={presentation.avatarUrl || ""}
              onChange={(event) => setPresentation({ ...presentation, avatarUrl: event.target.value })}
            />
            <ImageLinkPreview url={presentation.avatarUrl} />
          </label>
          <label>
            {text("Ảnh bìa", "Cover image")}
            <input
              type="url"
              placeholder="https://…"
              value={presentation.coverUrl || ""}
              onChange={(event) => setPresentation({ ...presentation, coverUrl: event.target.value })}
            />
            <ImageLinkPreview url={presentation.coverUrl} wide />
          </label>
        </div>
        <h3 className="cp-subheading">{text("Kênh liên hệ", "Contact channels")}</h3>
        <datalist id="cp-channel-names">
          {SOCIAL_PLATFORM_NAMES.map((platform) => (
            <option key={platform} value={platform} />
          ))}
        </datalist>
        {!presentation.links.length && (
          <p className="cp-section-lead">
            {text("Trang chưa có kênh liên hệ nào.", "The page has no contact channel yet.")}
          </p>
        )}
        {presentation.links.map((link, index) => (
          <div className="cp-link-field" key={index}>
            <label>
              <span className="cp-link-label">{text("Đường dẫn", "Link")}</span>
              <input
                type="url"
                required
                placeholder="https://…"
                value={link.url}
                onChange={(event) =>
                  setLink(index, (item) => ({
                    ...item,
                    url: event.target.value,
                    // The name follows the link until someone writes their own.
                    label:
                      !item.label || item.label === socialPlatformName(item.url)
                        ? (socialPlatformName(event.target.value) ?? item.label)
                        : item.label,
                  }))
                }
              />
            </label>
            <label>
              <span className="cp-link-label">
                {link.url && <SocialPlatformIcon url={link.url} size={15} />}
                {text("Tên kênh", "Channel name")}
              </span>
              <input
                required
                list="cp-channel-names"
                placeholder={text("Tự điền theo đường dẫn", "Auto-filled from the link")}
                value={link.label}
                onChange={(event) => setLink(index, (item) => ({ ...item, label: event.target.value }))}
              />
            </label>
            <button
              type="button"
              className="hub-icon-button cp-link-remove"
              aria-label={text(
                `Gỡ kênh ${link.label || link.url || index + 1}`,
                `Remove channel ${link.label || link.url || index + 1}`,
              )}
              title={text("Gỡ kênh", "Remove channel")}
              onClick={() =>
                setPresentation({
                  ...presentation,
                  links: presentation.links.filter((_, position) => position !== index),
                })
              }
            >
              <StreamIcon name="close" size={16} />
            </button>
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            className="cp-button cp-quiet cp-link-add"
            onClick={() => setPresentation({ ...presentation, links: [...presentation.links, { label: "", url: "" }] })}
          >
            <StreamIcon name="plus" size={15} />
            {text("Thêm kênh", "Add channel")}
          </button>
        )}
      </fieldset>
      {save.isError && (
        <p className="cp-field-error" role="alert">
          {save.error.message}
        </p>
      )}
      {!readOnly && (
        <div className="cp-form-actions">
          <button className="cp-button cp-primary" disabled={save.isPending}>
            {save.isPending ? text("Đang lưu…", "Saving…") : text("Lưu giới thiệu", "Save introduction")}
          </button>
        </div>
      )}
    </form>
  )
}

/** Shows what an image link points to, so a wrong link is noticed before saving. */
function ImageLinkPreview({ url, wide = false }: { url?: string | null; wide?: boolean }) {
  const { text } = useStreamLocale()
  const [failed, setFailed] = useState<string | null>(null)
  const value = url?.trim()
  if (!value || !/^https?:\/\//i.test(value)) return null
  if (failed === value)
    return (
      <span className="cp-field-error">
        {text("Không xem trước được ảnh từ liên kết này.", "The image from this link could not be previewed.")}
      </span>
    )
  return (
    <img
      className={wide ? "cp-image-preview cp-image-preview-wide" : "cp-image-preview"}
      src={value}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(value)}
    />
  )
}
