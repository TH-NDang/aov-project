import { useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Check, ChevronDown, ImageOff, Search, X } from "lucide-react"
import { Input } from "@aov/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useDebounced } from "@/features/community/directory/directory-api"
import { recordIcon, recordName, recordReason, type RecordKind } from "../model/record-reason"
import { tournamentApi, tournamentError, tournamentKeys, type PickerContext } from "../api/tournament-api"

/**
 * Picks a team, player or tournament from the server's ranking: exact names first, then what belongs to `context`, then
 * what was active last. Rows load as the list scrolls, so a long history costs nothing until someone looks for it.
 */
export function RecordPicker({
  kind,
  value,
  label,
  onChange,
  context,
  exclude,
  disabled = false,
  compact = false,
  required = false,
}: {
  kind: RecordKind
  value: string | null | undefined
  label: string
  onChange: (id: string, name: string) => void
  context?: PickerContext
  /** Rows the caller already has, such as the teams already entered in the tournament. */
  exclude?: readonly string[]
  disabled?: boolean
  compact?: boolean
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const settled = useDebounced(search)
  const results = useInfiniteQuery({
    queryKey: tournamentKeys.picker(kind, settled, context),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => tournamentApi.pick(kind, { q: settled, ...context, page: pageParam }, signal),
    getNextPageParam: nextPageOf,
    enabled: open,
    staleTime: 30_000,
  })
  const rows = (results.data?.pages.flatMap((page) => page.items) ?? []).filter((row) => !exclude?.includes(row.id))
  const known = rows.find((row) => row.id === value)
  const selected = useQuery({
    queryKey: tournamentKeys.pickerSelected(kind, value),
    queryFn: ({ signal }) => tournamentApi.read(kind, value!, signal),
    enabled: !!value && !known,
    staleTime: 60_000,
  })
  const entry = known ?? selected.data
  const name = entry ? recordName(kind, entry.content) : value ? "Đang tải…" : label
  const iconUrl = entry ? recordIcon(kind, entry.content) : undefined
  const choose = (id: string, chosen: string) => {
    onChange(id, chosen)
    setOpen(false)
    setSearch("")
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="tournament-catalog-trigger"
          data-compact={compact || undefined}
          disabled={disabled}
          aria-label={`${label}: ${value ? name : "chưa chọn"}`}
          title={`${label}: ${value ? name : "chưa chọn"}`}
        >
          <span className="tournament-reference-image">
            {iconUrl ? <img src={iconUrl} alt="" loading="lazy" /> : <ImageOff size={15} />}
          </span>
          <span className="tournament-catalog-label">{name}</span>
          <ChevronDown size={12} />
        </button>
      </PopoverTrigger>
      {required && (
        <input
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value ?? ""}
          onChange={() => undefined}
        />
      )}
      <PopoverContent className="tournament-picker" align="start" sideOffset={6}>
        <div className="tournament-picker-search">
          <Search size={15} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Tìm ${label.toLocaleLowerCase()}…`}
            aria-label={`Tìm ${label.toLocaleLowerCase()}`}
          />
        </div>
        <div className="tournament-picker-options">
          {rows.map((row) => {
            const rowName = recordName(kind, row.content)
            const rowIcon = recordIcon(kind, row.content)
            return (
              <button key={row.id} type="button" onClick={() => choose(row.id, rowName)}>
                <span className="tournament-reference-image">
                  {rowIcon ? <img src={rowIcon} alt="" loading="lazy" /> : <ImageOff size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{rowName}</span>
                  <span className="type-meta block truncate">{recordReason(kind, row)}</span>
                </span>
                {row.id === value && <Check size={14} />}
              </button>
            )
          })}
          {results.isPending && open && <p role="status">Đang tìm…</p>}
          {results.isLoadingError && (
            <p role="alert">
              {tournamentError(results.error)}{" "}
              <button type="button" className="underline" onClick={() => void results.refetch()}>
                Thử lại
              </button>
            </p>
          )}
          {results.isSuccess && !rows.length && <p>Không có hồ sơ phù hợp.</p>}
          <InfiniteScroll query={results} label="Đang tải thêm" />
        </div>
        <div className="tournament-picker-footer">
          <small>Gần đây trước. Gõ đúng tên để tìm hồ sơ cũ.</small>
          {value && (
            <button type="button" onClick={() => choose("", "")} aria-label={`Bỏ chọn ${label}`}>
              <X size={14} />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
