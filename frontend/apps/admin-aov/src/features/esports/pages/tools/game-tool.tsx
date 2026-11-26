import { useEffect, useMemo, useRef, useState } from "react"
import type { Side } from "@aov/community-contracts"
import { ChevronDown } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { MvpChooser, usePlayerName } from "@/features/tournaments/components/mvp-chooser"
import { RecordLifecycleActions } from "@/features/tournaments/components/record-lifecycle-actions"
import { candidateName } from "@/features/tournaments/model/mvp-model"
import { gameFieldWords } from "@/features/tournaments/model/game-field-words"
import { HeroIcon, TeamLogo } from "../../components/primitives"
import { useGamePatches, useGames } from "../../data/use-esports-data"
import type { GameRow, ToolTarget } from "../../model/desk"
import { winnerChange } from "../../model/game-times"
import { publishRows } from "../../model/match-publishing"
import { layoutChapters } from "../../model/series-vod"
import type { TimingIssue } from "../../model/timing-issues"
import { youtubeVideoId } from "../../model/vod"
import type { GameDesk } from "../game-desk"
import { gameInfoOf, gameInfoSummary, gameMvpGroups } from "./game-info"
import { GameInfoForm } from "./game-info-form"
import { GameTimesRows } from "./game-times-rows"
import { GameVideoRow, type VideoScope } from "./game-video-row"
import { PublicCopy } from "./public-copy"
import "./game-tool.css"

