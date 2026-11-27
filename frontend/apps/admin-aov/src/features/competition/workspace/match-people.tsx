import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CrewMember, DocumentView, SeriesContent } from "@aov/community-contracts"
import { Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { CrewEditor, CrewList } from "@/features/tournaments/components/crew-people"
import { LinkedPlayer, MvpChooser, usePlayerName } from "@/features/tournaments/components/mvp-chooser"
import { MAX_SERIES_CREW } from "@/features/tournaments/model/crew-model"
import { candidateName, mvpGroups } from "@/features/tournaments/model/mvp-model"
import { PlayerName } from "../peek/competitor-peek"
import { rosterOrder } from "./model"
import type { Workspace } from "./parts"

/**
 * The match's MVP and the people of its own broadcast, besides the tournament's crew. Read-only until the edit button; replacing or
 * removing a recorded MVP asks first, with the old and the new name.
 */
export function MatchPeople({ ws, record }: { ws: Workspace; record: DocumentView<SeriesContent> }) {
  const [editing, setEditing] = useState(false)
  const { mvpPlayerId, broadcast } = record.content
  const people = ws.entry.content.people
  if (editing) return <MatchPeopleForm ws={ws} record={record} onDone={() => setEditing(false)} />
  return (
    <div className="flex items-start gap-3">
      <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <dt className="type-label text-muted-foreground">MVP trận</dt>
          <dd className="mt-1">
            {mvpPlayerId ? (
              <LinkedPlayer
                id={mvpPlayerId}
                known={ws.entry.content.players[mvpPlayerId]}
                renderName={(name) => <PlayerName id={mvpPlayerId}>{name}</PlayerName>}
              />
            ) : (
              <span className="type-body">Chưa có</span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="type-label text-muted-foreground">Phát sóng riêng trận</dt>
          <dd className="mt-1">
            <CrewList crew={broadcast} people={people} actorKey={ws.access.actorKey} empty="Chưa có" />
          </dd>
        </div>
      </dl>
      {ws.canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sửa MVP và phát sóng của trận"
          title="Sửa MVP và phát sóng của trận"
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden />
        </Button>
      )}
    </div>
  )
}

function MatchPeopleForm({
  ws,
  record,
  onDone,
}: {
  ws: Workspace
  record: DocumentView<SeriesContent>
  onDone: () => void
}) {
  const client = useQueryClient()
  const known = ws.entry.content.players
  const current = record.content.mvpPlayerId ?? null
  // Both rosters, starters first; the search reaches anyone else.
  const groups = mvpGroups(
    [record.content.teamAId, record.content.teamBId].map((teamId) => ({
      key: teamId,
      title: ws.team(teamId).name,
      players: rosterOrder(ws.rosters.filter((row) => row.content.teamId === teamId).map((row) => row.content)).map(
        (row) => ({
          id: row.playerId,
          name: known[row.playerId]?.nickname ?? "Tuyển thủ",
          photoUrl: known[row.playerId]?.photoUrl,
        }),
      ),
    })),
  )
  const currentName = usePlayerName(current, (current && known[current]?.nickname) || candidateName(groups, current))
  const [mvp, setMvp] = useState<{ id: string | null; name: string }>({ id: current, name: "" })
  const [crew, setCrew] = useState<CrewMember[]>(record.content.broadcast ?? [])
  const save = useMutation({
    mutationFn: () => tournamentApi.save("series", record, { ...record.content, mvpPlayerId: mvp.id, broadcast: crew }),
    meta: { silent: true, successMessage: "Đã lưu MVP và phát sóng của trận." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      onDone()
    },
  })
  const unchanged = mvp.id === current && JSON.stringify(crew) === JSON.stringify(record.content.broadcast ?? [])
  const submit = async () => {
    if (current && mvp.id !== current) {
      const confirmed = await confirmAction({
        title: mvp.id ? "Đổi MVP trận?" : "Bỏ MVP trận?",
        description: `${currentName} → ${mvp.id ? mvp.name || "tuyển thủ đã chọn" : "không có MVP"}.`,
        confirmLabel: mvp.id ? "Đổi MVP" : "Bỏ MVP",
      })
      if (!confirmed) return
    }
    save.mutate()
  }

  return (
    <div className="space-y-5 rounded-lg border bg-background p-4" aria-label="MVP và phát sóng của trận" role="group">
      <section className="space-y-2">
        <h3 className="type-section-title">MVP trận</h3>
        <MvpChooser
          value={mvp.id}
          groups={groups}
          context={{ tournamentId: ws.entry.id, teamId: record.content.teamAId }}
          disabled={save.isPending}
          onChange={(id, name) => setMvp({ id, name })}
        />
      </section>
      <section className="space-y-2">
        <h3 className="type-section-title">Phát sóng riêng trận</h3>
        <CrewEditor
          value={crew}
          onChange={setCrew}
          people={ws.entry.content.people}
          actorKey={ws.access.actorKey}
          max={MAX_SERIES_CREW}
          disabled={save.isPending}
        />
      </section>
      {save.error && (
        <p className="type-body text-destructive" role="alert">
          {tournamentError(save.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={save.isPending || unchanged} onClick={() => void submit()}>
          Lưu
        </Button>
        <Button type="button" variant="ghost" disabled={save.isPending} onClick={onDone}>
          Hủy
        </Button>
      </div>
    </div>
  )
}
