import type { DocumentView, GameContent } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { RelativeDate } from "../../components/relative-date"
import "./game-tool.css"

/** Whether readers see the game, and the way to take it down or to the panel that publishes it. */
export function PublicCopy({
  entry,
  canPublish,
  onWithdraw,
  onPublish,
}: {
  entry: DocumentView<GameContent>
  canPublish: boolean
  /** Absent while viewing. */
  onWithdraw?: () => void
  onPublish?: () => void
}) {
  const withdraw = async () => {
    const confirmed = await confirmAction({
      title: `Ngừng xuất bản ván ${entry.content.number}?`,
      description:
        "Bản nháp và lịch sử xuất bản vẫn được giữ để sửa rồi xuất bản lại. Người xem không thấy ván này cho tới lần xuất bản tiếp theo.",
      confirmLabel: "Ngừng xuất bản",
    })
    if (confirmed) onWithdraw?.()
  }
  return (
    <div className="esp-gt-row" data-long={!!entry.publishedAt || undefined} role="group" aria-label="Bản công khai">
      <span>Bản công khai</span>
      <span className="esp-gt-value">
        {entry.publishedAt ? (
          <span>
            Đã xuất bản <RelativeDate value={entry.publishedAt} withTime inSentence />.
            {onWithdraw && " Sửa ở đây vào bản nháp."}
          </span>
        ) : (
          <span className="esp-gt-none">Chưa xuất bản.</span>
        )}
      </span>
      <span className="esp-gt-acts">
        {entry.publishedAt
          ? canPublish &&
            onWithdraw && (
              <Button size="xs" variant="secondary" type="button" onClick={() => void withdraw()}>
                Ngừng xuất bản
              </Button>
            )
          : onPublish && (
              <Button size="xs" variant="secondary" type="button" onClick={onPublish}>
                Xuất bản…
              </Button>
            )}
      </span>
    </div>
  )
}
