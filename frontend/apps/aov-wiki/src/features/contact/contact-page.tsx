import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router"
import { WikiHeader } from "../../components/wiki-header"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const field = "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 outline-none focus:border-gold"

export function ContactPage() {
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
      const response = await fetch("/api/wiki/v1/media/contact-requests", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          topic: data.get("topic"),
          message: data.get("message"),
          assetId: hasImage ? assetId : null,
          versionId: hasImage ? versionId : null,
        }),
      })
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau 10 phút."
            : "Chưa gửi được yêu cầu. Kiểm tra thông tin và thử lại.",
        )
      const result = (await response.json()) as { id: string }
      setReceipt(result.id)
      form.reset()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không kết nối được máy chủ.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <title>Liên hệ — AOV Wiki</title>
      <WikiHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 text-white/90">
        <Link to="/" className="text-sm text-gold">
          ← Về Wiki
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Liên hệ</h1>
        <p className="mt-3 leading-7 text-white/65">
          Gửi thông tin nguồn, đề nghị ghi credit hoặc phản ánh về hình ảnh. Ban quản trị WikiAOV sẽ xem xét yêu cầu của
          bạn.
        </p>
        {hasImage && (
          <p className="mt-5 rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm">
            Yêu cầu sẽ được đính kèm đúng ảnh và phiên bản bạn vừa xem.
          </p>
        )}
        {(assetId || versionId) && !hasImage && (
          <p role="alert" className="mt-4 text-amber-300">
            Liên kết ảnh không hợp lệ. Bạn vẫn có thể mô tả ảnh trong nội dung bên dưới.
          </p>
        )}
        {receipt ? (
          <section role="status" className="mt-8 space-y-3 rounded-xl border border-gold/30 p-6">
            <h2 className="text-xl text-gold">Đã nhận yêu cầu</h2>
            <p>Yêu cầu đã được lưu cho ban quản trị.</p>
            <p className="break-all text-sm text-white/60">Mã tiếp nhận: {receipt}</p>
            <button className="underline" type="button" onClick={() => setReceipt("")}>
              Gửi yêu cầu khác
            </button>
          </section>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy} className="space-y-5">
              <label className="grid gap-2 text-sm">
                Tên của bạn
                <input className={field} name="name" required maxLength={200} autoComplete="name" />
              </label>
              <label className="grid gap-2 text-sm">
                Email để phản hồi
                <input className={field} name="email" type="email" required maxLength={254} autoComplete="email" />
              </label>
              <label className="grid gap-2 text-sm">
                Nội dung liên hệ
                <select className={field} name="topic" defaultValue={hasImage ? "SOURCE" : "OTHER"}>
                  <option value="SOURCE">Bổ sung / đính chính nguồn ảnh</option>
                  <option value="RIGHTS">Quyền sử dụng / yêu cầu gỡ ảnh</option>
                  <option value="OTHER">Nội dung khác</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                Chi tiết
                <textarea
                  className={`${field} min-h-40`}
                  name="message"
                  required
                  maxLength={4000}
                  placeholder="Ảnh liên quan, tên cần ghi credit và liên kết đối chiếu…"
                />
              </label>
              <p className="text-xs leading-5 text-white/55">
                Tên, email và nội dung được lưu để xử lý yêu cầu, chỉ quản trị viên có quyền quản lý ảnh được xem. Thông
                tin của bạn không hiển thị công khai trên ảnh.
              </p>
              <button type="submit" className="rounded-lg bg-gold px-5 py-3 font-medium text-black disabled:opacity-50">
                {busy ? "Đang gửi…" : "Gửi liên hệ"}
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
