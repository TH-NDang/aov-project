import { useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Check, Link2, Pencil, Plus, Search, X } from "lucide-react"
import { profileKindLabels, type CommunityProfile, type ProfileKind } from "@aov/community-contracts"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { CreateProfileSheet } from "./create-profile-sheet"
import { pageApi, pageError, pageKeys } from "../api/page-api"
import { PageReference } from "./page-reference"
import { ProfileTypeIcon } from "./profile-icons"
import { activityLabel } from "@/features/tournaments/model/record-reason"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

export function PageReferencePicker({
  value,
  kind,
  label,
  actorKey,
  canWrite,
  canCreate = canWrite,
  fallbackName = "",
  onSelect,
}: {
  value?: string | null
  kind?: ProfileKind
  label: string
  actorKey: string
  canWrite: boolean
  canCreate?: boolean
  fallbackName?: string
  onSelect: (profile: CommunityProfile | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState<ProfileKind | null>(null)
  const [filter, setFilter] = useState<ProfileKind | "">(kind || "")
  const [search, setSearch] = useState("")
  const selected = useQuery({
    queryKey: [...pageKeys, actorKey, value],
    queryFn: () => pageApi.read(value!),
    enabled: !!value,
  })
  const results = useInfiniteQuery({
    queryKey: [...pageKeys, actorKey, "reference-picker", kind || filter, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageApi.list(kind || filter, search, pageParam),
    getNextPageParam: nextPageOf,
    enabled: open && canWrite,
  })
  const profiles = results.data?.pages.flatMap((page) => page.items) ?? []
  const select = (profile: CommunityProfile | null) => {
    if (!canWrite) return
    onSelect(profile)
    setOpen(false)
    setCreating(null)
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Avatar className="size-10 shrink-0 rounded-lg border bg-background">
          <AvatarImage src={selected.data?.content?.avatarUrl || undefined} alt="" className="object-contain" />
          <AvatarFallback className="rounded-lg">
            {kind ? <ProfileTypeIcon kind={kind} className="size-5" /> : <Link2 className="size-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="type-meta mb-1">{label}</p>
          {value ? (
            <PageReference id={value} label={selected.data?.content?.name || fallbackName || label} />
          ) : (
            <p className="type-body">{fallbackName || "Chưa liên kết hồ sơ"}</p>
          )}
          {!value && fallbackName && <p className="type-meta mt-1">Chưa liên kết hồ sơ</p>}
        </div>
        {canWrite && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Chọn tham chiếu: ${label}`}
            title={`Chọn ${label.toLowerCase()}`}
            onClick={() => setOpen(true)}
          >
            {value ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          </Button>
        )}
      </div>
      {selected.isError && value && (
        <p role="alert" className="type-meta text-destructive">
          Chưa tải được tham chiếu. Bạn có thể chọn lại hồ sơ.
        </p>
      )}
      {selected.data && !selected.data.published && (
        <p className="type-meta">Hồ sơ nháp · chỉ hiển thị công khai sau khi được xuất bản.</p>
      )}
      <Dialog open={open && canWrite} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Chọn {label.toLowerCase()}</DialogTitle>
            <DialogDescription>Liên kết hồ sơ để xem giới thiệu và dùng lại ở những nơi khác.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                aria-label={`Tìm ${label.toLowerCase()}`}
                placeholder="Tìm theo tên hồ sơ…"
                value={search}
                className="pl-9"
                onChange={(event) => {
                  setSearch(event.target.value)
                }}
              />
            </div>
            {!kind && (
              <select
                aria-label="Loại hồ sơ tham chiếu"
                className="rounded-md border bg-background px-2 text-sm"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as ProfileKind | "")
                }}
              >
                <option value="">Tất cả loại</option>
                {Object.entries(profileKindLabels).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {results.isPending ? (
            <p role="status" className="type-body">
              Đang tìm hồ sơ…
            </p>
          ) : results.isLoadingError ? (
            <div role="alert" className="space-y-2">
              <p className="type-body text-destructive">{pageError(results.error)}</p>
              <Button variant="outline" onClick={() => void results.refetch()}>
                Thử lại
              </Button>
            </div>
          ) : !profiles.length ? (
            <p className="type-body py-4 text-muted-foreground">Chưa có hồ sơ phù hợp.</p>
          ) : (
            <div className="max-h-72 divide-y overflow-y-auto">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => select(profile)}
                  className="flex w-full items-center gap-3 rounded-md p-3 text-left hover:bg-muted"
                >
                  <Avatar className="size-10 rounded-lg border">
                    <AvatarImage src={profile.content?.avatarUrl || undefined} alt="" className="object-contain" />
                    <AvatarFallback className="rounded-lg">
                      <ProfileTypeIcon kind={profile.kind} className="size-5" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="type-body block">{profile.content?.name || profile.code}</span>
                    <span className="type-meta block">
                      {profileKindLabels[profile.kind]} · {profile.published ? "Đã xuất bản" : "Bản nháp"}
                    </span>
                    {profile.lastActiveOn && (
                      <span className="type-meta block">{activityLabel(profile.lastActiveOn)}</span>
                    )}
                  </span>
                  {value === profile.id && <Check className="size-4" />}
                </button>
              ))}
              <InfiniteScroll query={results} label="Đang tải thêm hồ sơ" />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            {canCreate && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  setCreating(kind || filter || "ORGANIZATION")
                }}
              >
                <Plus className="size-4" />
                Tạo {profileKindLabels[kind || filter || "ORGANIZATION"].toLowerCase()}
              </Button>
            )}
            {value && (
              <Button type="button" variant="ghost" onClick={() => select(null)}>
                <X className="size-4" />
                Bỏ tham chiếu
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {creating && (
        <CreateProfileSheet
          kind={creating}
          initialName={search || fallbackName}
          submitLabel="Tạo và chọn hồ sơ"
          onClose={() => {
            setCreating(null)
            setOpen(true)
          }}
          onCreated={select}
        />
      )}
    </div>
  )
}
