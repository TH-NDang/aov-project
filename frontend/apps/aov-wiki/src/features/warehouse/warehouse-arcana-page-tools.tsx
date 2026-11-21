import { useState } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiText } from "../../context/wiki-context"
import type { PublishedWarehouseRecord } from "../../lib/warehouse-types"
import { pastedArcanaPage, writeArcanaPage } from "./arcana-page-model"
import { pageArcanaOf } from "./warehouse-arcana-page"
import "./warehouse-arcana-page.css"

/**
 * Beside the view switch while a page is being built: copy a link that opens this very page, or paste such a link (or
 * its `slots` value) to open that page. Reading the clipboard needs a permission some browsers refuse; then a field
 * opens for the reader to paste into.
 */
export function ArcanaPageTools({
  entries,
  onFilters,
}: {
  entries: PublishedWarehouseRecord[]
  onFilters: (filters: Record<string, string | null>) => void
}) {
  const text = useWikiText()
  const [notice, setNotice] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState("")

  const say = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      say(text("Đã sao chép liên kết bảng ngọc này.", "A link to this arcana page is copied."))
    } catch {
      say(text("Trình duyệt không cho sao chép.", "The browser did not allow copying."))
    }
  }
  const apply = (input: string) => {
    const page = pastedArcanaPage(input, pageArcanaOf(entries).arcana)
    if (!page) {
      say(text("Không đọc được bảng ngọc từ nội dung đã dán.", "No arcana page could be read from that."))
      return false
    }
    onFilters({ slots: writeArcanaPage(page) })
    say(text("Đã mở bảng ngọc vừa dán.", "The pasted arcana page is open."))
    return true
  }
  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip && apply(clip)) return
    } catch {
      // No permission to read the clipboard: the field below takes the paste instead.
    }
    setPasting(true)
  }

  return (
    <div className="wiki-arcana-page-tools">
      {notice && (
        <span className="wiki-arcana-page-notice" role="status">
          {notice}
        </span>
      )}
      {pasting && (
        <form
          className="wiki-arcana-page-paste"
          onSubmit={(event) => {
            event.preventDefault()
            if (apply(pasted)) {
              setPasting(false)
              setPasted("")
            }
          }}
        >
          <input
            autoFocus
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setPasting(false)}
            placeholder={text("Dán liên kết bảng ngọc", "Paste an arcana page link")}
            aria-label={text("Liên kết bảng ngọc", "Arcana page link")}
          />
          <button type="submit">{text("Mở", "Open")}</button>
        </form>
      )}
      <button
        type="button"
        onClick={() => void copy()}
        title={text("Sao chép bảng ngọc", "Copy page")}
        aria-label={text("Sao chép bảng ngọc", "Copy page")}
      >
        <WikiIcon name="copy" size={16} />
        <span>{text("Sao chép", "Copy")}</span>
      </button>
      <button
        type="button"
        onClick={() => void paste()}
        title={text("Dán bảng ngọc", "Paste page")}
        aria-label={text("Dán bảng ngọc", "Paste page")}
      >
        <WikiIcon name="paste" size={16} />
        <span>{text("Dán", "Paste")}</span>
      </button>
    </div>
  )
}
