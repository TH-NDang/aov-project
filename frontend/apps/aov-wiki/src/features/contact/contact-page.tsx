import { useState, type FormEvent } from "react"
import { useSearchParams } from "react-router"
import { WikiHeader } from "../../components/wiki-header"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { contactMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { ContactRequestError, sendContactRequest } from "../../lib/contact-request"
import { SITE_NAME } from "../../lib/seo/page-meta"
import "./contact.css"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The form readers use to send image sources, attribution requests and image reports to the editors. */
export function ContactPage() {
  const { locale } = useWikiContext()
  const text = useWikiText()
  usePageHead(contactMeta(locale))
  const [params] = useSearchParams()
  const assetId = params.get("assetId")
  const versionId = params.get("versionId")
  const hasImage = !!assetId && !!versionId && uuid.test(assetId) && uuid.test(versionId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [receipt, setReceipt] = useState("")
  const title = text("Liên hệ", "Contact")
  const lead = text(
    `Gửi nguồn ảnh, đề nghị ghi công hoặc báo vấn đề về hình ảnh cho ban quản trị ${SITE_NAME}.`,
    `Send image sources, attribution requests or image reports to the ${SITE_NAME} editors.`,
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    setError("")
    try {
      const id = await sendContactRequest({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        topic: String(data.get("topic") ?? "OTHER"),
        message: String(data.get("message") ?? ""),
        assetId: hasImage ? assetId : null,
        versionId: hasImage ? versionId : null,
      })
      setReceipt(id)
      form.reset()
    } catch (error) {
      setError(
        error instanceof ContactRequestError && error.status === 429
          ? text(
              "Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau 10 phút.",
              "Too many requests. Please try again in 10 minutes.",
            )
          : text(
              "Chưa gửi được yêu cầu. Kiểm tra thông tin và thử lại.",
              "Could not send your request. Check the details and try again.",
            ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <WikiHeader />
      <main id="main" tabIndex={-1} className="wiki-contact-page">
        <CatalogHeading title={title} lead={lead} compact />
        <div className="wiki-contact-body">
          {hasImage && (
            <p className="wiki-contact-note">
              <WikiIcon name="imagePlus" size={18} />
              {text(
                "Yêu cầu sẽ được đính kèm đúng ảnh và phiên bản bạn vừa xem.",
                "Your request will include the image and version you viewed.",
              )}
            </p>
          )}
          {(assetId || versionId) && !hasImage && (
            <p role="alert" className="wiki-contact-warning">
              {text(
                "Liên kết ảnh không hợp lệ. Bạn vẫn có thể mô tả ảnh trong nội dung bên dưới.",
                "This image link is invalid. Please describe the image below.",
              )}
            </p>
          )}
          {receipt ? (
            <section role="status" className="wiki-contact-receipt" aria-labelledby="wiki-contact-receipt">
              <h2 id="wiki-contact-receipt">
                <WikiIcon name="check" size={20} />
                {text("Đã nhận yêu cầu", "Request received")}
              </h2>
              <p>{text("Yêu cầu đã được lưu cho ban quản trị.", "Your request has been saved for the editors.")}</p>
              <p className="wiki-contact-receipt-id">
                {text("Mã tiếp nhận:", "Request ID:")} {receipt}
              </p>
              <button className="wiki-button" type="button" onClick={() => setReceipt("")}>
                {text("Gửi yêu cầu khác", "Send another request")}
              </button>
            </section>
          ) : (
            <form className="wiki-contact-form" onSubmit={(event) => void submit(event)}>
              <fieldset disabled={busy}>
                <label className="wiki-field">
                  <span className="wiki-field-label">{text("Tên của bạn", "Your name")}</span>
                  <input className="wiki-input" name="name" required maxLength={200} autoComplete="name" />
                </label>
                <label className="wiki-field">
                  <span className="wiki-field-label">{text("Email để phản hồi", "Reply email")}</span>
                  <input
                    className="wiki-input"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                  />
                </label>
                <label className="wiki-field" data-wide="">
                  <span className="wiki-field-label">{text("Nội dung liên hệ", "Topic")}</span>
                  <span className="wiki-select">
                    <select className="wiki-input" name="topic" defaultValue={hasImage ? "SOURCE" : "OTHER"}>
                      <option value="SOURCE">
                        {text("Bổ sung / đính chính nguồn ảnh", "Add or correct an image source")}
                      </option>
                      <option value="RIGHTS">
                        {text("Quyền sử dụng / yêu cầu gỡ ảnh", "Usage rights or image removal")}
                      </option>
                      <option value="OTHER">{text("Nội dung khác", "Other")}</option>
                    </select>
                    <WikiIcon name="chevron" size={18} />
                  </span>
                </label>
                <label className="wiki-field" data-wide="">
                  <span className="wiki-field-label">{text("Chi tiết", "Details")}</span>
                  <textarea
                    className="wiki-input"
                    name="message"
                    required
                    maxLength={4000}
                    rows={6}
                    placeholder={text(
                      "Ảnh liên quan, tên cần ghi công và liên kết đối chiếu…",
                      "Image, attribution name and reference links…",
                    )}
                  />
                </label>
                <p className="wiki-contact-privacy" data-wide="">
                  {text(
                    "Tên, email và nội dung chỉ dành cho quản trị viên có quyền quản lý ảnh để xử lý yêu cầu.",
                    "Your name, email and message are available only to administrators who manage images and process requests.",
                  )}
                </p>
                <div className="wiki-contact-actions" data-wide="">
                  <button type="submit" className="wiki-button" data-primary="">
                    {busy ? text("Đang gửi…", "Sending…") : text("Gửi liên hệ", "Send request")}
                  </button>
                  {error && (
                    <p role="alert" className="wiki-contact-error">
                      {error}
                    </p>
                  )}
                </div>
              </fieldset>
            </form>
          )}
        </div>
      </main>
    </>
  )
}
