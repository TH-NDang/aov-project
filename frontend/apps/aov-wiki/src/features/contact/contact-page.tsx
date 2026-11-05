import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router"
import { WikiHeader } from "../../components/wiki-header"

import { useWikiContext, wikiText } from "../../context/wiki-context"

import { ContactRequestError, sendContactRequest } from "./contact-request"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const field = "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 outline-none focus:border-gold"

export function ContactPage() {
  const { href, locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [params] = useSearchParams()
  const assetId = params.get("assetId")
  const versionId = params.get("versionId")
  const hasImage = !!assetId && !!versionId && uuid.test(assetId) && uuid.test(versionId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [receipt, setReceipt] = useState("")
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
      <title>{text("Liên hệ — AOV Wiki", "Contact — AOV Wiki")}</title>
      <WikiHeader />
      <main id="main" className="wiki-contact-page">
        <Link to={href("/")} className="text-sm text-gold">
          ← {text("Về trang chủ", "Back home")}
        </Link>
        <h1 className="mt-6">{text("Liên hệ", "Contact")}</h1>
        <p className="mt-3 leading-7 text-white/70">
          {text(
            "Gửi nguồn ảnh, đề nghị ghi công hoặc báo vấn đề về hình ảnh cho ban quản trị AOV Wiki.",
            "Send image sources, attribution requests or image reports to the AOV Wiki editors.",
          )}
        </p>
        {hasImage && (
          <p className="mt-5 rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm">
            {text(
              "Yêu cầu sẽ được đính kèm đúng ảnh và phiên bản bạn vừa xem.",
              "Your request will include the image and version you viewed.",
            )}
          </p>
        )}
        {(assetId || versionId) && !hasImage && (
          <p role="alert" className="mt-4 text-amber-300">
            {text(
              "Liên kết ảnh không hợp lệ. Bạn vẫn có thể mô tả ảnh trong nội dung bên dưới.",
              "This image link is invalid. Please describe the image below.",
            )}
          </p>
        )}
        {receipt ? (
          <section role="status" className="mt-8 space-y-3 rounded-xl border border-gold/30 p-6">
            <h2 className="text-xl text-gold">{text("Đã nhận yêu cầu", "Request received")}</h2>
            <p>{text("Yêu cầu đã được lưu cho ban quản trị.", "Your request has been saved for the editors.")}</p>
            <p className="break-all text-sm text-white/60">
              {text("Mã tiếp nhận:", "Request ID:")} {receipt}
            </p>
            <button className="underline" type="button" onClick={() => setReceipt("")}>
              {text("Gửi yêu cầu khác", "Send another request")}
            </button>
          </section>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy} className="space-y-5">
              <label className="grid gap-2 text-sm">
                {text("Tên của bạn", "Your name")}
                <input className={field} name="name" required maxLength={200} autoComplete="name" />
              </label>
              <label className="grid gap-2 text-sm">
                {text("Email để phản hồi", "Reply email")}
                <input className={field} name="email" type="email" required maxLength={254} autoComplete="email" />
              </label>
              <label className="grid gap-2 text-sm">
                {text("Nội dung liên hệ", "Topic")}
                <select className={field} name="topic" defaultValue={hasImage ? "SOURCE" : "OTHER"}>
                  <option value="SOURCE">
                    {text("Bổ sung / đính chính nguồn ảnh", "Add or correct an image source")}
                  </option>
                  <option value="RIGHTS">
                    {text("Quyền sử dụng / yêu cầu gỡ ảnh", "Usage rights or image removal")}
                  </option>
                  <option value="OTHER">{text("Nội dung khác", "Other")}</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                {text("Chi tiết", "Details")}
                <textarea
                  className={`${field} min-h-40`}
                  name="message"
                  required
                  maxLength={4000}
                  placeholder={text(
                    "Ảnh liên quan, tên cần ghi công và liên kết đối chiếu…",
                    "Image, attribution name and reference links…",
                  )}
                />
              </label>
              <p className="text-xs leading-5 text-white/55">
                {text(
                  "Tên, email và nội dung chỉ dành cho quản trị viên có quyền quản lý ảnh để xử lý yêu cầu.",
                  "Your name, email and message are available only to administrators who manage images and process requests.",
                )}
              </p>
              <button type="submit" className="rounded-lg bg-gold px-5 py-3 font-medium text-black disabled:opacity-50">
                {busy ? text("Đang gửi…", "Sending…") : text("Gửi liên hệ", "Send request")}
              </button>
            </fieldset>
            {error && (
              <p role="alert" className="text-red-300">
                {error}
              </p>
            )}
          </form>
        )}
      </main>
    </>
  )
}
