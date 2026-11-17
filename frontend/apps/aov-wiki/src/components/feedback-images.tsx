import { useEffect, useId, useRef, useState, type ChangeEvent } from "react"
import { useWikiText } from "../context/wiki-context"
import { WikiIcon } from "./wiki-icon"
const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

interface Attachment {
  id: string
  name: string
  preview: string
}

export function FeedbackImages() {
  const text = useWikiText()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentError, setAttachmentError] = useState("")
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

  return (
    <div className="wiki-feedback-attachments">
      <label className="wiki-field-label" htmlFor={`${fieldId}-images`}>
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
            <WikiIcon name="imagePlus" />
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
          "Ảnh chỉ để đối chiếu trên thiết bị và không được gửi. Tối đa 3 ảnh PNG/JPG, 5 MB mỗi ảnh.",
          "These images are for local comparison only and are not sent. Up to 3 PNG/JPG images, 5 MB each.",
        )}
      </p>
      {attachmentError && (
        <p className="wiki-feedback-error" role="alert">
          {attachmentError}
        </p>
      )}
    </div>
  )
}
