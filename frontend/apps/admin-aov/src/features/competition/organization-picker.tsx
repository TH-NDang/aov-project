import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Building2, Check, ExternalLink, Plus, Search } from "lucide-react"
import type { CommunityProfile } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { pageApi, pageError, pageKeys } from "@/features/community/page-api"
import { CreateProfileSheet } from "@/features/community/create-profile-sheet"

export function OrganizationPicker({
  value,
  actorKey,
  canWrite,
  onSelect,
}: {
  value?: string | null
  actorKey: string
  canWrite: boolean
  onSelect: (profile: CommunityProfile | null) => void
}) {
  const [choosing, setChoosing] = useState(!value)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const selected = useQuery({
    queryKey: [...pageKeys, actorKey, value],
    queryFn: () => pageApi.read(value!),
    enabled: !!value,
  })
  const results = useQuery({
    queryKey: [...pageKeys, actorKey, "organization-picker", search, page],
    queryFn: () => pageApi.list("ORGANIZATION", search, page),
    enabled: choosing,
  })
  const select = (profile: CommunityProfile) => {
    onSelect(profile)
    setChoosing(false)
    setCreating(false)
  }
  return (
    <div className="space-y-4">
      <p className="type-body text-muted-foreground">
        Dùng hồ sơ tổ chức chung cho các mùa giải. Tên và logo được lấy từ hồ sơ đã chọn.
      </p>
      {value &&
        (selected.isPending ? (
          <p className="type-body">Đang tải tổ chức…</p>
        ) : selected.isError ? (
          <div role="alert" className="space-y-2">
            <p className="type-body text-destructive">{pageError(selected.error)}</p>
            <Button variant="outline" onClick={() => void selected.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          selected.data && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-4">
              {selected.data.content?.avatarUrl ? (
                <img
                  src={selected.data.content.avatarUrl}
                  alt=""
                  className="size-12 rounded-lg border object-contain"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
                  <Building2 className="size-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="type-section-title">{selected.data.content?.name || selected.data.code}</p>
                <p className="type-meta mt-1">
                  /{selected.data.code} · {selected.data.published ? "Đã công bố" : "Hồ sơ nháp"}
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to={`/pages/${value}`} target="_blank" rel="noreferrer">
                  Mở hồ sơ <ExternalLink size={14} />
                </Link>
              </Button>
              {canWrite && (
                <Button variant="ghost" onClick={() => setChoosing(!choosing)}>
                  {choosing ? "Đóng lựa chọn" : "Đổi tổ chức"}
                </Button>
              )}
            </div>
          )
        ))}
      {selected.data && !selected.data.published && (
        <p className="type-meta">
          Bạn có thể hoàn thiện giải trước. Hồ sơ tổ chức cần được công bố trước khi công bố giải.
        </p>
      )}
      {choosing && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Tìm tổ chức"
                placeholder="Tìm theo tên tổ chức…"
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(0)
                }}
              />
            </div>
            {canWrite && (
              <Button variant="outline" onClick={() => setCreating(true)}>
                <Plus size={16} /> Tạo tổ chức
              </Button>
            )}
          </div>
          {results.isPending ? (
            <p className="type-body py-3">Đang tìm tổ chức…</p>
          ) : results.isError ? (
            <div role="alert">
              <p className="type-body text-destructive">{pageError(results.error)}</p>
              <Button variant="outline" onClick={() => void results.refetch()}>
                Thử lại
              </Button>
            </div>
          ) : !results.data.items.length ? (
            <p className="type-body py-3 text-muted-foreground">
              {search
                ? "Không tìm thấy tổ chức phù hợp. Bạn có thể tạo hồ sơ mới ngay tại đây."
                : "Chưa có tổ chức. Tạo hồ sơ đầu tiên để liên kết với giải này."}
            </p>
          ) : (
            <div className="max-h-64 divide-y overflow-y-auto">
              {results.data.items.map((profile) => (
                <button
                  type="button"
                  key={profile.id}
                  disabled={!canWrite}
                  onClick={() => select(profile)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-muted"
                >
                  <Building2 className="size-5 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="type-body block">{profile.content?.name || profile.code}</span>
                    <span className="type-meta">
                      /{profile.code} · {profile.published ? "Đã công bố" : "Bản nháp"}
                    </span>
                  </span>
                  {profile.id === value && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
          {results.data && results.data.totalElements > 24 && (
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
                Trước
              </Button>
              <span className="type-meta">Trang {page + 1}</span>
              <Button
                variant="outline"
                disabled={(page + 1) * 24 >= results.data.totalElements}
                onClick={() => setPage(page + 1)}
              >
                Tiếp
              </Button>
            </div>
          )}
          {value && canWrite && (
            <Button
              variant="ghost"
              onClick={() => {
                onSelect(null)
                setChoosing(true)
              }}
            >
              Bỏ liên kết tổ chức
            </Button>
          )}
        </div>
      )}
      {creating && (
        <CreateProfileSheet
          kind="ORGANIZATION"
          initialName={search}
          submitLabel="Tạo và chọn tổ chức"
          onClose={() => setCreating(false)}
          onCreated={select}
        />
      )}
    </div>
  )
}
