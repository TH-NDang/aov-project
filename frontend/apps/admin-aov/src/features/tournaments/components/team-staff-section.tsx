import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, UserRoundPlus, X } from "lucide-react"
import { personRoleLabels, staffRoles, type StaffMember, type StaffRole } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { confirmAction } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { pageKeys } from "@/features/community/api/page-api"
import { PageSearchDialog } from "@/features/community/components/page-search-dialog"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import {
  MAX_STAFF,
  MAX_STAFF_TITLE,
  staffOfTeam,
  withStaffMember,
  withTeamStaff,
  withoutStaffMember,
} from "../model/crew-model"
import { PersonLine } from "./crew-people"

/**
 * A team's coaches and analysts at one tournament. The staff is part of the tournament record, so a save writes that
 * record, with the other teams' lines left as they were. Read-only until the edit button; taking someone off asks first.
 */
export function TeamStaffSection({
  teamId,
  tournamentId,
  actorKey,
  canWrite,
  onDirtyChange,
}: {
  teamId: string
  tournamentId: string
  actorKey: string
  canWrite: boolean
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  const tournament = useQuery({
    queryKey: tournamentKeys.one("tournaments", actorKey, tournamentId),
    queryFn: ({ signal }) => tournamentApi.read("tournaments", tournamentId, signal),
  })
  const all = tournament.data?.content.staff ?? []
  const saved = staffOfTeam(all, teamId)
  const [draft, setDraft] = useState<StaffMember[] | null>(null)
  const [role, setRole] = useState<StaffRole>("COACH")
  const [picking, setPicking] = useState(false)
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved)
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  const save = useMutation({
    mutationFn: (lines: StaffMember[]) => {
      const entry = tournament.data!
      return tournamentApi.save("tournaments", entry, {
        ...entry.content,
        staff: withTeamStaff(entry.content.staff, teamId, lines),
      })
    },
    meta: { silent: true, successMessage: "Đã lưu ban huấn luyện." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      setDraft(null)
    },
  })
  const remove = async (line: StaffMember, name: string) => {
    const confirmed = await confirmAction({
      title: `Gỡ ${name} khỏi ban huấn luyện?`,
      description: `${name} · ${line.title || personRoleLabels[line.role]} → không còn trong ban huấn luyện khi bạn bấm Lưu.`,
      confirmLabel: "Gỡ khỏi ban huấn luyện",
    })
    if (confirmed && draft) setDraft(withoutStaffMember(draft, line))
  }
  const full = !!draft && all.length - saved.length + draft.length >= MAX_STAFF
  const busy = save.isPending

  return (
    <section aria-label="Ban huấn luyện" className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-section-title">Ban huấn luyện</h3>
        {canWrite && tournament.data && !draft && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(saved)}>
            <Pencil aria-hidden /> Sửa
          </Button>
        )}
      </div>
      {tournament.isPending ? (
        <p className="type-meta" role="status">
          Đang tải ban huấn luyện…
        </p>
      ) : tournament.isError ? (
        <p className="type-body text-destructive" role="alert">
          {tournamentError(tournament.error)}{" "}
          <button type="button" className="underline" onClick={() => void tournament.refetch()}>
            Thử lại
          </button>
        </p>
      ) : !draft ? (
        saved.length ? (
          <ul className="space-y-2">
            {saved.map((line) => (
              <li key={`${line.pageId}-${line.role}`}>
                <PersonLine pageId={line.pageId} actorKey={actorKey} meta={line.title || personRoleLabels[line.role]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-meta">Chưa ghi nhận ban huấn luyện của đội tại giải này.</p>
        )
      ) : (
        <div className="space-y-3">
          {draft.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {draft.map((line) => (
                <li key={`${line.pageId}-${line.role}`} className="space-y-2 px-3 py-2">
                  <PersonLine pageId={line.pageId} actorKey={actorKey} meta={personRoleLabels[line.role]}>
                    {(name) => (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Gỡ ${name} · ${personRoleLabels[line.role]}`}
                        disabled={busy}
                        onClick={() => void remove(line, name)}
                      >
                        <X aria-hidden />
                      </Button>
                    )}
                  </PersonLine>
                  <Input
                    aria-label="Chức danh như nguồn ghi"
                    placeholder={personRoleLabels[line.role]}
                    maxLength={MAX_STAFF_TITLE}
                    disabled={busy}
                    value={line.title ?? ""}
                    onChange={(event) =>
                      setDraft(draft.map((row) => (row === line ? { ...row, title: event.target.value } : row)))
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-meta">Chưa có ai.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="Vai trò của người được thêm"
              value={role}
              disabled={busy}
              onChange={(event) => setRole(event.target.value as StaffRole)}
            >
              {staffRoles.map((code) => (
                <option key={code} value={code}>
                  {personRoleLabels[code]}
                </option>
              ))}
            </NativeSelect>
            <Button type="button" variant="outline" disabled={busy || full} onClick={() => setPicking(true)}>
              <UserRoundPlus aria-hidden /> Thêm người
            </Button>
          </div>
          {save.error && (
            <p role="alert" className="type-body text-destructive">
              {tournamentError(save.error)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={busy || !dirty} onClick={() => save.mutate(draft)}>
              Lưu
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                save.reset()
                setDraft(null)
              }}
            >
              Hủy
            </Button>
          </div>
          <PageSearchDialog
            open={picking}
            onOpenChange={setPicking}
            label="Người trong ban huấn luyện"
            kinds={["PERSON", "PLAYER"]}
            actorKey={actorKey}
            canCreate
            createRoles={[role]}
            onSelect={(profile) => {
              if (!profile) return
              client.setQueryData(pageKeys.page(actorKey, profile.id), profile)
              setDraft((current) => withStaffMember(current ?? [], { teamId, pageId: profile.id, role }))
            }}
          />
        </div>
      )}
    </section>
  )
}
