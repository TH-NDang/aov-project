import { useEffect, useState } from "react"
import type {
  DocumentView,
  PlayerContent,
  RosterMembershipContent,
  TeamContent,
  TournamentContent,
} from "@aov/community-contracts"
import { useQuery } from "@tanstack/react-query"
import { Edit3, ExternalLink, Info, Plus, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aov/ui/components/alert-dialog"
import { RegistryLogo } from "./registry-logo"
import { RosterMembershipForm } from "./roster-membership-form"
import { ROSTER_STATUSES } from "./roster-model"
import { TeamRegionBadge } from "./team-region"
import { RESULT_VERIFICATIONS } from "./tournament-metadata"
import { LANES } from "./tournament-model"
import { tournamentApi, tournamentError, tournamentKeys } from "./tournament-api"
import "./roster.css"
import { RecordLifecycleActions } from "./record-lifecycle-actions"

type Action =
  | { type: "close" | "cancel" }
  | { type: "tournament"; id: string }
  | { type: "edit"; entry?: DocumentView<RosterMembershipContent> }

function RosterSource({ content }: { content: RosterMembershipContent }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="tournament-icon-button"
          aria-label="Nguồn thông tin đội hình"
          title={RESULT_VERIFICATIONS[content.verification ?? "UNVERIFIED"]}
        >
          <Info size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="tournament-source-popover" align="end">
        <strong>{RESULT_VERIFICATIONS[content.verification ?? "UNVERIFIED"]}</strong>
        {content.sourceUrl && /^https?:\/\//i.test(content.sourceUrl) ? (
          <a href={content.sourceUrl} target="_blank" rel="noopener noreferrer">
            {content.sourceUrl}
            <ExternalLink size={14} />
          </a>
        ) : (
          <small>Chưa có link kiểm chứng.</small>
        )}
        {(content.startsOn || content.endsOn) && (
          <small>
            {content.startsOn ? `Từ ${content.startsOn}` : ""}
            {content.startsOn && content.endsOn ? " · " : ""}
            {content.endsOn ? `Đến ${content.endsOn}` : ""}
          </small>
        )}
        {content.note && <p className="tournament-roster-source-note">{content.note}</p>}
      </PopoverContent>
    </Popover>
  )
}

