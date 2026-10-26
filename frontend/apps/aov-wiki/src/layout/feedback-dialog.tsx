import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@aov/ui/components/dialog"
import "./feedback-dialog.css"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { WikiIcon } from "../components/wiki-icon"

const DRAFT_KEY = "aov-wiki:feedback-draft:v1"
const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

interface Attachment {
  id: string
  name: string
  preview: string
}

function savedDescription() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null")
    return value && typeof value === "object" && "description" in value && typeof value.description === "string"
      ? value.description.slice(0, 1000)
      : ""
  } catch {
    return ""
  }
}

function FeedbackIcon({ upload = false }: { upload?: boolean }) {
  return <WikiIcon name={upload ? "imagePlus" : "feedback"} />
}

export function FeedbackDialog() {
  const { locale, t } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [description, setDescription] = useState(savedDescription)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentError, setAttachmentError] = useState("")
  const [status, setStatus] = useState("")
  const previewUrls = useRef(new Map<string, string>())
  const fieldId = useId()

  useEffect(() => {
    const urls = previewUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || [])
    event.currentTarget.value = ""
    setAttachmentError("")

    if (attachments.length + files.length > MAX_IMAGES) {
      setAttachmentError(text("Bạn có thể chọn tối đa 3 ảnh.", "Choose up to 3 images."))
      return
    }
    if (files.some((file) => !["image/png", "image/jpeg"].includes(file.type))) {
      setAttachmentError(text("Vui lòng chọn ảnh PNG hoặc JPG.", "Choose PNG or JPG images."))
      return
    }
    if (files.some((file) => file.size > MAX_IMAGE_BYTES)) {
      setAttachmentError(text("Mỗi ảnh cần nhỏ hơn hoặc bằng 5 MB.", "Each image must be 5 MB or smaller."))
      return
    }

    const selected = files.map((file) => {
      const id = crypto.randomUUID()
      const preview = URL.createObjectURL(file)
      previewUrls.current.set(id, preview)
      return { id, name: file.name, preview }
    })
    setAttachments((current) => [...current, ...selected])
  }

  function removeAttachment(id: string) {
    const preview = previewUrls.current.get(id)
    if (preview) URL.revokeObjectURL(preview)
    previewUrls.current.delete(id)
    setAttachments((current) => current.filter((image) => image.id !== id))
    setAttachmentError("")
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!description.trim()) return

    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ description, page: window.location.pathname, savedAt: new Date().toISOString() }),
      )
      setStatus(text("Đã lưu bản nháp trên thiết bị này.", "Draft saved on this device."))
    } catch {
      setStatus(
        text(
          "Trình duyệt chưa cho phép lưu bản nháp. Nội dung vẫn được giữ khi bạn còn ở trang này.",
          "Draft storage is unavailable. Your text is kept while this page stays open.",
        ),
      )
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="wiki-feedback-trigger" aria-label={t("feedback")} title={t("feedback")}>
          <FeedbackIcon />
        </button>
      </DialogTrigger>
      <DialogContent className="wiki-feedback-dialog" showCloseButton={false}>
        <div className="wiki-feedback-heading">
          <DialogTitle>{t("feedback")}</DialogTitle>
          <DialogClose className="wiki-feedback-close" aria-label={t("close")}>
            <WikiIcon name="close" size={18} />
          </DialogClose>
        </div>
        <DialogDescription className="wiki-feedback-note">
          {text(
            "Bản nháp được lưu trên thiết bị này, chưa gửi đến quản trị viên.",
            "Drafts stay on this device and are not sent to an administrator.",
          )}
        </DialogDescription>
        <form className="wiki-feedback-form" onSubmit={saveDraft}>
          <div>
            <label className="wiki-feedback-label" htmlFor={`${fieldId}-description`}>
              {text("Mô tả vấn đề", "Describe the issue")} <span aria-hidden="true">*</span>
            </label>
            <div className="wiki-feedback-description">
              <textarea
                id={`${fieldId}-description`}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  setStatus("")
                }}
                placeholder={text(
                  "Bạn gặp vấn đề ở đâu? Hãy mô tả để chúng tôi có thể kiểm tra.",
                  "Where did you encounter the issue? Describe it here.",
                )}
                required
                maxLength={1000}
              />
              <span className="wiki-feedback-counter" aria-live="off">
                {description.length}/1000
              </span>
            </div>
          </div>
          <div>
            <label className="wiki-feedback-label" htmlFor={`${fieldId}-images`}>
              {text("Ảnh minh họa", "Screenshots")}
            </label>
            <div className="wiki-feedback-images">
              {attachments.map((image) => (
                <figure key={image.id}>
                  <img src={image.preview} alt={image.name} />
                  <button
                    type="button"
                    aria-label={text(`Xóa ảnh ${image.name}`, `Remove image ${image.name}`)}
                    onClick={() => removeAttachment(image.id)}
                  >
                    <WikiIcon name="close" size={12} />
                  </button>
                </figure>
              ))}
              {attachments.length < MAX_IMAGES && (
                <label className="wiki-feedback-upload" htmlFor={`${fieldId}-images`}>
                  <FeedbackIcon upload />
                  <span>{text("Thêm ảnh", "Add image")}</span>
                  <input
                    id={`${fieldId}-images`}
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    onChange={addAttachments}
                  />
                </label>
              )}
            </div>
            <p className="wiki-feedback-image-note">
              {text(
                "Tối đa 3 ảnh PNG/JPG, 5 MB mỗi ảnh. Ảnh chỉ giữ khi bạn còn ở trang này.",
                "Up to 3 PNG/JPG images, 5 MB each. Images are kept only while this page stays open.",
              )}
            </p>
            {attachmentError && (
              <p className="wiki-feedback-error" role="alert">
                {attachmentError}
              </p>
            )}
          </div>
          {status && (
            <p className="wiki-feedback-status" role="status">
              {status}
            </p>
          )}
          <button className="wiki-feedback-save" type="submit" disabled={!description.trim()}>
            {text("Lưu bản nháp", "Save draft")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
