import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, Trash2 } from "lucide-react"
import { Input } from "@aov/ui/components/input"
import { registrySearchText } from "./registry-form-model"
import { RECORD_KIND_LABELS, recordLabel } from "./record-lifecycle-model"
import { RecordLifecycleActions } from "./record-lifecycle-actions"
import { tournamentApi, tournamentError, tournamentKeys, type RecordKind } from "./tournament-api"

export function RecordTrash({
  initialKind,
  actorKey,
  canWrite,
}: {
  initialKind: RecordKind
  actorKey: string
  canWrite: boolean
}) {
  const [kind, setKind] = useState(initialKind)
  const [search, setSearch] = useState("")
  const records = useQuery({
    queryKey: [...tournamentKeys.all, "trash", actorKey, kind],
    queryFn: ({ signal }) => tournamentApi.list(kind, signal, { state: "DELETED" }),
  })
  const needsParents = kind === "roster-memberships" || kind === "series" || kind === "games"
  const teams = useQuery({
    queryKey: [...tournamentKeys.all, "trash-lookup", actorKey, "teams"],
    queryFn: ({ signal }) => tournamentApi.list("teams", signal, { state: "ALL" }),
    enabled: needsParents,
  })
  const players = useQuery({
    queryKey: [...tournamentKeys.all, "trash-lookup", actorKey, "players"],
    queryFn: ({ signal }) => tournamentApi.list("players", signal, { state: "ALL" }),
    enabled: kind === "roster-memberships",
  })
  const tournaments = useQuery({
    queryKey: [...tournamentKeys.all, "trash-lookup", actorKey, "tournaments"],
    queryFn: ({ signal }) => tournamentApi.list("tournaments", signal, { state: "ALL" }),
    enabled: needsParents,
  })
  const series = useQuery({
    queryKey: [...tournamentKeys.all, "trash-lookup", actorKey, "series"],
    queryFn: ({ signal }) => tournamentApi.list("series", signal, { state: "ALL" }),
    enabled: kind === "games",
  })
  const query = registrySearchText(search)
  const rows = (records.data ?? []).filter((entry) =>
    registrySearchText([label(entry.content), detail(entry.content), JSON.stringify(entry.content)].join(" ")).includes(
      query,
    ),
  )
  function label(value: unknown) {
    const content = value as { playerId?: string }
    return kind === "roster-memberships"
      ? players.data?.find((entry) => entry.id === content.playerId)?.content.nickname || "Thành viên đội hình"
      : recordLabel(kind, value)
  }
  function detail(value: unknown) {
    const content = value as {
      code?: string
      teamId?: string
      teamAId?: string
      teamBId?: string
      tournamentId?: string
      seriesId?: string
    }
    const match = series.data?.find((entry) => entry.id === content.seriesId)?.content
    const tournamentId = content.tournamentId || match?.tournamentId
    const teamIds = [content.teamId, content.teamAId || match?.teamAId, content.teamBId || match?.teamBId].filter(
      Boolean,
    )
    return [
      content.code,
      tournaments.data?.find((entry) => entry.id === tournamentId)?.content.name,
      ...teamIds.map((id) => teams.data?.find((entry) => entry.id === id)?.content.name),
    ]
      .filter(Boolean)
      .join(" · ")
  }
  return (
    <section className="tournament-trash" aria-label="Thùng rác giải đấu">
      <div className="tournament-overview-controls">
        <span className="tournament-trash-title">
          <Trash2 size={16} />
          Thùng rác
        </span>
        <select
          aria-label="Loại mục trong thùng rác"
          value={kind}
          onChange={(event) => setKind(event.target.value as RecordKind)}
        >
          {Object.entries(RECORD_KIND_LABELS).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
        <div className="tournament-trash-search">
          <Search size={14} />
          <Input
            aria-label="Tìm trong thùng rác"
            placeholder="Tìm tên hoặc mã…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <small className="tournament-filter-count">{rows.length} mục</small>
      </div>
      {records.isPending ? (
        <p className="tournament-muted" role="status">
          Đang tải thùng rác…
        </p>
      ) : records.isError ? (
        <div className="tournament-error" role="alert">
          {tournamentError(records.error)}
          <button type="button" onClick={() => void records.refetch()}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="tournament-trash-list">
          {rows.map((entry) => (
            <article key={entry.id}>
              <div>
                <strong>{label(entry.content)}</strong>
                {detail(entry.content) && <small>{detail(entry.content)}</small>}
                <small>{entry.deletedAt ? new Date(entry.deletedAt).toLocaleString("vi-VN") : "Đã xóa"}</small>
              </div>
              {canWrite && (
                <RecordLifecycleActions kind={kind} entry={entry} name={label(entry.content)} onChanged={() => {}} />
              )}
            </article>
          ))}
        </div>
      )}
      {!records.isPending && !records.isError && !rows.length && (
        <p className="tournament-empty-inline">
          {search ? "Không có mục đã xóa khớp tìm kiếm." : "Thùng rác đang trống."}
        </p>
      )}
    </section>
  )
}
