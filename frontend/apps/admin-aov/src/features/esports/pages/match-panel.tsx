import { useState } from "react"
import { Check, ExternalLink, Link2, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Kbd, KbdGroup } from "@aov/ui/components/kbd"
import { isWebLink } from "@/features/competition/workspace/model"
import { usePlayheadValue } from "../components/game/use-playhead"
import { MatchSwitcher } from "../components/series/match-switcher"
import { MatchTime, roundName } from "../components/series/studio-head"
import type { DeskPanel } from "../model/desk"
import { atVideo } from "../model/game-times"
import type { Playhead } from "../model/playhead"
import { EditMatchButton } from "./edit-match-button"
import type { GameDesk } from "./game-desk"
import type { Studio } from "./match-studio"
import { QuickGamesPanel } from "./quick-games-panel"
import { PublishTool } from "./tools/publish-tool"

type Shortcut = { keys: string[]; text: string; recording?: boolean }

const SHORTCUTS: Shortcut[] = [
  { keys: ["Space"], text: "Phát, tạm dừng" },
  { keys: ["←", "→"], text: "Lùi, tới 5 giây (giữ Shift: 1 giây)" },
  { keys: [",", "."], text: "Lùi, tới 1 giây" },
  { keys: ["J", "L"], text: "Lùi, tới 10 giây (giữ Shift: 30 giây)" },
  { keys: ["Home", "End"], text: "Đầu ván, cuối ván đang xem" },
  { keys: ["[", "]"], text: "Mốc trước, mốc sau" },
  { keys: ["PageUp", "PageDown"], text: "Ván trước, ván sau" },
  { keys: ["Shift", "P"], text: "Trận trước của giải" },
  { keys: ["Shift", "N"], text: "Trận sau của giải" },
  { keys: ["G"], text: "Bước tiếp theo ở chân khung", recording: true },
  { keys: ["1", "2", "3"], text: "Trụ, Rồng, Tà thần của bên xanh", recording: true },
  { keys: ["7", "8", "9"], text: "Trụ, Rồng, Tà thần của bên đỏ", recording: true },
  { keys: ["E"], text: "Diễn biến khác", recording: true },
  { keys: ["K", "O", "I", "N"], text: "Ghi hạ gục, mục tiêu, trang bị, khoảnh khắc", recording: true },
  { keys: ["Alt", "←", "→"], text: "Dời mốc đang chọn 1 giây (giữ Shift: 5 giây)", recording: true },
  { keys: ["Delete"], text: "Xóa diễn biến đang chọn", recording: true },
  { keys: ["Ctrl", "Z"], text: "Hoàn tác thay đổi gần nhất của ván", recording: true },
  { keys: ["M"], text: "Tắt, bật tiếng" },
  { keys: ["F"], text: "Toàn màn hình" },
  { keys: ["Esc"], text: "Đóng biểu mẫu, rồi bảng, rồi bỏ chọn" },
  { keys: ["?"], text: "Mở, đóng danh sách này" },
]

function ShortcutList({ recording }: { recording: boolean }) {
  return (
    <section className="space-y-2" aria-labelledby="esp-shortcuts">
      <h3 id="esp-shortcuts" className="type-label text-muted-foreground">
        Phím tắt
      </h3>
      <dl className="space-y-1.5">
        {SHORTCUTS.filter((entry) => recording || !entry.recording).map((entry) => (
          <div key={entry.text} className="flex items-start justify-between gap-3">
            <dt className="type-body min-w-0">{entry.text}</dt>
            <dd className="flex h-5 shrink-0 items-center">
              <KbdGroup>
                {entry.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Copies the address of the match at the second the video is at. */
function CopyMoment({ playhead, shareLink }: { playhead: Playhead; shareLink: (second: number) => string }) {
  const second = usePlayheadValue(playhead, Math.floor)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink(second))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard can be blocked outside secure contexts; nothing else to do.
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={() => void copy()}>
      {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
      {copied ? "Đã chép liên kết" : "Chép liên kết"} <span className="esp-num">{atVideo(second)}</span>
    </Button>
  )
}

/** What belongs to the whole match: its round, time and source, its note, where it is edited, and the keys. */
function MatchPanel({ studio }: { studio: Studio }) {
  const { series, recording, editable, waiting } = studio
  const { content } = series
  const source = content.sourceUrl && isWebLink(content.sourceUrl) ? content.sourceUrl : null
  // A phone has no keyboard to use the keys with.
  const keyboard = !studio.compact && !window.matchMedia?.("(pointer: coarse)").matches
  return (
    <div className="esp-match">
      {/* What a narrow head has no room for. */}
      <div className="esp-match-narrow">
        {studio.publishing && (
          <Button size="sm" variant="outline" onClick={() => studio.openPanel("publish")}>
            Xuất bản {waiting > 0 && <span className="esp-num">{waiting}</span>}
          </Button>
        )}
        <MatchSwitcher
          records={studio.records}
          seriesId={series.id}
          team={studio.team}
          editing={editable}
          keysEnabled={false}
        />
      </div>
      <div className="space-y-1">
        <p className="type-body">
          {roundName(content)}, BO{content.bestOf}, <MatchTime value={content.scheduledAt} />
        </p>
        {source && (
          <a
            href={source}
            target="_blank"
            rel="noreferrer"
            title={source}
            className="type-meta inline-flex items-center gap-1 hover:text-foreground"
          >
            Nguồn <ExternalLink size={12} aria-hidden />
          </a>
        )}
      </div>
      {content.note && <p className="type-body whitespace-pre-line text-muted-foreground">{content.note}</p>}
      <div className="flex flex-wrap gap-2">
        {studio.access.canWrite && <EditMatchButton record={series} actorKey={studio.access.actorKey} />}
        {recording.videoId && <CopyMoment playhead={recording.playhead} shareLink={studio.shareLink} />}
      </div>
      {keyboard && <ShortcutList recording={editable} />}
    </div>
  )
}

const PANEL_NAMES: Record<DeskPanel, string> = { publish: "Xuất bản", quick: "Ghi nhanh", match: "Trận này" }

/** A panel of the match in the place of the tool, under a head that closes it. */
export function PanelBody({ studio, panel, desk }: { studio: Studio; panel: DeskPanel; desk: GameDesk | null }) {
  const close = () => studio.openPanel(null)
  return (
    <section aria-label={PANEL_NAMES[panel]}>
      <header className="esp-panel-head">
        <h2 className="type-section-title min-w-0 flex-1 truncate">{PANEL_NAMES[panel]}</h2>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Đóng" title="Đóng (Esc)" onClick={close}>
          <X aria-hidden />
        </Button>
      </header>
      {panel === "publish" && (
        <PublishTool
          games={studio.games}
          team={studio.team}
          canPublish={studio.access.canPublish}
          beforePublish={async () => studio.actions.current?.settled()}
          desk={desk}
          onOpenStep={studio.openStep}
        />
      )}
      {panel === "quick" && (
        <QuickGamesPanel
          series={studio.series}
          games={studio.games}
          team={studio.team}
          region={studio.tournament.content.region}
          onDone={close}
        />
      )}
      {panel === "match" && <MatchPanel studio={studio} />}
    </section>
  )
}
