import { useState, type FormEvent } from "react"
import { useLocation } from "react-router"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@aov/ui/components/public-overlay"
import { referenceInputPlainText } from "@aov/ui/lib/reference-input-dom"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { WikiIcon } from "./wiki-icon"
import { ContactRequestError, sendContactRequest } from "../lib/contact-request"
import { FeedbackImages } from "./feedback-images"
import "./feedback-dialog.css"

const draftKey = "aov-wiki:feedback-draft:v1"
interface FeedbackProps {
  target?: string
  identity?: string
  revision?: string
  /** `link` draws the trigger as one more link of a list of links, with its name: the footer's. */
  variant?: "icon" | "link"
  fields?: { label: string; value: string; multiline?: boolean }[]
  onCloseInline?: () => void
}

function readDraft(page: string) {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey) ?? "null")
    if ((value?.page === page || value?.page === page.split("?")[0]) && typeof value.description === "string")
      return value.description
  } catch {
    /* Local draft storage is optional. */
  }
  return ""
}

export function FeedbackDialog(props: FeedbackProps) {
  const location = useLocation()
  const scope = useWikiContext()
  const params = new URLSearchParams(location.search)
  const page = new URLSearchParams()
  for (const key of [
    "tab",
    "item",
    "hero",
    "skill",
    "season",
    "patch",
    "unscoped",
    "rarity",
    "group",
    "role",
    "position",
  ]) {
    const value = params.get(key)
    if (value) page.set(key, value)
  }
  const path = scope.href(location.pathname + (page.size ? "?" + page : ""))
  return <Feedback key={JSON.stringify([path, props.identity, props.revision])} {...props} path={path} />
}

