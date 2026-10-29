import { useEffect, useState, type FormEvent } from "react"
import type { DocumentView, PlayerContent, RosterMembershipContent } from "@aov/community-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Save, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { CatalogPicker } from "./catalog-picker"
import { initialRosterMembership, ROSTER_STATUSES, rosterFormIssue } from "./roster-model"
import { LANES } from "./tournament-model"
import { RESULT_VERIFICATIONS } from "./tournament-metadata"
import { tournamentApi, tournamentError, tournamentKeys } from "./tournament-api"
import { RecordLifecycleActions } from "./record-lifecycle-actions"

export function RosterMembershipForm({
  entry,
  teamId,
  tournamentId,
  players,
  existingPlayerIds,
  onSaved,
  onCancel,
  onDirtyChange,
  onBusyChange,
}: {
  entry?: DocumentView<RosterMembershipContent>
  teamId: string
  tournamentId: string
  players: DocumentView<PlayerContent>[]
  existingPlayerIds: string[]
  onSaved: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
}) {
  const [initial] = useState(() => entry?.content ?? initialRosterMembership(teamId, tournamentId))
  const [content, setContent] = useState(initial)
  const [error, setError] = useState("")
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const dirty = JSON.stringify(content) !== JSON.stringify(initial)
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      if (entry) await tournamentApi.save("roster-memberships", entry, content)
      else await tournamentApi.create("roster-memberships", content)
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
  })
  const busy = mutation.isPending || lifecycleBusy
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    onBusyChange(busy)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const issue = rosterFormIssue(content)
    if (issue) {
      setError(issue)
      return
    }
    setError("")
    try {
      await mutation.mutateAsync()
      onSaved()
    } catch (cause) {
      setError(tournamentError(cause))
    }
  }
  const options = players
    .filter((player) => !existingPlayerIds.includes(player.id) || player.id === entry?.content.playerId)
    .map((player) => ({
      id: player.id,
      code: player.content.code,
      name: player.content.nickname,
      iconUrl: player.content.photoUrl,
    }))
  return (
    <form className="tournament-roster-form" onSubmit={submit}>
      <div className="tournament-roster-form-heading">
        <strong>{entry ? "Sửa thành viên" : "Thêm vào đội hình"}</strong>
        <button
          className="tournament-icon-button"
          type="button"
          aria-label="Đóng phần sửa đội hình"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={14} />
        </button>
      </div>
      <fieldset disabled={busy}>
        <label className="tournament-roster-player-field">
          Tuyển thủ
          <CatalogPicker
            value={{ id: content.playerId }}
            options={options}
            searchAliases={Object.fromEntries(
              players.map((player) => [
                player.id,
                [player.content.fullName, ...(player.content.aliases ?? [])].filter(Boolean).join(" "),
              ]),
            )}
            allowManual={false}
            label="Tuyển thủ của đội hình"
            onChange={(player) => setContent((current) => ({ ...current, playerId: player.id || "" }))}
          />
        </label>
        <label>
          Vị trí
          <select
            aria-label="Vị trí trong đội hình"
            value={content.lane ?? ""}
            onChange={(event) =>
              setContent({ ...content, lane: (event.target.value || null) as RosterMembershipContent["lane"] })
            }
          >
            <option value="">Chưa có nguồn xác định</option>
            {LANES.map((lane) => (
              <option key={lane.code} value={lane.code}>
                {lane.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select
            aria-label="Trạng thái thành viên"
            value={content.status ?? "UNKNOWN"}
            onChange={(event) =>
              setContent({ ...content, status: event.target.value as RosterMembershipContent["status"] })
            }
          >
            {Object.entries(ROSTER_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Số áo
          <input
            aria-label="Số áo tuyển thủ"
            value={content.jerseyNumber ?? ""}
            maxLength={20}
            onChange={(event) => setContent({ ...content, jerseyNumber: event.target.value || null })}
          />
        </label>
        <label>
          Nguồn kiểm chứng
          <input
            type="url"
            aria-label="Nguồn đội hình"
            value={content.sourceUrl ?? ""}
            maxLength={2048}
            required={content.verification !== "UNVERIFIED" && !!content.verification}
            onChange={(event) => setContent({ ...content, sourceUrl: event.target.value || null })}
            placeholder="https://…"
          />
        </label>
        <label>
          Mức kiểm chứng
          <select
            aria-label="Mức kiểm chứng đội hình"
            value={content.verification ?? "UNVERIFIED"}
            onChange={(event) =>
              setContent({ ...content, verification: event.target.value as RosterMembershipContent["verification"] })
            }
          >
            {Object.entries(RESULT_VERIFICATIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <details className="tournament-roster-extra">
          <summary>Thời gian và ghi chú</summary>
          <div>
            <label>
              Từ ngày
              <input
                type="date"
                value={content.startsOn ?? ""}
                onChange={(event) => setContent({ ...content, startsOn: event.target.value || null })}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                value={content.endsOn ?? ""}
                onChange={(event) => setContent({ ...content, endsOn: event.target.value || null })}
              />
            </label>
            <label>
              Ghi chú
              <textarea
                value={content.note ?? ""}
                maxLength={2000}
                onChange={(event) => setContent({ ...content, note: event.target.value || null })}
              />
            </label>
          </div>
        </details>
      </fieldset>
      {error && (
        <p className="tournament-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={busy || (!dirty && !!entry)}>
        <Save size={14} />
        {mutation.isPending ? "Đang lưu…" : entry ? "Lưu đội hình" : "Thêm thành viên"}
      </Button>
      {entry && (
        <RecordLifecycleActions
          kind="roster-memberships"
          entry={entry}
          name={`thành viên ${players.find((player) => player.id === content.playerId)?.content.nickname || "đội hình"}`}
          disabled={busy || dirty}
          onChanged={onSaved}
          onNavigate={onSaved}
          onBusyChange={setLifecycleBusy}
        />
      )}
    </form>
  )
}
