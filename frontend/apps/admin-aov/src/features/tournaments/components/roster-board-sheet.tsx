import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, PlayerContent, RosterMembershipContent, TeamContent } from "@aov/community-contracts"
import { ClipboardList, CircleAlert, CopyPlus, Save, UserRoundPlus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { confirmAction, confirmDiscard } from "@/components/confirm-dialog"
import { CreateProfileSheet } from "@/features/community/components/create-profile-sheet"
import { copiedRoster, rosterContents } from "@/features/competition/model/copy-setup"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import {
  addedLine,
  captainLines,
  lineChanged,
  rosterBatchOf,
  rosterLines,
  rosterWarnings,
  sortedLines,
  type RosterLine,
} from "../model/roster-board-model"
import { PasteNamesDialog } from "./paste-names-dialog"
import { RecordPicker } from "./record-picker"
import { RegistryLogo } from "./registry-logo"
import { RosterBoardRow } from "./roster-board-row"
import { TeamRegionBadge } from "./team-region"
import { TeamStaffSection } from "./team-staff-section"

type Known = Pick<PlayerContent, "nickname" | "photoUrl" | "lane">

/**
 * A team's whole roster at one tournament as one table: everyone's lane and standing at once, players added several at
 * a time, and one save that writes every change or none. The staff below is part of the tournament record and saves on
 * its own.
 */
export function RosterBoardSheet({
  teamId,
  team,
  tournamentId,
  rows,
  players,
  actorKey,
  canWrite,
  onClose,
}: {
  teamId: string
  team?: TeamContent
  tournamentId: string
  /** The team's stored lines at this tournament. */
  rows: DocumentView<RosterMembershipContent>[]
  /** Absent while the names are on their way. */
  players?: ReadonlyMap<string, PlayerContent>
  actorKey: string
  canWrite: boolean
  onClose: () => void
}) {
  const client = useQueryClient()
  const [lines, setLines] = useState<RosterLine[]>(() => rosterLines(rows))
  const [added, setAdded] = useState<Record<string, Known>>({})
  const [staffDirty, setStaffDirty] = useState(false)
  const [dialog, setDialog] = useState<"paste" | "create" | null>(null)
  const known = (id: string): Known | undefined => added[id] ?? players?.get(id)
  const name = (id: string) => known(id)?.nickname ?? (players ? "Tuyển thủ chưa rõ tên" : "…")
  const changes = lines.filter(lineChanged).length
  const warnings = rosterWarnings(lines, name)
  const blocked = warnings.some((warning) => warning.blocking)
  const taken = lines.map((line) => line.content.playerId)

  const save = useMutation({
    mutationFn: () => tournamentApi.rosterBatch(rosterBatchOf(lines)),
    meta: { silent: true, successMessage: "Đã lưu đội hình." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      onClose()
    },
  })
  const copy = useMutation({
    mutationFn: async (sourceId: string) => {
      const found = await tournamentApi.list("roster-memberships", undefined, { tournamentId: sourceId, teamId })
      const current = lines.map((line) => line.content)
      const contents = copiedRoster(rosterContents(found), tournamentId, current)
      const named = await Promise.all(
        contents
          .filter((content) => !known(content.playerId))
          .map(async (content) => [content.playerId, (await tournamentApi.read("players", content.playerId)).content]),
      )
      return { contents, named: Object.fromEntries(named) as Record<string, Known> }
    },
    meta: { silent: true },
    onSuccess: ({ contents, named }) => {
      setAdded((current) => ({ ...current, ...named }))
      setLines((current) => sortedLines([...current, ...contents.map((content) => ({ content }))]))
    },
  })
  const busy = save.isPending || copy.isPending
  const dirty = changes > 0
  useEffect(() => {
    if (!dirty && !staffDirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, staffDirty])

  const add = (records: { id: string; content: Known }[]) => {
    setAdded((current) => ({ ...current, ...Object.fromEntries(records.map((row) => [row.id, row.content])) }))
    setLines((current) => {
      const next = [...current]
      for (const { id, content } of records) {
        const at = next.findIndex((line) => line.content.playerId === id)
        if (at < 0) next.push(addedLine(next, { tournamentId, teamId }, id, content.lane))
        else next[at] = { ...next[at]!, removed: false }
      }
      return next
    })
  }
  const pick = async (id: string) => {
    if (id) add([{ id, content: known(id) ?? (await tournamentApi.read("players", id)).content }])
  }
  const change = (index: number, patch: Partial<RosterMembershipContent>) =>
    setLines((current) =>
      current.map((line, at) => (at === index ? { ...line, content: { ...line.content, ...patch } } : line)),
    )
  const close = async () => {
    if (busy) return
    if (dirty || staffDirty) {
      const discard = await confirmDiscard({
        title: "Đội hình còn thay đổi chưa lưu",
        description: dirty ? `${changes} dòng đội hình chưa được ghi.` : "Ban huấn luyện chưa được ghi.",
      })
      if (!discard) return
    }
    onClose()
  }
  const submit = async () => {
    const removed = lines.filter((line) => line.removed && line.stored)
    if (removed.length) {
      const confirmed = await confirmAction({
        title: `Bỏ ${removed.length} người khỏi đội hình?`,
        description: `${removed.map((line) => name(line.content.playerId)).join(", ")} vào thùng rác và khôi phục được; hồ sơ tuyển thủ giữ nguyên.`,
        confirmLabel: "Lưu đội hình",
      })
      if (!confirmed) return
    }
    save.mutate()
  }

  return (
    <Sheet open onOpenChange={(open) => !open && void close()}>
      <SheetContent
        className="w-full gap-0 sm:max-w-4xl"
        showCloseButton={!busy}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
      >
        <header className="flex items-center gap-3 border-b p-4 pr-12 sm:px-6">
          <RegistryLogo url={team?.logoUrl} darkUrl={team?.logoDarkUrl} name={team?.name ?? "Đội"} />
          <div className="min-w-0">
            <SheetTitle className="type-section-title truncate">Đội hình {team?.name}</SheetTitle>
            <TeamRegionBadge code={team?.country} />
          </div>
          <SheetDescription className="sr-only">
            Vị trí, trạng thái và số áo của từng tuyển thủ ở giải này.
          </SheetDescription>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3 sm:px-6">
              <span className="w-56">
                <RecordPicker
                  kind="players"
                  value=""
                  label="Thêm tuyển thủ"
                  context={{ teamId, tournamentId }}
                  exclude={taken}
                  disabled={busy}
                  onChange={(id) => void pick(id)}
                />
              </span>
              <span className="w-56">
                <RecordPicker
                  kind="tournaments"
                  value=""
                  label="Chép từ giải khác"
                  context={{ teamId }}
                  exclude={[tournamentId]}
                  disabled={busy}
                  onChange={(id) => id && copy.mutate(id)}
                />
              </span>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog("paste")}>
                <ClipboardList aria-hidden /> Dán danh sách
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog("create")}>
                <UserRoundPlus aria-hidden /> Tạo hồ sơ mới
              </Button>
              {copy.isPending && (
                <span className="type-meta flex items-center gap-1.5" role="status">
                  <CopyPlus className="size-4" aria-hidden /> Đang chép…
                </span>
              )}
              {copy.data && !copy.data.contents.length && (
                <span className="type-meta" role="status">
                  Giải đã chọn không có tuyển thủ nào mới của đội.
                </span>
              )}
            </div>
          )}
          {lines.length ? (
            <ul>
              {lines.map((line, index) => (
                <RosterBoardRow
                  key={line.content.playerId}
                  line={line}
                  name={name(line.content.playerId)}
                  photoUrl={known(line.content.playerId)?.photoUrl}
                  disabled={!canWrite || busy}
                  onChange={(patch) => change(index, patch)}
                  onCaptain={() => setLines((current) => captainLines(current, line.content.playerId))}
                  onRemove={() =>
                    setLines((current) =>
                      line.stored
                        ? current.map((row, at) => (at === index ? { ...row, removed: true } : row))
                        : current.filter((_, at) => at !== index),
                    )
                  }
                  onRestore={() =>
                    setLines((current) => current.map((row, at) => (at === index ? { ...row, removed: false } : row)))
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="type-body px-6 py-8 text-muted-foreground">Chưa có tuyển thủ nào.</p>
          )}
          {warnings.length > 0 && (
            <ul className="space-y-1 border-t px-4 py-3 sm:px-6">
              {warnings.map((warning) => (
                <li
                  key={warning.text}
                  className={`type-body flex items-start gap-2 ${warning.blocking ? "text-destructive" : "text-(--aov-warning)"}`}
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {warning.text}
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-4 sm:px-6">
            <TeamStaffSection
              teamId={teamId}
              tournamentId={tournamentId}
              actorKey={actorKey}
              canWrite={canWrite}
              onDirtyChange={setStaffDirty}
            />
          </div>
        </div>
        {canWrite && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t bg-background p-4">
            {(save.error || copy.error) && (
              <p className="type-body mr-auto text-destructive" role="alert">
                {tournamentError(save.error ?? copy.error)}
              </p>
            )}
            <Button type="button" variant="outline" disabled={busy} onClick={() => void close()}>
              Hủy
            </Button>
            <Button type="button" disabled={busy || blocked || !dirty} onClick={() => void submit()}>
              <Save aria-hidden /> {save.isPending ? "Đang lưu…" : `Lưu đội hình${dirty ? ` · ${changes}` : ""}`}
            </Button>
          </footer>
        )}
        {dialog === "paste" && (
          <PasteNamesDialog
            kind="players"
            context={{ teamId, tournamentId }}
            exclude={taken}
            onAdd={add}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === "create" && (
          <CreateProfileSheet
            kind="PLAYER"
            submitLabel="Tạo và thêm vào đội hình"
            onClose={() => setDialog(null)}
            onCreated={(entry) => {
              setDialog(null)
              if (entry.entityId) void pick(entry.entityId)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
