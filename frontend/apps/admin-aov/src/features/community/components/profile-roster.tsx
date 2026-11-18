import { useDeferredValue, useState } from "react"
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query"
import { CalendarDays, ClipboardList, Crown, Gamepad2, Plus, Search, UsersRound } from "lucide-react"
import { personRoleLabels, type CommunityProfile, type ProfileMember } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Checkbox } from "@aov/ui/components/checkbox"
import { Input } from "@aov/ui/components/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { useTournamentAccess } from "@/features/esports/data/use-esports-data"
import { pageApi, pageKeys } from "../api/page-api"
import { CreateProfileSheet } from "./create-profile-sheet"
import { Field, Section } from "./profile-form-primitives"
import { activityLabel } from "@/features/tournaments/model/record-reason"
import { RosterPositionField, RosterStandingFields } from "./profile-roster-codes"
import { choosePosition } from "../model/profile-roster-model"
import { ProfileRosterLineup, RosterAvatar as PersonAvatar } from "./profile-roster-lineup"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

export function ProfileRoster({
  value,
  pageId,
  onChange,
  disabled,
}: {
  value: ProfileMember[]
  /** The team page this roster belongs to: people who have worked with it come first when adding someone. */
  pageId?: string
  onChange: (value: ProfileMember[]) => void
  disabled?: boolean
}) {
  const access = useTournamentAccess()
  const ids = [...new Set(value.flatMap((row) => (row.pageId ? [row.pageId] : [])))]
  const profiles = useQueries({
    queries: ids.map((id) => ({
      queryKey: [...pageKeys, access.actorKey, id],
      queryFn: () => pageApi.read(id),
      staleTime: 60_000,
    })),
  })
  const [editing, setEditing] = useState<number | null>(null)
  return (
    <Section
      title="Đội hình & ban huấn luyện"
      icon={UsersRound}
      action={
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setEditing(value.length)}>
          <Plus className="size-4" />
          Thêm thành viên
        </Button>
      }
    >
      {!value.length && (
        <p className="type-body rounded-lg border border-dashed p-5 text-center text-muted-foreground">
          Chưa có thành viên. Thêm tuyển thủ hoặc ban huấn luyện để tạo đội hình.
        </p>
      )}
      {!!value.length && (
        <ProfileRosterLineup
          members={value}
          profiles={new Map(ids.map((id, i) => [id, profiles[i]?.data]))}
          disabled={disabled}
          onEdit={setEditing}
          onRemove={(index) => onChange(value.filter((_, i) => i !== index))}
        />
      )}
      {editing !== null && (
        <MemberSheet
          teamPageId={pageId}
          member={value[editing]}
          disabled={disabled}
          onClose={() => setEditing(null)}
          onApply={(member) => {
            onChange(
              editing === value.length ? [...value, member] : value.map((row, i) => (i === editing ? member : row)),
            )
            setEditing(null)
          }}
        />
      )}
    </Section>
  )
}

