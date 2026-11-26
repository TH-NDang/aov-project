import { ExternalLink } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { formatClock } from "@/lib/clock"
import { youtubeLinkTime } from "../../model/vod"
import type { VideoProblem } from "./match-video"

const WHY: Record<VideoProblem, string> = {
  forbidden: "Kênh không cho phát video này ở trang khác.",
  gone: "Video không còn trên YouTube hoặc để riêng tư.",
  blocked: "Không tải được trình phát YouTube.",
}

/** Stands in the place of the picture, which is dark in both themes, when the video cannot be shown there. */
export function VideoProblemNote({
  problem,
  youtubeUrl,
  editable,
}: {
  problem: VideoProblem
  youtubeUrl: string
  editable: boolean
}) {
  const second = youtubeLinkTime(youtubeUrl)
  return (
    <div
      className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/80"
      role="status"
    >
      <p>
        <span className="font-medium text-white">{WHY[problem]}</span>
        {editable && <span className="block">Vẫn ghi được: mốc lấy theo vị trí ở thanh dưới.</span>}
      </p>
      <Button asChild size="sm" variant="secondary">
        <a href={youtubeUrl} target="_blank" rel="noreferrer">
          Mở trên YouTube{second !== null && ` lúc ${formatClock(second)}`}
          <ExternalLink aria-hidden />
        </a>
      </Button>
    </div>
  )
}
