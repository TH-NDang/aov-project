import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Input } from "@aov/ui/components/input"
import { pageApi, pageKeys } from "./page-api"
import { useRecords, useTournamentAccess } from "@/features/esports/data/use-esports-data"

export function ProfilePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string | null
  onChange: (value: string) => void
}) {
  const [search, setSearch] = useState("")
  const access = useTournamentAccess()
  const query = useQuery({
    queryKey: [...pageKeys, access.actorKey, "picker", search],
    queryFn: () => pageApi.list("", search),
  })
  const selected = useQuery({
    queryKey: [...pageKeys, access.actorKey, value],
    queryFn: () => pageApi.read(value!),
    enabled: !!value,
  })
  const options = query.data?.items || []
  return (
    <div className="grid gap-2">
      <label className="type-label">
        {label}
        <Input
          aria-label={`Tìm ${label.toLowerCase()}`}
          className="mt-2"
          placeholder="Tìm theo tên…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <select
        aria-label={label}
        className="h-10 rounded-md border bg-background px-3 text-sm"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Chưa liên kết</option>
        {value && !options.some((row) => row.id === value) && (
          <option value={value}>{selected.data?.content?.name || "Hồ sơ đã chọn"}</option>
        )}
        {options.map((row) => (
          <option value={row.id} key={row.id}>
            {row.content?.name || row.code}
          </option>
        ))}
      </select>
      {query.isError && <p className="type-meta text-destructive">Chưa tải được danh sách hồ sơ.</p>}
    </div>
  )
}
export function TournamentPicker({ value, onChange }: { value?: string | null; onChange: (value: string) => void }) {
  const query = useRecords("tournaments")
  return (
    <label className="grid gap-2">
      <span className="type-label">Liên kết mùa giải</span>
      <select
        className="h-10 rounded-md border bg-background px-3 text-sm"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Chưa liên kết</option>
        {query.data?.map((row) => (
          <option value={row.id} key={row.id}>
            {row.content.name}
          </option>
        ))}
      </select>
    </label>
  )
}
