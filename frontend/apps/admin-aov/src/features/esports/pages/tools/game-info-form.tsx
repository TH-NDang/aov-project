import { useEffect, useState } from "react"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { GameScope } from "@/features/tournaments/components/game-scope"
import { useGamePatches } from "../../data/use-esports-data"
import { changedGameInfo, gameInfoOf, type GameInfo } from "./game-info"
import "./game-tool.css"

/** The market, season and patch the heroes and items of a game are read in, its number in the match and a note. */
export function GameInfoForm({
  entry,
  tournamentId,
  tournamentRegion,
  onDirty,
  onSave,
}: {
  entry: DocumentView<GameContent>
  tournamentId?: string
  tournamentRegion?: string
  /** Tells whether something typed is not saved yet. */
  onDirty?: (dirty: boolean) => void
  onSave: (change: Partial<GameInfo>) => void
}) {
  const stored = gameInfoOf(entry.content)
  const patches = useGamePatches(tournamentId)
  const [draft, setDraft] = useState(stored)
  const change = changedGameInfo(stored, draft)
  const dirty = Object.keys(change).length > 0
  const numberValid = Number.isInteger(draft.number) && draft.number >= 1 && draft.number <= 99
  useEffect(() => {
    onDirty?.(dirty)
    return () => onDirty?.(false)
  }, [dirty, onDirty])

  return (
    <form
      className="esp-gt-form"
      aria-label="Thông tin ván"
      onSubmit={(event) => {
        event.preventDefault()
        if (dirty && numberValid) onSave(change)
      }}
    >
      {/* Its three lists share one line by the width of the window, which says nothing about this column. */}
      <div className="@max-lg:[&_label]:basis-full!">
        <GameScope
          content={{ ...entry.content, ...draft }}
          scope={patches.data?.get(entry.id)}
          disabled={false}
          tournamentRegion={tournamentRegion}
          onChange={(next) => setDraft(gameInfoOf(next))}
        />
      </div>
      <label className="esp-gt-field">
        Số ván
        <Input
          type="number"
          min={1}
          max={99}
          value={Number.isFinite(draft.number) ? draft.number : ""}
          onChange={(event) => setDraft({ ...draft, number: Number(event.target.value) })}
          className="esp-num h-8 w-20 text-foreground"
          aria-invalid={!numberValid}
        />
      </label>
      <label className="esp-gt-field">
        Ghi chú của ván
        <Textarea
          value={draft.note ?? ""}
          maxLength={4000}
          rows={3}
          className="text-foreground"
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </label>
      <div className="flex justify-end gap-2">
        {dirty && (
          <Button size="sm" variant="ghost" type="button" onClick={() => setDraft(stored)}>
            Hủy
          </Button>
        )}
        <Button size="sm" variant="outline" type="submit" disabled={!dirty || !numberValid}>
          Lưu thông tin ván
        </Button>
      </div>
    </form>
  )
}
