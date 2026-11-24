import { useState, type ComponentProps, type ReactNode } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  isIndividualProfile,
  type CommunityProfile,
  type ProfileContent,
  type ProfileKind,
} from "@aov/community-contracts"
import { ArrowUpRight, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { confirmDiscard } from "@/components/confirm-dialog"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { TeamRecordForm } from "@/features/tournaments/components/team-record-form"
import { pageApi, pageError, pageKeys } from "../api/page-api"
import { ProfileCountryPicker } from "../components/profile-country-picker"
import { Field } from "../components/profile-form-primitives"
import { ProfileImageField } from "../components/profile-image-field"
import { ProfilePersonRoles } from "../components/profile-person-roles"

type Guard = { setDirty: (dirty: boolean) => void; setBusy: (busy: boolean) => void; close: () => void }

/** The sheet around a form: it stays while the form saves and asks before dropping what was typed. */
function EntrySheet({
  title,
  pageId,
  onClose,
  children,
}: {
  title: string
  pageId?: string
  onClose: () => void
  children: (guard: Guard) => ReactNode
}) {
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  async function close() {
    if (busy) return
    if (
      dirty &&
      !(await confirmDiscard({
        title: "Hồ sơ còn thay đổi chưa lưu",
        description: "Lưu để giữ thay đổi trên máy chủ.",
      }))
    )
      return
    onClose()
  }
  return (
    <Sheet open onOpenChange={(open) => !open && void close()}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-xl"
        showCloseButton={!busy}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="pr-8">{title}</SheetTitle>
          <SheetDescription className="sr-only">Sửa thông tin cơ bản của hồ sơ</SheetDescription>
          {pageId && (
            <Link
              to={`/pages/${pageId}`}
              className="type-meta inline-flex w-fit items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
            >
              Mở hồ sơ đầy đủ
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        </SheetHeader>
        <div className="px-4 pb-6">{children({ setDirty, setBusy, close: () => void close() })}</div>
      </SheetContent>
    </Sheet>
  )
}

function LoadState({ error, message }: { error: boolean; message: string }) {
  return error ? (
    <p className="type-body text-destructive" role="alert">
      {message}
    </p>
  ) : (
    <p className="type-meta" role="status">
      Đang tải hồ sơ…
    </p>
  )
}

/** Edits the record of a team or a player, the one every tournament and match reads, in place in its directory. */
export function RecordEditSheet({
  kind,
  id,
  name,
  pageId,
  actorKey,
  onClose,
}: {
  kind: "teams" | "players"
  id: string
  name: string
  pageId?: string
  actorKey: string
  onClose: () => void
}) {
  const client = useQueryClient()
  const record = useQuery({
    queryKey: tournamentKeys.one(kind, actorKey, id),
    queryFn: ({ signal }) => tournamentApi.read(kind, id, signal),
  })
  return (
    <EntrySheet title={name} pageId={pageId} onClose={onClose}>
      {({ setDirty, setBusy, close }) =>
        record.data ? (
          <TeamRecordForm
            key={`${record.data.id}-${record.data.version}`}
            kind={kind}
            entry={record.data as ComponentProps<typeof TeamRecordForm>["entry"]}
            onSaved={() => {
              void client.invalidateQueries({ queryKey: pageKeys.all })
              toast.success("Đã lưu hồ sơ.")
              onClose()
            }}
            onCancel={close}
            onDirtyChange={setDirty}
            onBusyChange={setBusy}
          />
        ) : (
          <LoadState error={record.isError} message={tournamentError(record.error)} />
        )
      }
    </EntrySheet>
  )
}

const SUBJECTS = {
  ORGANIZATION: "organization",
  CIRCUIT: "circuit",
  PERSON: "person",
  TEAM: "team",
  PLAYER: "player",
} as const satisfies Record<ProfileKind, string>

/** Edits what a directory shows of an organization, a circuit or a person; the rest is edited on its page. */
export function ProfileEditSheet({
  page,
  actorKey,
  onClose,
}: {
  page: CommunityProfile
  actorKey: string
  onClose: () => void
}) {
  // The list may be older than the profile: the form starts from the version it will save over.
  const profile = useQuery({
    queryKey: pageKeys.page(actorKey, page.id),
    queryFn: () => pageApi.read(page.id),
    staleTime: 0,
    refetchOnMount: "always",
  })
  return (
    <EntrySheet title={page.content?.name ?? page.code} pageId={page.id} onClose={onClose}>
      {(guard) =>
        profile.data?.content && profile.isFetchedAfterMount ? (
          <ProfileForm
            key={profile.data.version}
            entry={profile.data}
            content={profile.data.content}
            guard={guard}
            onSaved={onClose}
          />
        ) : (
          <LoadState error={profile.isError} message={pageError(profile.error)} />
        )
      }
    </EntrySheet>
  )
}

function ProfileForm({
  entry,
  content,
  guard,
  onSaved,
}: {
  entry: CommunityProfile
  content: ProfileContent
  guard: Guard
  onSaved: () => void
}) {
  const client = useQueryClient()
  const [edited, setEdited] = useState(content)
  const [uploading, setUploading] = useState(false)
  const individual = isIndividualProfile(entry.kind)
  const save = useMutation({
    meta: { silent: true, successMessage: "Đã lưu hồ sơ." },
    mutationFn: () => pageApi.save(entry, edited),
    onMutate: () => guard.setBusy(true),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: pageKeys.all })
      onSaved()
    },
    onSettled: () => guard.setBusy(false),
  })
  const set = (patch: Partial<ProfileContent>) => {
    setEdited({ ...edited, ...patch })
    guard.setDirty(true)
  }
  const missingRole = entry.kind === "PERSON" && !edited.personRoles?.length
  const busy = save.isPending || uploading
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy && !missingRole) save.mutate()
      }}
    >
      <fieldset disabled={busy} className="grid min-w-0 gap-5">
        <ProfileImageField
          label={individual ? "Ảnh chân dung" : "Logo"}
          shape={individual ? "portrait" : "logo"}
          subject={SUBJECTS[entry.kind]}
          name={edited.name}
          value={edited.avatarUrl ?? ""}
          onChange={(avatarUrl) => set({ avatarUrl: avatarUrl || null })}
          onBusyChange={(value) => {
            setUploading(value)
            guard.setBusy(value)
          }}
        />
        <Field
          label="Tên hiển thị *"
          required
          maxLength={200}
          value={edited.name}
          onChange={(event) => set({ name: event.target.value })}
        />
        <Field
          label="Tên ngắn"
          maxLength={200}
          value={edited.shortName ?? ""}
          onChange={(event) => set({ shortName: event.target.value || null })}
        />
        <ProfileCountryPicker
          value={edited.country}
          disabled={busy}
          onChange={(country) => set({ country: country || null })}
        />
        {individual && (
          <ProfilePersonRoles
            value={edited.personRoles}
            onChange={(personRoles) => set({ personRoles })}
            disabled={busy}
            required
          />
        )}
      </fieldset>
      {save.isError && (
        <p role="alert" className="type-body text-destructive">
          {pageError(save.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || missingRole || edited === content}>
          <Save aria-hidden />
          {save.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={guard.close}>
          Hủy
        </Button>
      </div>
    </form>
  )
}
