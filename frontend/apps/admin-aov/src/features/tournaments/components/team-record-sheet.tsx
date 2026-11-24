import { useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import type { DocumentView, PlayerContent } from "@aov/community-contracts"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { confirmDiscard } from "@/components/confirm-dialog"
import { LaneIcon } from "@/features/esports/components/primitives"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import { RegistryLogo } from "./registry-logo"
import { TeamRecordForm } from "./team-record-form"
import { TeamRegionBadge, teamRegionName } from "./team-region"
import { LANE_LABELS } from "@/lib/lanes"

type Editing = { kind: "teams" | "players"; id: string } | null

/**
 * A team's record and the records of its players in one tournament, opened from the team's row of the workspace.
 * Everything reads as it is until its pencil opens a form; leaving a form with unsaved changes asks first.
 */
export function TeamRecordSheet({
  teamId,
  playerIds,
  actorKey,
  canWrite,
  onClose,
}: {
  teamId: string
  /** The players of the team's roster in this tournament, in the order the sheet lists them. */
  playerIds: string[]
  actorKey: string
  canWrite: boolean
  onClose: () => void
}) {
  const [editing, setEditing] = useState<Editing>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const team = useQuery({
    queryKey: tournamentKeys.one("teams", actorKey, teamId),
    queryFn: ({ signal }) => tournamentApi.read("teams", teamId, signal),
  })
  const players = useQueries({
    queries: playerIds.map((id) => ({
      queryKey: tournamentKeys.one("players", actorKey, id),
      queryFn: ({ signal }: { signal: AbortSignal }) => tournamentApi.read("players", id, signal),
    })),
  })

  /** Moves to another form or closes, asking first when the open form holds changes. */
  async function leave(next: () => void) {
    if (busy) return
    if (dirty) {
      const discard = await confirmDiscard({
        title: "Hồ sơ còn thay đổi chưa lưu",
        description: "Lưu để giữ thay đổi trên máy chủ.",
      })
      if (!discard) return
    }
    setDirty(false)
    next()
  }
  const open = (next: Editing) => void leave(() => setEditing(next))
  const saved = () => {
    setDirty(false)
    setEditing(null)
    toast.success("Đã lưu hồ sơ.")
  }
  const name = team.data?.content.shortName || team.data?.content.name || "Đội tuyển"

  return (
    <Sheet open onOpenChange={(value) => !value && void leave(onClose)}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-xl"
        showCloseButton={!busy}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
      >
        <SheetHeader>
          <div className="flex items-center gap-3">
            <RegistryLogo
              url={team.data?.content.logoUrl}
              darkUrl={team.data?.content.logoDarkUrl}
              name={team.data?.content.name ?? name}
            />
            <div className="min-w-0">
              <SheetTitle className="truncate">{name}</SheetTitle>
              {team.data && <TeamRegionBadge code={team.data.content.country} />}
            </div>
          </div>
          <SheetDescription>Hồ sơ đội và tuyển thủ dùng chung cho mọi giải, trận và ván.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <section aria-labelledby="team-record" className="space-y-3">
            <h3 id="team-record" className="type-section-title">
              Hồ sơ đội
            </h3>
            {team.isPending && <p className="type-meta">Đang tải hồ sơ đội…</p>}
            {team.isError && (
              <p className="type-body text-destructive" role="alert">
                {tournamentError(team.error)}
              </p>
            )}
            {team.data &&
              (editing?.kind === "teams" ? (
                <TeamRecordForm
                  key={`${team.data.id}-${team.data.version}`}
                  kind="teams"
                  entry={team.data}
                  onSaved={saved}
                  onCancel={() => open(null)}
                  onDirtyChange={setDirty}
                  onBusyChange={setBusy}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="type-body break-words">{team.data.content.name}</p>
                    <p className="type-meta break-words">
                      {[
                        team.data.content.shortName,
                        teamRegionName(team.data.content.country),
                        ...(team.data.content.aliases ?? []),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {canWrite && (
                    <EditButton
                      label={`Sửa hồ sơ đội ${team.data.content.name}`}
                      disabled={busy}
                      onClick={() => open({ kind: "teams", id: teamId })}
                    />
                  )}
                </div>
              ))}
          </section>
          <section aria-labelledby="team-players" className="space-y-3">
            <h3 id="team-players" className="type-section-title">
              Tuyển thủ ở giải này · {playerIds.length}
            </h3>
            {!playerIds.length && (
              <p className="type-meta">Đội chưa có đội hình ở giải này. Thêm đội hình để sửa hồ sơ tuyển thủ.</p>
            )}
            <ul className="space-y-2">
              {players.map((query, index) => (
                <li key={playerIds[index]}>
                  {query.data && editing?.kind === "players" && editing.id === query.data.id ? (
                    <TeamRecordForm
                      key={`${query.data.id}-${query.data.version}`}
                      kind="players"
                      entry={query.data}
                      onSaved={saved}
                      onCancel={() => open(null)}
                      onDirtyChange={setDirty}
                      onBusyChange={setBusy}
                    />
                  ) : (
                    <PlayerRow
                      player={query.data}
                      failed={query.isError}
                      canWrite={canWrite}
                      disabled={busy}
                      onEdit={() => query.data && open({ kind: "players", id: query.data.id })}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EditButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Pencil aria-hidden />
    </Button>
  )
}

function PlayerRow({
  player,
  failed,
  canWrite,
  disabled,
  onEdit,
}: {
  player?: DocumentView<PlayerContent>
  failed: boolean
  canWrite: boolean
  disabled: boolean
  onEdit: () => void
}) {
  if (!player)
    return (
      <p className="type-meta rounded-lg border p-3" role={failed ? "alert" : "status"}>
        {failed ? "Chưa tải được hồ sơ tuyển thủ." : "Đang tải hồ sơ tuyển thủ…"}
      </p>
    )
  const { nickname, fullName, lane, photoUrl } = player.content
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <RegistryLogo url={photoUrl} name={nickname} portrait />
      <div className="min-w-0 flex-1">
        <p className="type-body break-words">{nickname}</p>
        <p className="type-meta flex items-center gap-1.5">
          {lane && <LaneIcon lane={lane} size={14} className="shrink-0" />}
          <span className="break-words">{[fullName, lane && LANE_LABELS[lane].name].filter(Boolean).join(" · ")}</span>
        </p>
      </div>
      {canWrite && <EditButton label={`Sửa hồ sơ tuyển thủ ${nickname}`} disabled={disabled} onClick={onEdit} />}
    </div>
  )
}