function MemberSheet({
  member,
  teamPageId,
  disabled,
  onClose,
  onApply,
}: {
  member?: ProfileMember
  teamPageId?: string
  disabled?: boolean
  onClose: () => void
  onApply: (member: ProfileMember) => void
}) {
  const [draft, setDraft] = useState<ProfileMember>(
    member || { name: "", role: "", standing: "ACTIVE", status: "Chính thức" },
  )
  const [choosing, setChoosing] = useState(!member?.pageId)
  const [group, setGroup] = useState<"PLAYER" | "COACHING">("PLAYER")
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const access = useTournamentAccess()
  const selected = useQuery({
    queryKey: [...pageKeys, access.actorKey, draft.pageId],
    queryFn: () => pageApi.read(draft.pageId!),
    enabled: !!draft.pageId,
  })
  const choose = (profile: CommunityProfile) => {
    setDraft((old) => {
      const chosen = { ...old, pageId: profile.id, name: profile.content?.name || profile.code }
      const roles = profile.content?.personRoles ?? []
      if (old.role || profile.kind === "PLAYER") return chosen
      if (roles.includes("COACH")) return choosePosition(chosen, "COACH")
      return roles.includes("TEAM_ANALYST") ? choosePosition(chosen, "ANALYST") : chosen
    })
    setChoosing(false)
  }
  const set = (key: keyof ProfileMember, value: string) =>
    setDraft({ ...draft, [key]: key === "name" || key === "role" ? value : value || null })
  if (creating)
    return (
      <CreateProfileSheet
        kind={group === "PLAYER" ? "PLAYER" : "PERSON"}
        initialName={search}
        initialRoles={group === "COACHING" ? ["COACH"] : []}
        submitLabel="Tạo và chọn hồ sơ"
        onClose={() => setCreating(false)}
        onCreated={(entry) => {
          choose(entry)
          setCreated(true)
        }}
      />
    )
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{member ? "Chỉnh sửa thành viên" : "Thêm thành viên"}</SheetTitle>
          <SheetDescription>Hồ sơ lưu thông tin cá nhân; đội tuyển lưu vị trí và thời gian tham gia.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {choosing ? (
            <>
              <div className="flex gap-2" role="group" aria-label="Loại thành viên">
                <Button
                  type="button"
                  size="sm"
                  variant={group === "PLAYER" ? "secondary" : "ghost"}
                  aria-pressed={group === "PLAYER"}
                  onClick={() => setGroup("PLAYER")}
                >
                  <Gamepad2 className="size-4" />
                  Tuyển thủ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={group === "COACHING" ? "secondary" : "ghost"}
                  aria-pressed={group === "COACHING"}
                  onClick={() => setGroup("COACHING")}
                >
                  <ClipboardList className="size-4" />
                  Ban huấn luyện
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  aria-label="Tìm thành viên"
                  placeholder="Tìm theo tên…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <PersonResults
                key={`${group}:${search}`}
                group={group}
                search={search}
                teamPageId={teamPageId}
                onSelect={choose}
                disabled={disabled}
              />
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                {group === "PLAYER" ? "Tạo tuyển thủ mới" : "Tạo nhân sự huấn luyện"}
              </Button>
              {draft.pageId && (
                <Button type="button" variant="ghost" onClick={() => setChoosing(false)}>
                  Giữ thành viên đã chọn
                </Button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <PersonAvatar profile={selected.data} name={draft.name} />
              <div className="min-w-0 flex-1">
                <p className="type-body break-words">{selected.data?.content?.name || draft.name}</p>
                <p className="type-meta">{selected.isError ? "Chưa tải được hồ sơ" : "Thông tin từ hồ sơ cá nhân"}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setChoosing(true)}>
                Đổi người
              </Button>
            </div>
          )}
          {created && (
            <p role="status" className="type-meta">
              Đã tạo hồ sơ riêng. Áp dụng rồi lưu nháp đội để hoàn tất liên kết.
            </p>
          )}
          {!choosing && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault()
                if (!disabled && draft.name.trim() && draft.role.trim())
                  onApply({ ...draft, name: selected.data?.content?.name || draft.name })
              }}
            >
              <fieldset disabled={disabled} className="space-y-4">
                <div className="grid items-start gap-4 sm:grid-cols-2">
                  <RosterPositionField member={draft} disabled={disabled} onChange={setDraft} />
                  <RosterStandingFields member={draft} disabled={disabled} onChange={setDraft} />
                </div>
                <label className="type-body flex w-fit items-center gap-2">
                  <Checkbox
                    checked={draft.captain === true}
                    onCheckedChange={(checked) => setDraft({ ...draft, captain: checked === true || null })}
                  />
                  <Crown className="size-4 text-(--aov-warning)" aria-hidden />
                  Đội trưởng
                </label>
                <details className="rounded-lg border p-3">
                  <summary className="type-body cursor-pointer">
                    <CalendarDays className="mr-2 inline size-4" />
                    Thời gian & nguồn{draft.startsOn || draft.endsOn || draft.sourceUrl ? " · Đã bổ sung" : ""}
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Ngày tham gia"
                        type="date"
                        value={draft.startsOn || ""}
                        onChange={(e) => set("startsOn", e.target.value)}
                      />
                      <Field
                        label="Ngày kết thúc"
                        type="date"
                        min={draft.startsOn || undefined}
                        value={draft.endsOn || ""}
                        onChange={(e) => set("endsOn", e.target.value)}
                      />
                    </div>
                    <Field
                      label="Nguồn đối chiếu"
                      type="url"
                      value={draft.sourceUrl || ""}
                      onChange={(e) => set("sourceUrl", e.target.value)}
                    />
                  </div>
                </details>
              </fieldset>
              <div className="flex gap-2">
                <Button type="submit" disabled={disabled}>
                  Áp dụng
                </Button>
                <Button type="button" variant="ghost" onClick={onClose}>
                  Hủy
                </Button>
              </div>
              <p className="type-meta">Thay đổi được ghi nhận sau khi bạn lưu nháp đội tuyển.</p>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PersonResults({
  group,
  search,
  teamPageId,
  onSelect,
  disabled,
}: {
  group: "PLAYER" | "COACHING"
  search: string
  teamPageId?: string
  onSelect: (profile: CommunityProfile) => void
  disabled?: boolean
}) {
  const deferred = useDeferredValue(search)
  const access = useTournamentAccess()
  const query = useInfiniteQuery({
    queryKey: [...pageKeys, access.actorKey, "roster-picker", group, deferred, teamPageId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      pageApi.list(
        group === "PLAYER" ? "PLAYER" : "",
        deferred,
        pageParam,
        group === "COACHING" ? "COACHING" : undefined,
        teamPageId,
      ),
    getNextPageParam: nextPageOf,
  })
  const profiles = query.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <div className="space-y-2">
      {query.isPending && (
        <p role="status" className="type-meta">
          Đang tìm hồ sơ…
        </p>
      )}
      {query.isLoadingError && (
        <div role="alert" className="type-body text-destructive">
          Chưa tải được danh sách.{" "}
          <Button type="button" variant="ghost" size="sm" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      )}
      {query.data && !profiles.length && <p className="type-meta py-3">Không tìm thấy hồ sơ phù hợp.</p>}
      <div className="max-h-72 overflow-y-auto rounded-lg border empty:hidden">
        {profiles.map((profile) => (
          <button
            type="button"
            key={profile.id}
            disabled={disabled}
            className="flex w-full items-center gap-3 border-b p-3 text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
            onClick={() => onSelect(profile)}
          >
            <PersonAvatar profile={profile} />
            <span className="min-w-0">
              <span className="type-body block break-words">{profile.content?.name || profile.code}</span>
              <span className="type-meta block">
                {profile.kind === "PLAYER"
                  ? "Tuyển thủ"
                  : profile.content?.personRoles?.map((role) => personRoleLabels[role]).join(" · ")}
              </span>
              <span className="type-meta block">
                {profile.related && "Từng ở đội này · "}
                {activityLabel(profile.lastActiveOn)}
              </span>
            </span>
          </button>
        ))}
        <InfiniteScroll query={query} label="Đang tải thêm hồ sơ" />
      </div>
    </div>
  )
}
