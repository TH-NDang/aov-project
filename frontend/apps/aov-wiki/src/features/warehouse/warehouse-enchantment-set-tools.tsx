import { useState } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiText } from "../../context/wiki-context"
import type { PublishedWarehouseRecord } from "../../lib/warehouse-types"
import { pastedSetCodes } from "./enchantment-set-codes"

/**
 * Beside the view switch while a set is being built: copy a link that opens this very set, or paste such a link (or
 * the five codes) to open that set. Reading the clipboard needs a permission some browsers refuse; then a field opens
 * for the reader to paste into.
 */
export function EnchantmentSetTools({
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
      say(text("Đã sao chép liên kết bộ này.", "A link to this set is copied."))
    } catch {
      say(text("Trình duyệt không cho sao chép.", "The browser did not allow copying."))
    }
  }
  const apply = (input: string) => {
    const codes = pastedSetCodes(input)
    const known = codes?.every((code) => entries.some((entry) => entry.kind === "enchantments" && entry.code === code))
    if (!codes || !known) {
      say(text("Không đọc được bộ phù hiệu từ nội dung đã dán.", "No enchantment set could be read from that."))
      return false
    }
    onFilters({ set: codes.join(",") })
    say(text("Đã mở bộ phù hiệu vừa dán.", "The pasted set is open."))
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
    <div className="wiki-enchantment-set-tools">
      {notice && (
        <span className="wiki-enchantment-set-notice" role="status">
          {notice}
        </span>
      )}
      {pasting && (
        <form
          className="wiki-enchantment-set-paste"
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
            placeholder={text("Dán liên kết hoặc 5 mã phù hiệu", "Paste a link or 5 enchantment codes")}
            aria-label={text("Liên kết hoặc mã bộ phù hiệu", "Set link or codes")}
          />
          <button type="submit">{text("Mở", "Open")}</button>
        </form>
      )}
      <button
        type="button"
        onClick={() => void copy()}
        title={text("Sao chép bộ", "Copy set")}
        aria-label={text("Sao chép bộ", "Copy set")}
      >
        <WikiIcon name="copy" size={16} />
        <span>{text("Sao chép bộ", "Copy set")}</span>
      </button>
      <button
        type="button"
        onClick={() => void paste()}
        title={text("Dán bộ", "Paste set")}
        aria-label={text("Dán bộ", "Paste set")}
      >
        <WikiIcon name="paste" size={16} />
        <span>{text("Dán bộ", "Paste set")}</span>
      </button>
    </div>
  )
}