function Feedback({
  target,
  identity,
  revision,
  variant = "icon",
  fields = [],
  onCloseInline,
  path,
}: FeedbackProps & { path: string }) {
  const scope = useWikiContext()
  const text = useWikiText()
  const title = target ? text("Đề xuất chỉnh sửa", "Suggest an edit") : text("Góp ý trang này", "Page feedback")
  const [open, setOpen] = useState(false)
  const [field, setField] = useState(0)
  const [values, setValues] = useState<Record<number, string>>({})
  const [note, setNote] = useState(() => (target ? "" : readDraft(path)))
  const [status, setStatus] = useState("")
  const [receipt, setReceipt] = useState("")
  const [busy, setBusy] = useState(false)
  const selected = fields[field]
  const original = selected ? referenceInputPlainText(selected.value) : ""
  const proposed = selected ? (values[field] ?? original) : note
  const patch = scope.patchVariantId || (!scope.seasonId && scope.options?.currentPatchVariantId)
  const messagePrefix =
    [target || title, identity, revision && `Revision ${revision}`, path, patch && `Patch ${patch}`]
      .filter(Boolean)
      .join("\n") + "\n\n"
  const changedFields = fields.flatMap((item, i) => {
    const value = values[i]?.trim()
    const original = referenceInputPlainText(item.value).trim()
    return value !== undefined && value !== original ? [{ label: item.label, original, value }] : []
  })
  const changes = changedFields.map(
    ({ label, value }) => label + "\n" + (value || text("(Xóa nội dung)", "(Remove text)")),
  )
  if (note.trim()) changes.push((target ? text("Ghi chú", "Note") + "\n" : "") + note.trim())
  const message = messagePrefix + changes.join("\n\n")
  const ready = changes.length > 0 && message.length <= 4000

  function saveDraft() {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ description: note, page: path, savedAt: new Date().toISOString() }),
      )
      setStatus(text("Đã lưu nháp trên thiết bị.", "Draft saved on this device."))
    } catch {
      setStatus(text("Trình duyệt chưa cho phép lưu nháp.", "Draft storage is unavailable."))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setStatus("")
    try {
      const id = await sendContactRequest({
        name: String(data.get("name")).trim(),
        email: String(data.get("email")).trim(),
        topic: "OTHER",
        message,
      })
      setReceipt(id)
      if (!target && readDraft(path)) {
        try {
          localStorage.removeItem(draftKey)
        } catch {
          /* Sending succeeded independently of local storage. */
        }
      }
      setNote("")
      setValues({})
    } catch (error) {
      setStatus(
        error instanceof ContactRequestError && error.status === 429
          ? text("Bạn đã gửi nhiều yêu cầu. Hãy thử lại sau 10 phút.", "Too many requests. Try again in 10 minutes.")
          : text(
              "Chưa gửi được góp ý. Nội dung vẫn ở đây để bạn thử lại.",
              "Could not send your feedback. Your changes are here if you want to retry.",
            ),
      )
    } finally {
      setBusy(false)
    }
  }

  const content = receipt ? (
    <div role="status" className="wiki-feedback-receipt">
      <strong>{text("Đã gửi góp ý", "Feedback sent")}</strong>
      <p>
        {text("Mã tiếp nhận", "Request ID")} · {receipt}
      </p>
      {onCloseInline && (
        <button type="button" className="wiki-button" onClick={onCloseInline}>
          {text("Xem chi tiết", "View details")}
        </button>
      )}
    </div>
  ) : (
    <form onSubmit={submit} className="wiki-feedback-form">
      <fieldset disabled={busy}>
        {onCloseInline &&
          fields.map((item, i) => {
            const props = {
              value: values[i] ?? referenceInputPlainText(item.value),
              maxLength: 4000,
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setValues((current) => ({ ...current, [i]: e.target.value }))
                setStatus("")
              },
            }
            return (
              <label key={i} className="wiki-field">
                <span className="wiki-field-label">{item.label}</span>
                {item.multiline ? (
                  <textarea className="wiki-input" {...props} rows={3} />
                ) : (
                  <input className="wiki-input" {...props} autoFocus={i === 0} />
                )}
              </label>
            )
          })}
        {!onCloseInline && fields.length > 0 && (
          <label className="wiki-field">
            <span className="wiki-field-label">{text("Phần muốn góp ý", "What would you like to change?")}</span>
            <span className="wiki-select">
              <select
                className="wiki-input"
                value={field}
                onChange={(e) => {
                  setField(Number(e.target.value))
                  setStatus("")
                }}
              >
                {fields.map((item, i) => (
                  <option key={i} value={i}>
                    {item.label}
                  </option>
                ))}
                <option value={fields.length}>{text("Góp ý khác", "Other feedback")}</option>
              </select>
              <WikiIcon name="chevron" size={18} />
            </span>
          </label>
        )}
        <label className="wiki-field">
          <span className="wiki-field-label">
            {onCloseInline
              ? text("Ghi chú gửi ban biên tập", "Note to the editors")
              : selected
                ? text("Nội dung đề xuất", "Suggested text")
                : text("Góp ý của bạn", "Your feedback")}
          </span>
          <textarea
            className="wiki-input"
            rows={4}
            value={onCloseInline ? note : proposed}
            maxLength={4000}
            placeholder={text("Mô tả điều cần thay đổi…", "Describe your suggestion…")}
            onChange={(e) => {
              if (!onCloseInline && selected) setValues({ ...values, [field]: e.target.value })
              else setNote(e.target.value)
              setStatus("")
            }}
          />
        </label>
        {onCloseInline && changedFields.length > 0 && (
          <details className="wiki-feedback-original">
            <summary>
              {text("Xem lại thay đổi", "Review changes")} ({changedFields.length})
            </summary>
            {changedFields.map(({ label, original, value }, i) => (
              <div key={i}>
                <strong>{label}</strong>
                <p>
                  {text("Trước", "Before")} · {original || "—"}
                </p>
                <p>
                  {text("Đề xuất", "Proposed")} · {value || "—"}
                </p>
              </div>
            ))}
          </details>
        )}
        {!onCloseInline && selected && (
          <details className="wiki-feedback-original">
            <summary>{text("Đối chiếu nội dung đang hiển thị", "Compare with published text")}</summary>
            <p>{original || "—"}</p>
          </details>
        )}
        {message.length > 4000 && (
          <p role="alert">
            {text(
              `Vui lòng rút ngắn góp ý thêm ${message.length - 4000} ký tự.`,
              `Shorten your feedback by ${message.length - 4000} characters.`,
            )}
          </p>
        )}
        <div className="wiki-feedback-contact">
          <label className="wiki-field">
            <span className="wiki-field-label">{text("Tên của bạn", "Your name")}</span>
            <input className="wiki-input" name="name" required maxLength={200} autoComplete="name" />
          </label>
          <label className="wiki-field">
            <span className="wiki-field-label">{text("Email để phản hồi", "Reply email")}</span>
            <input className="wiki-input" name="email" type="email" required maxLength={254} autoComplete="email" />
          </label>
        </div>
        {!target && (
          <details className="wiki-feedback-original">
            <summary>{text("Ảnh để đối chiếu trên thiết bị", "Local comparison images")}</summary>
            <FeedbackImages />
          </details>
        )}
        <div className="wiki-feedback-actions">
          {onCloseInline && (
            <button type="button" className="wiki-button" onClick={onCloseInline}>
              {text("Hủy", "Cancel")}
            </button>
          )}
          {!target && (
            <button type="button" className="wiki-button" disabled={!note.trim()} onClick={saveDraft}>
              {text("Lưu nháp", "Save draft")}
            </button>
          )}
          <button type="submit" className="wiki-button" data-primary="" disabled={!ready || busy}>
            {busy ? text("Đang gửi…", "Sending…") : text("Gửi góp ý", "Send feedback")}
          </button>
        </div>
      </fieldset>
      {status && (
        <p role="status" className="wiki-feedback-status">
          {status}
        </p>
      )}
    </form>
  )
  const reviewNote = text(
    "Ban biên tập sẽ xem xét góp ý trước khi cập nhật.",
    "Editors review suggestions before updating the wiki.",
  )
  if (onCloseInline)
    return (
      <section aria-label={title} className="wiki-feedback-inline">
        <p className="wiki-feedback-note">{reviewNote}</p>
        {content}
      </section>
    )
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setOpen(next)
          setStatus("")
          if (next) setReceipt("")
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="wiki-feedback-trigger"
          data-variant={variant}
          title={target ? `${title} · ${target}` : title}
          aria-label={target ? `${title} · ${target}` : title}
        >
          <WikiIcon name="feedback" size={17} />
          {variant === "link" && title}
        </button>
      </DialogTrigger>
      <DialogContent className="wiki-feedback-dialog" showCloseButton={false}>
        <div className="wiki-feedback-heading">
          <DialogTitle>{title}</DialogTitle>
          <DialogClose className="wiki-feedback-close" aria-label={text("Đóng", "Close")} disabled={busy}>
            <WikiIcon name="close" size={18} />
          </DialogClose>
        </div>
        <DialogDescription className="wiki-feedback-note">
          {target && <strong>{target} · </strong>}
          {reviewNote}
        </DialogDescription>
        {content}
      </DialogContent>
    </Dialog>
  )
}
