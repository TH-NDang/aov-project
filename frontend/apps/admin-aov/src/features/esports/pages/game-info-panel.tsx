import { useState } from "react"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { EyeOff, ListChecks, Save } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { confirmAction } from "@/components/confirm-dialog"
import { GameScope } from "@/features/tournaments/components/game-scope"
import { MvpChooser, usePlayerName } from "@/features/tournaments/components/mvp-chooser"
import { RecordLifecycleActions } from "@/features/tournaments/components/record-lifecycle-actions"
import { candidateName, mvpGroups, type MvpGroup } from "@/features/tournaments/model/mvp-model"
import type { RosterOption } from "../components/game/draft-editor"
import { RelativeDate } from "../components/relative-date"
import type { GameView } from "../model/game-view"

/** What this panel edits: how the game's catalog is read, where it sits in the match, its MVP and a note. */
export type GameInfo = Pick<
  GameContent,
  "region" | "seasonId" | "patchVariantId" | "includeUnscoped" | "number" | "note" | "mvpPlayerId"
>

export const gameInfoOf = (content: GameContent): GameInfo => ({
  region: content.region,
  seasonId: content.seasonId ?? null,
  patchVariantId: content.patchVariantId ?? null,
  includeUnscoped: content.includeUnscoped ?? false,
  number: content.number,
  note: content.note ?? "",
  mvpPlayerId: content.mvpPlayerId ?? null,
})

/** Who the MVP list offers first: the players seated in the game, then the rest of both rosters. */
export function gameMvpGroups(view: GameView | undefined, roster?: (teamId: string) => RosterOption[]): MvpGroup[] {
  if (!view) return []
  const sides = [view.sides.BLUE, view.sides.RED]
  return mvpGroups([
    {
      key: "seated",
      title: "Ra sân ván này",
      players: sides.flatMap((side) =>
        side.seats.flatMap((seat) =>
          seat.playerId ? [{ id: seat.playerId, name: seat.playerName, photoUrl: seat.photoUrl }] : [],
        ),
      ),
    },
    ...sides.map((side) => ({ key: side.team.id, title: side.team.name, players: roster?.(side.team.id) ?? [] })),
  ])
}

/** Only the fields that differ, so a save never writes back a value somebody else changed meanwhile. */
export function changedGameInfo(before: GameInfo, after: GameInfo): Partial<GameInfo> {
  const keys = Object.keys(after) as (keyof GameInfo)[]
  return Object.fromEntries(keys.filter((key) => after[key] !== before[key]).map((key) => [key, after[key]]))
}

/**
 * What a game is, apart from what happened in it: the market, season and patch its heroes and items are read in, its
 * number in the match, its MVP and a note. Bans, picks, players, loadouts, the video and the result are recorded in
 * their own panels, so nothing here repeats them. Publishing is confirmed in the progress panel; taking the public
 * copy down and deleting the game live here because both remove the game from readers.
 */