/** Everything about a game that is no draft, no line-up and no moment, one row for each thing. */
export function GameTool({
  desk,
  target,
  issues,
  onVideo,
}: {
  desk: GameDesk
  target: ToolTarget | null
  issues: TimingIssue[]
  onVideo: (url: string, scope: VideoScope) => void
}) {
  const { entry, view, editable, videoId } = desk
  const root = useRef<HTMLDivElement>(null)
  const others = useGames(entry.content.seriesId)
  // The games around this one are read where a second is checked: the next game depends on that second.
  const chapters = useMemo(() => (others.data ? layoutChapters(others.data, videoId) : null), [others.data, videoId])
  const [opened, setOpened] = useState<"mvp" | "video" | "scope" | null>(() =>
    target?.row === "scope" || target?.row === "video" ? target.row : null,
  )
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    if (target?.row === "scope" || target?.row === "video") setOpened(target.row)
    if (target?.row) root.current?.querySelector(`[data-part="${target.row}"]`)?.scrollIntoView?.({ block: "nearest" })
  }, [target])
  const toggle = (part: "mvp" | "video" | "scope") => (open: boolean) => setOpened(open ? part : null)

  const url = entry.content.sourceUrl ?? ""
  const id = youtubeVideoId(url)
  const shared = others.data
    ? others.data.length > 1 && others.data.every((game) => youtubeVideoId(game.content.sourceUrl) === id)
    : null
  const part = (row: GameRow) => ({ "data-part": row })
  return (
    <div ref={root} className="esp-two">
      <div>
        {editable && <Review desk={desk} issues={issues} />}
        <div {...part("result")}>
          <WinnerRow desk={desk} />
          <MvpRow desk={desk} open={opened === "mvp"} onOpen={toggle("mvp")} />
        </div>
        <div {...part("times")}>
          <GameTimesRows desk={desk} chapters={chapters} />
        </div>
      </div>
      <div className="esp-gt-right">
        {editable && (
          <div {...part("video")}>
            <GameVideoRow
              url={url}
              shared={shared}
              open={opened === "video"}
              onOpen={toggle("video")}
              onVideo={onVideo}
            />
          </div>
        )}
        <div {...part("scope")}>
          <ScopeRow desk={desk} open={opened === "scope"} onOpen={toggle("scope")} onDirty={setTyping} />
        </div>
        <div {...part("public")}>
          <PublicCopy
            entry={entry}
            canPublish={desk.canPublish}
            onWithdraw={editable ? () => void desk.withdraw() : undefined}
            onPublish={editable ? () => desk.openPanel("publish") : undefined}
          />
        </div>
        {editable && (
          <div className="esp-gt-row" data-long role="group" aria-label="Xóa ván">
            <span>Xóa ván</span>
            <span className="esp-gt-value esp-gt-none">
              {typing ? "Lưu hoặc hủy thông tin ván trước khi xóa." : "Vào thùng rác, khôi phục được."}
            </span>
            <span className="esp-gt-acts">
              <RecordLifecycleActions
                kind="games"
                entry={entry}
                name={`ván ${view.number}`}
                disabled={typing}
                onChanged={desk.onDeleted}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** What is wrong with the game as recorded; what it still lacks is told where it is recorded. */
function Review({ desk, issues }: { desk: GameDesk; issues: TimingIssue[] }) {
  const { entry, progress } = desk
  const service = progress.state === "confirmed" ? [] : publishRows([entry]).flatMap((row) => row.issues)
  const words = [
    ...issues.filter((issue) => issue.gameId === entry.id).map((issue) => issue.text),
    ...service.map((field) => `${gameFieldWords(field, entry.content)}.`),
  ]
  if (!words.length) return null
  return (
    <div className="esp-gt-row" role="group" aria-label="Cần xem lại">
      <span>Cần xem lại</span>
      <ul className="esp-gt-review">
        {words.map((text, index) => (
          <li key={`${text}-${index}`}>{text}</li>
        ))}
      </ul>
    </div>
  )
}

const SIDES: readonly Side[] = ["BLUE", "RED"]

function WinnerRow({ desk }: { desk: GameDesk }) {
  const { view, editable, entry } = desk
  const name = (side: Side) => view.sides[side].team.shortName
  const choose = async (side: Side) => {
    const removed = view.winner === side
    if (view.winner) {
      const confirmed = await confirmAction({
        title: removed ? `Bỏ đội thắng ván ${view.number}?` : `Đổi đội thắng ván ${view.number}?`,
        description: removed ? `${name(side)} đang được ghi là đội thắng.` : `${name(view.winner)} → ${name(side)}.`,
        confirmLabel: removed ? "Bỏ đội thắng" : "Đổi đội thắng",
      })
      if (!confirmed) return
    }
    void desk.record(winnerChange(entry.content, removed ? null : side, name))
  }
  return (
    <div className="esp-gt-row" role="group" aria-label={`Đội thắng ván ${view.number}`}>
      <span>Đội thắng</span>
      <span className="esp-gt-value">
        {editable ? (
          SIDES.map((side) => (
            <button
              key={side}
              type="button"
              className="esp-gt-team"
              data-side={side}
              aria-pressed={view.winner === side}
              onClick={() => void choose(side)}
            >
              <TeamLogo team={view.sides[side].team} size={20} /> {name(side)}
            </button>
          ))
        ) : view.winner ? (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <TeamLogo team={view.sides[view.winner].team} size={20} /> {name(view.winner)}
          </span>
        ) : (
          <span className="esp-gt-none">Chưa ghi</span>
        )}
      </span>
    </div>
  )
}

function MvpRow({ desk, open, onOpen }: { desk: GameDesk; open: boolean; onOpen: (open: boolean) => void }) {
  const { view, editable, entry, roster } = desk
  const id = entry.content.mvpPlayerId ?? null
  const groups = useMemo(() => gameMvpGroups(view, roster), [view, roster])
  const name = usePlayerName(id, candidateName(groups, id))
  const seat = [...view.sides.BLUE.seats, ...view.sides.RED.seats].find((value) => id && value.playerId === id)
  const choose = async (playerId: string | null, chosen: string) => {
    if (playerId === id) return onOpen(false)
    if (id) {
      const confirmed = await confirmAction({
        title: playerId ? "Đổi MVP của ván?" : "Bỏ MVP của ván?",
        description: `${name} → ${playerId ? chosen || "tuyển thủ đã chọn" : "không có MVP"}.`,
        confirmLabel: playerId ? "Đổi MVP" : "Bỏ MVP",
      })
      if (!confirmed) return
    }
    onOpen(false)
    void desk.record({
      text: playerId ? `MVP ván ${view.number}: ${chosen}` : `Đã bỏ MVP ván ${view.number}`,
      apply: (content) => ({ ...content, mvpPlayerId: playerId }),
      revert: (content) => ({ ...content, mvpPlayerId: id }),
    })
  }
  return (
    <div className="esp-gt-row" role="group" aria-label="MVP">
      <span>MVP</span>
      <span className="esp-gt-value">
        {id ? (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            {seat?.hero && <HeroIcon hero={seat.hero} size={22} className="rounded-md" />} {name}
          </span>
        ) : (
          <span className="esp-gt-none">Chưa có</span>
        )}
      </span>
      <span className="esp-gt-acts">
        {editable && (
          <Button type="button" size="xs" variant="secondary" aria-expanded={open} onClick={() => onOpen(!open)}>
            {open ? "Đóng" : id ? "Đổi" : "Chọn"}
          </Button>
        )}
      </span>
      {open && editable && (
        <div className="esp-gt-under">
          <MvpChooser
            value={id}
            groups={groups}
            context={{ tournamentId: desk.tournamentId, teamId: view.sides.BLUE.team.id || undefined }}
            onChange={(playerId, chosen) => void choose(playerId, chosen)}
          />
        </div>
      )}
    </div>
  )
}

/** Version, number and note in one line; while recording it opens the form that edits them. */
function ScopeRow({
  desk,
  open,
  onOpen,
  onDirty,
}: {
  desk: GameDesk
  open: boolean
  onOpen: (open: boolean) => void
  onDirty: (dirty: boolean) => void
}) {
  const { entry, editable } = desk
  const { content } = entry
  const patches = useGamePatches(desk.tournamentId)
  const summary = gameInfoSummary(content, patches.data?.get(entry.id), desk.catalog)
  return (
    <>
      <div className="esp-gt-row" role="group" aria-label="Phiên bản game, số ván, ghi chú">
        <span>Phiên bản game</span>
        <span className="esp-gt-value">
          {summary}
          {content.note && (
            <span className={cn("esp-gt-none w-full", editable && "line-clamp-2")} title={content.note}>
              {content.note}
            </span>
          )}
        </span>
        <span className="esp-gt-acts">
          {editable && (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              aria-label="Sửa phiên bản game, số ván, ghi chú"
              aria-expanded={open}
              onClick={() => onOpen(!open)}
            >
              Sửa <ChevronDown className={open ? "rotate-180" : undefined} aria-hidden />
            </Button>
          )}
        </span>
      </div>
      {open && editable && (
        <GameInfoForm
          // Another save of the game leaves what is typed here alone, unless it changed the same things.
          key={JSON.stringify(gameInfoOf(content))}
          entry={entry}
          tournamentId={desk.tournamentId}
          tournamentRegion={desk.tournamentRegion}
          onDirty={onDirty}
          onSave={(change) => void desk.save((current) => ({ ...current, ...change }))}
        />
      )}
    </>
  )
}
