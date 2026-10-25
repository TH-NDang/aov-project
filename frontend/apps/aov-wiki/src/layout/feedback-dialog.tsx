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
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {upload ? (
        <>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="8" cy="9" r="1.5" />
          <path d="m4 17 5-5 4 4 3-3 5 5M16 7h4m-2-2v4" />
        </>
      ) : (
        <>
          <path d="M14 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-9" />
          <path d="m11 12 1-4 7-7 4 4-7 7-5 1Zm6-9 4 4M7 17h7" />
        </>
      )}
    </svg>
  )
}

export function FeedbackDialog() {
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
      setAttachmentError("Bạn có thể chọn tối đa 3 ảnh.")
      return
    }
    if (files.some((file) => !["image/png", "image/jpeg"].includes(file.type))) {
      setAttachmentError("Vui lòng chọn ảnh PNG hoặc JPG.")
      return
    }
    if (files.some((file) => file.size > MAX_IMAGE_BYTES)) {
      setAttachmentError("Mỗi ảnh cần nhỏ hơn hoặc bằng 5 MB.")
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
      setStatus("Đã lưu bản nháp trên thiết bị này.")
    } catch {
      setStatus("Trình duyệt chưa cho phép lưu bản nháp. Nội dung vẫn được giữ khi bạn còn ở trang này.")
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="wiki-feedback-trigger" aria-label="Phản hồi vấn đề" title="Phản hồi vấn đề">
          <FeedbackIcon />
        </button>
      </DialogTrigger>
      <DialogContent className="wiki-feedback-dialog" showCloseButton={false}>
        <div className="wiki-feedback-heading">
          <DialogTitle>Phản hồi vấn đề</DialogTitle>
          <DialogClose className="wiki-feedback-close" aria-label="Đóng phản hồi">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </DialogClose>
        </div>
        <DialogDescription className="wiki-feedback-note">
          Bản nháp được lưu trên thiết bị này, chưa gửi đến quản trị viên.
        </DialogDescription>
        <form className="wiki-feedback-form" onSubmit={saveDraft}>
          <div>
            <label className="wiki-feedback-label" htmlFor={`${fieldId}-description`}>
              Mô tả vấn đề <span aria-hidden="true">*</span>
            </label>
            <div className="wiki-feedback-description">
              <textarea
                id={`${fieldId}-description`}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  setStatus("")
                }}
                placeholder="Bạn gặp vấn đề ở đâu? Hãy mô tả để chúng tôi có thể kiểm tra."
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
              Ảnh minh họa
            </label>
            <div className="wiki-feedback-images">
              {attachments.map((image) => (
                <figure key={image.id}>
                  <img src={image.preview} alt={image.name} />
                  <button type="button" aria-label={`Xóa ảnh ${image.name}`} onClick={() => removeAttachment(image.id)}>
                    ×
                  </button>
                </figure>
              ))}
              {attachments.length < MAX_IMAGES && (
                <label className="wiki-feedback-upload" htmlFor={`${fieldId}-images`}>
                  <FeedbackIcon upload />
                  <span>Thêm ảnh</span>
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
              Tối đa 3 ảnh PNG/JPG, 5 MB mỗi ảnh. Ảnh chỉ giữ khi bạn còn ở trang này.
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
            Lưu bản nháp
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
