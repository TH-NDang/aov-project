import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { PlayerPhoto } from "@/features/esports/components/primitives"
import { tournamentApi, tournamentKeys, type PickerContext } from "../api/tournament-api"
import type { MvpGroup } from "../model/mvp-model"
import { RecordPicker } from "./record-picker"

type KnownPlayer = { nickname: string; photoUrl?: string | null }

/** A player's record, unless the screen already knows them; the picker reads it under the same key. */
function useRecordedPlayer(id: string | null | undefined, known?: KnownPlayer) {
  const player = useQuery({
    queryKey: tournamentKeys.pickerSelected("players", id),
    queryFn: ({ signal }) => tournamentApi.read("players", id!, signal),
    enabled: !!id && !known,
    staleTime: 60_000,
  })
  return {
    name: known?.nickname ?? player.data?.content.nickname,
    photoUrl: (known?.photoUrl ?? player.data?.content.photoUrl) || undefined,
    missing: player.isError,
  }
}

/** The name of a recorded MVP, for the question asked before it is replaced. */
export function usePlayerName(id: string | null | undefined, known?: string) {
  return useRecordedPlayer(id, known ? { nickname: known } : undefined).name ?? known ?? "MVP đã ghi"
}

/** A linked player shown read-only: from what the screen already has, else from their record. */
export function LinkedPlayer({
  id,
  known,
  renderName,
}: {
  id: string
  known?: KnownPlayer
  /** Wraps the loaded name, for a screen where the name opens more about the player. */
  renderName?: (name: string) => ReactNode
}) {
  const player = useRecordedPlayer(id, known)
  const name = player.name ?? (player.missing ? "Hồ sơ không còn khả dụng" : "Đang tải…")
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PlayerPhoto name={name} url={player.photoUrl} size={28} />
      <span className="type-body truncate">{player.name && renderName ? renderName(player.name) : name}</span>
    </span>
  )
}

/**
 * Picks an MVP: first from the players the screen lists (who played, then the two rosters), then anyone through the
 * search. Choosing does not save; the caller saves, and asks first when it replaces an MVP already recorded.
 */
export function MvpChooser({
  value,
  groups,
  context,
  disabled,
  onChange,
}: {
  value: string | null
  groups: MvpGroup[]
  context: PickerContext
  disabled?: boolean
  onChange: (id: string | null, name: string) => void
}) {
  const listed = groups.some((group) => group.players.some((player) => player.id === value))
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.key} className="space-y-1.5">
          <p className="type-label text-muted-foreground">{group.title}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={group.title}>
            {group.players.map((player) => {
              const chosen = player.id === value
              return (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={chosen}
                  disabled={disabled}
                  onClick={() => onChange(player.id, player.name)}
                  className={cn(
                    "type-body inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 hover:bg-muted disabled:opacity-50",
                    chosen && "border-primary bg-[var(--aov-accent-soft)]",
                  )}
                >
                  <PlayerPhoto name={player.name} url={player.photoUrl ?? undefined} size={24} />
                  {player.name}
                  {chosen && <Check className="size-3.5 text-primary" aria-hidden />}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-56 flex-1 gap-1.5">
          <span className="type-label text-muted-foreground">Tuyển thủ khác</span>
          <RecordPicker
            kind="players"
            label="Tuyển thủ"
            placeholder="Tìm tuyển thủ"
            value={listed ? "" : value}
            context={context}
            disabled={disabled}
            onChange={(id, name) => onChange(id || null, name)}
          />
        </label>
        {value && (
          <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange(null, "")}>
            <X aria-hidden /> Bỏ MVP
          </Button>
        )}
      </div>
    </div>
  )
}