export function TeamRosterSheet({
  team,
  tournaments,
  players,
  initialTournamentId,
  canWrite,
  actorKey,
  onClose,
}: {
  team: DocumentView<TeamContent>
  tournaments: DocumentView<TournamentContent>[]
  players: DocumentView<PlayerContent>[]
  initialTournamentId?: string
  canWrite: boolean
  actorKey: string
  onClose: () => void
}) {
  const [tournamentId, setTournamentId] = useState(initialTournamentId ?? "")
  const [editor, setEditor] = useState<{ entry?: DocumentView<RosterMembershipContent> } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Action | null>(null)
  const memberships = useQuery({
    queryKey: [...tournamentKeys.all, "roster-memberships", actorKey, team.id, tournamentId],
    queryFn: ({ signal }) => tournamentApi.list("roster-memberships", signal, { teamId: team.id, tournamentId }),
    enabled: !!tournamentId,
  })
  const entries = [...(memberships.data ?? [])].sort((a, b) => {
    const rank = (content: RosterMembershipContent) =>
      content.lane ? LANES.findIndex((lane) => lane.code === content.lane) : 99
    return (
      rank(a.content) - rank(b.content) ||
      (players.find((player) => player.id === a.content.playerId)?.content.nickname ?? "").localeCompare(
        players.find((player) => player.id === b.content.playerId)?.content.nickname ?? "",
        "vi",
      )
    )
  })
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function apply(action: Action) {
    setEditor(null)
    setDirty(false)
    if (action.type === "close") onClose()
    else if (action.type === "tournament") setTournamentId(action.id)
    else if (action.type === "edit") setEditor({ entry: action.entry })
  }

  function request(action: Action) {
    if (busy) return
    if (dirty) setPending(action)
    else apply(action)
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && request({ type: "close" })}>
        <SheetContent
          className="tournament-roster-sheet"
          showCloseButton={!busy}
          onPointerDownOutside={(event) => busy && event.preventDefault()}
          onEscapeKeyDown={(event) => busy && event.preventDefault()}
        >
          <div className="tournament-roster-team-heading">
            <RegistryLogo url={team.content.logoUrl} name={team.content.name} />
            <div>
              <SheetTitle>{team.content.shortName || team.content.name}</SheetTitle>
              <TeamRegionBadge code={team.content.country} />
            </div>
          </div>
          <SheetDescription>Đội hình theo giải. Vị trí chưa có nguồn xác định được giữ trống.</SheetDescription>
          <div className="tournament-roster-scope">
            <label>
              Giải đấu
              <select
                aria-label="Giải đấu của đội hình"
                value={tournamentId}
                disabled={busy}
                onChange={(event) => request({ type: "tournament", id: event.target.value })}
              >
                <option value="">Chọn giải đấu</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.content.name}
                  </option>
                ))}
              </select>
            </label>
            {canWrite && (
              <Button
                type="button"
                size="sm"
                disabled={!tournamentId || busy || memberships.isPending || memberships.isError}
                onClick={() => request({ type: "edit" })}
              >
                <Plus size={14} />
                Thêm tuyển thủ
              </Button>
            )}
          </div>
          {!tournamentId ? (
            <div className="tournament-empty-context">
              <Users size={22} />
              Chọn giải để xem đội hình đã ghi nhận.
            </div>
          ) : memberships.isPending ? (
            <p className="tournament-muted" role="status">
              Đang tải đội hình…
            </p>
          ) : memberships.isError ? (
            <div className="tournament-error" role="alert">
              {tournamentError(memberships.error)}
              <button type="button" onClick={() => void memberships.refetch()}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="tournament-roster-list-heading">
                <strong>{entries.length} tuyển thủ</strong>
                <small title="Thông tin của giải đã chọn không xác định đội hiện tại của tuyển thủ.">
                  Theo giải đã chọn
                </small>
              </div>
              {editor && canWrite && (
                <RosterMembershipForm
                  key={`${tournamentId}-${editor.entry?.id ?? "new"}`}
                  entry={editor.entry}
                  teamId={team.id}
                  tournamentId={tournamentId}
                  players={players}
                  existingPlayerIds={entries.map((entry) => entry.content.playerId)}
                  onSaved={() => {
                    setEditor(null)
                    setDirty(false)
                  }}
                  onCancel={() => request({ type: "cancel" })}
                  onDirtyChange={setDirty}
                  onBusyChange={setBusy}
                />
              )}
              <div className="tournament-membership-list">
                {entries.map((entry) => {
                  const player = players.find((player) => player.id === entry.content.playerId)
                  const lane = LANES.find((lane) => lane.code === entry.content.lane)
                  const body = (
                    <>
                      <RegistryLogo
                        url={player?.content.photoUrl}
                        name={player?.content.nickname || "Tuyển thủ"}
                        portrait
                      />
                      <div>
                        <strong>{player?.content.nickname || "Hồ sơ không còn khả dụng"}</strong>
                        <small>
                          {ROSTER_STATUSES[entry.content.status ?? "UNKNOWN"]}
                          {entry.content.jerseyNumber ? ` · #${entry.content.jerseyNumber}` : ""}
                        </small>
                      </div>
                      <span className="tournament-member-lane" title={lane?.name || "Chưa có nguồn xác định vị trí"}>
                        {lane?.short || "Chưa rõ"}
                      </span>
                      {canWrite && <Edit3 size={13} aria-hidden="true" />}
                    </>
                  )
                  return (
                    <article key={entry.id}>
                      {canWrite ? (
                        <button
                          type="button"
                          className="tournament-member-body"
                          aria-label={`Sửa đội hình ${player?.content.nickname || "tuyển thủ"}`}
                          onClick={() => request({ type: "edit", entry })}
                          disabled={busy}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="tournament-member-body">{body}</div>
                      )}
                      <RosterSource content={entry.content} />
                      {canWrite && (
                        <RecordLifecycleActions
                          kind="roster-memberships"
                          entry={entry}
                          name={`thành viên ${player?.content.nickname || "đội hình"}`}
                          compact
                          disabled={busy || dirty}
                          onChanged={() => {
                            if (editor?.entry?.id === entry.id) setEditor(null)
                          }}
                          onNavigate={onClose}
                          onBusyChange={setBusy}
                        />
                      )}
                    </article>
                  )
                })}
              </div>
              {!entries.length && !editor && (
                <p className="tournament-empty-inline">Chưa ghi nhận tuyển thủ cho đội tại giải này.</p>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đội hình còn thay đổi chưa lưu</AlertDialogTitle>
            <AlertDialogDescription>Lưu thành viên để giữ thông tin trên máy chủ.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ở lại chỉnh sửa</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) apply(pending)
                setPending(null)
              }}
            >
              Bỏ thay đổi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