export function GameInfoPanel({
  entry,
  view,
  roster,
  tournamentId,
  tournamentRegion,
  canPublish,
  onSave,
  onWithdraw,
  onDeleted,
  onOpenProgress,
}: {
  entry: DocumentView<GameContent>
  /** The game as drawn, whose seated players the MVP list offers first. */
  view?: GameView
  roster?: (teamId: string) => RosterOption[]
  tournamentId?: string
  tournamentRegion?: string
  canPublish: boolean
  onSave: (change: Partial<GameInfo>) => void
  onWithdraw: () => void
  onDeleted: () => void
  onOpenProgress: () => void
}) {
  const stored = gameInfoOf(entry.content)
  const [draft, setDraft] = useState(stored)
  const change = changedGameInfo(stored, draft)
  const dirty = Object.keys(change).length > 0
  const numberValid = Number.isInteger(draft.number) && draft.number >= 1 && draft.number <= 99
  const groups = gameMvpGroups(view, roster)
  const storedMvp = usePlayerName(stored.mvpPlayerId, candidateName(groups, stored.mvpPlayerId))
  const [mvpName, setMvpName] = useState("")
  const save = async () => {
    // A recorded MVP is replaced or taken off only after a question naming both.
    if (change.mvpPlayerId !== undefined && stored.mvpPlayerId) {
      const confirmed = await confirmAction({
        title: draft.mvpPlayerId ? "Đổi MVP của ván?" : "Bỏ MVP của ván?",
        description: `${storedMvp} → ${draft.mvpPlayerId ? mvpName || "tuyển thủ đã chọn" : "không có MVP"}.`,
        confirmLabel: draft.mvpPlayerId ? "Đổi MVP" : "Bỏ MVP",
      })
      if (!confirmed) return
    }
    onSave(change)
  }
  const withdraw = async () => {
    const confirmed = await confirmAction({
      title: `Gỡ ván ${entry.content.number} khỏi trang công khai?`,
      description:
        "Bản nháp và lịch sử xuất bản vẫn được giữ để sửa rồi xuất bản lại. Người xem sẽ không thấy ván này cho tới lần xuất bản tiếp theo.",
      confirmLabel: "Gỡ công khai",
    })
    if (confirmed) onWithdraw()
  }

  return (
    <div className="space-y-4 p-4 text-sm">
      <GameScope
        content={{ ...entry.content, ...draft }}
        disabled={false}
        tournamentRegion={tournamentRegion}
        onChange={(next) => setDraft(gameInfoOf(next))}
      />
      <div className="grid gap-3 @2xl:grid-cols-[96px_1fr]">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Số ván</span>
          <Input
            type="number"
            min={1}
            max={99}
            value={Number.isFinite(draft.number) ? draft.number : ""}
            onChange={(event) => setDraft({ ...draft, number: Number(event.target.value) })}
            className="esp-num h-8"
            aria-invalid={!numberValid}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Ghi chú của ván</span>
          <Textarea
            value={draft.note ?? ""}
            maxLength={4000}
            rows={3}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
        </label>
      </div>
      <section className="space-y-2" aria-label="MVP của ván">
        <span className="text-xs font-medium text-muted-foreground">MVP</span>
        <MvpChooser
          value={draft.mvpPlayerId ?? null}
          groups={groups}
          context={{ tournamentId, teamId: view?.sides.BLUE.team.id || undefined }}
          onChange={(id, name) => {
            setDraft({ ...draft, mvpPlayerId: id })
            setMvpName(name)
          }}
        />
      </section>
      <div className="flex items-center justify-end gap-2">
        {dirty && (
          <Button size="sm" variant="ghost" type="button" onClick={() => setDraft(stored)}>
            Hủy
          </Button>
        )}
        <Button size="sm" type="button" disabled={!dirty || !numberValid} onClick={() => void save()}>
          <Save size={14} /> Lưu thông tin ván
        </Button>
      </div>

      <section className="space-y-2 border-t pt-3" aria-label="Bản công khai">
        <p className="text-xs font-semibold">Bản công khai</p>
        {entry.publishedAt ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Đã xuất bản <RelativeDate value={entry.publishedAt} withTime />. Sửa ở đây chỉ vào bản nháp.
            </span>
            {canPublish && (
              <Button size="sm" variant="outline" type="button" className="ml-auto" onClick={() => void withdraw()}>
                <EyeOff size={14} /> Gỡ công khai
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Chưa xuất bản. Ván lên trang công khai khi được xác nhận trong bảng Tiến độ.
            </span>
            <Button size="sm" variant="ghost" type="button" className="ml-auto" onClick={onOpenProgress}>
              <ListChecks size={14} /> Mở Tiến độ
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-2 border-t pt-3" aria-label="Xóa ván">
        <span className="text-xs text-muted-foreground">
          Xóa đưa ván vào thùng rác; có thể khôi phục. {dirty && "Lưu hoặc hủy thay đổi trước khi xóa."}
        </span>
        <span className="ml-auto">
          <RecordLifecycleActions
            kind="games"
            entry={entry}
            name={`ván ${entry.content.number}`}
            disabled={dirty}
            onChanged={onDeleted}
          />
        </span>
      </section>
    </div>
  )
}
