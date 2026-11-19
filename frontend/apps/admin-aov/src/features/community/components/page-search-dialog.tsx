import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Check, Plus, Search, X } from "lucide-react"
import { profileKindLabels, type CommunityProfile, type PersonRole, type ProfileKind } from "@aov/community-contracts"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { NativeSelect } from "@/components/native-select"
import { activityLabel } from "@/features/tournaments/model/record-reason"
import { pageApi, pageError, pageKeys } from "../api/page-api"
import { CreateProfileSheet } from "./create-profile-sheet"
import { ProfileTypeIcon } from "./profile-icons"

/**
 * Finds a profile page by name, most recently active first, with a quick create for someone who has no page yet.
 * `kinds` limits what it offers, the first shown first; without it every kind is offered. The caller keeps it mounted
 * and owns `open`, so a page created in the sheet comes back to the caller even though the dialog closed meanwhile.
 */
export function PageSearchDialog({
  open,
  onOpenChange,
  label,
  kinds,
  actorKey,
  canCreate,
  value,
  initialName = "",
  createRoles,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  kinds?: ProfileKind[]
  actorKey: string
  canCreate: boolean
  /** The page picked now; when set, the dialog also offers to take it off. */
  value?: string | null
  /** The name a quick create starts from when nothing was searched. */
  initialName?: string
  /** The roles a person created here starts with. */
  createRoles?: PersonRole[]
  onSelect: (profile: CommunityProfile | null) => void
}) {
  const [creating, setCreating] = useState<ProfileKind | null>(null)
  const [filter, setFilter] = useState<ProfileKind | "">(kinds?.[0] ?? "")
  const [search, setSearch] = useState("")
  const results = useInfiniteQuery({
    queryKey: pageKeys.referencePicker(actorKey, filter, search),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageApi.list(filter, search, pageParam),
    getNextPageParam: nextPageOf,
    enabled: open,
  })
  const profiles = results.data?.pages.flatMap((page) => page.items) ?? []
  const choices = kinds ?? (Object.keys(profileKindLabels) as ProfileKind[])
  const createKind = filter || "ORGANIZATION"
  const select = (profile: CommunityProfile | null) => {
    onSelect(profile)
    onOpenChange(false)
    setCreating(null)
  }
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
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
            {choices.length > 1 && (
              <NativeSelect
                aria-label="Loại hồ sơ tham chiếu"
                className="px-2"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as ProfileKind | "")
                }}
              >
                {!kinds && <option value="">Tất cả loại</option>}
                {choices.map((key) => (
                  <option key={key} value={key}>
                    {profileKindLabels[key]}
                  </option>
                ))}
              </NativeSelect>
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
                  onOpenChange(false)
                  setCreating(createKind)
                }}
              >
                <Plus className="size-4" />
                Tạo {profileKindLabels[createKind].toLowerCase()}
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
          initialName={search || initialName}
          initialRoles={creating === "PERSON" ? createRoles : undefined}
          submitLabel="Tạo và chọn hồ sơ"
          onClose={() => {
            setCreating(null)
            onOpenChange(true)
          }}
          onCreated={select}
        />
      )}
    </>
  )
}
