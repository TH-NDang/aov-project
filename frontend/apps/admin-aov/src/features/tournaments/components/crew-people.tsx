import { useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { UserRoundPlus, X } from "lucide-react"
import {
  broadcastRoles,
  personRoleLabels,
  type BroadcastRole,
  type CompetitionPerson,
  type CrewMember,
} from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { pageApi, pageKeys } from "@/features/community/api/page-api"
import { PageReference } from "@/features/community/components/page-reference"
import { PageSearchDialog } from "@/features/community/components/page-search-dialog"
import { PlayerPhoto } from "@/features/esports/components/primitives"
import { crewByRole, withCrewMember, withoutCrewMember } from "../model/crew-model"

/** The people a tournament or match names, by page id, as its competition snapshot read them. */
export type KnownPeople = Record<string, CompetitionPerson> | undefined

/** A person's name and picture: from the snapshot when it has them, else from their page. */
function usePerson(pageId: string, known: CompetitionPerson | undefined, actorKey: string) {
  const page = useQuery({
    queryKey: pageKeys.page(actorKey, pageId),
    queryFn: () => pageApi.read(pageId),
    enabled: !known,
    staleTime: 60_000,
  })
  const name = known?.name ?? page.data?.content?.name ?? (page.isError ? "Hồ sơ không còn khả dụng" : "Đang tải…")
  return { name, avatarUrl: known?.avatarUrl ?? page.data?.content?.avatarUrl ?? undefined }
}

/** One person on a line: picture, name that opens their profile, what they did, then the line's own controls. */
export function PersonLine({
  pageId,
  known,
  actorKey,
  meta,
  children,
}: {
  pageId: string
  known?: CompetitionPerson
  actorKey: string
  meta?: ReactNode
  /** Controls at the end of the line, given the name the line shows. */
  children?: (name: string) => ReactNode
}) {
  const person = usePerson(pageId, known, actorKey)
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PlayerPhoto name={person.name} url={person.avatarUrl} size={32} />
      <span className="min-w-0 flex-1">
        <span className="type-body block truncate">
          <PageReference id={pageId} label={person.name} />
        </span>
        {meta && <span className="type-meta block truncate">{meta}</span>}
      </span>
      {children?.(person.name)}
    </div>
  )
}

/** A person as a small pill, for a line that lists several people next to each other. */
export function PersonChip({
  pageId,
  known,
  actorKey,
  meta,
}: {
  pageId: string
  known?: CompetitionPerson
  actorKey: string
  meta?: string
}) {
  const person = usePerson(pageId, known, actorKey)
  return (
    <span className="type-body inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5">
      <PlayerPhoto name={person.name} url={person.avatarUrl} size={20} />
      {person.name}
      {meta && <span className="type-meta">{meta}</span>}
    </span>
  )
}

/** The broadcast crew, read-only, grouped by role. */
export function CrewList({
  crew = [],
  people,
  actorKey,
  empty,
}: {
  crew?: CrewMember[]
  people: KnownPeople
  actorKey: string
  empty: string
}) {
  const groups = crewByRole(crew)
  if (!groups.length) return <p className="type-meta">{empty}</p>
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group.role} className="min-w-0 space-y-2">
          <dt className="type-label text-muted-foreground">{personRoleLabels[group.role]}</dt>
          {group.members.map((member) => (
            <dd key={member.pageId}>
              <PersonLine pageId={member.pageId} known={people?.[member.pageId]} actorKey={actorKey} />
            </dd>
          ))}
        </div>
      ))}
    </dl>
  )
}

/**
 * The crew while it is edited. A person is added in the role chosen beside the add button, found among people and
 * players or created on the spot; taking someone off asks first. Nothing is written until the caller saves.
 */
export function CrewEditor({
  value,
  onChange,
  people,
  actorKey,
  max,
  disabled,
}: {
  value: CrewMember[]
  onChange: (crew: CrewMember[]) => void
  people: KnownPeople
  actorKey: string
  max: number
  disabled?: boolean
}) {
  const client = useQueryClient()
  const [role, setRole] = useState<BroadcastRole>("CASTER")
  const [picking, setPicking] = useState(false)
  const remove = async (member: CrewMember, name: string) => {
    const confirmed = await confirmAction({
      title: `Gỡ ${name} khỏi ê-kíp?`,
      description: `${name} · ${personRoleLabels[member.role]} → không còn trong ê-kíp khi bạn bấm Lưu.`,
      confirmLabel: "Gỡ khỏi ê-kíp",
    })
    if (confirmed) onChange(withoutCrewMember(value, member))
  }
  const full = value.length >= max
  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {crewByRole(value)
            .flatMap((group) => group.members)
            .map((member) => (
              <li key={`${member.pageId}-${member.role}`} className="px-3 py-2">
                <PersonLine
                  pageId={member.pageId}
                  known={people?.[member.pageId]}
                  actorKey={actorKey}
                  meta={personRoleLabels[member.role]}
                >
                  {(name) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Gỡ ${name} · ${personRoleLabels[member.role]}`}
                      disabled={disabled}
                      onClick={() => void remove(member, name)}
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </PersonLine>
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
          disabled={disabled}
          onChange={(event) => setRole(event.target.value as BroadcastRole)}
        >
          {broadcastRoles.map((code) => (
            <option key={code} value={code}>
              {personRoleLabels[code]}
            </option>
          ))}
        </NativeSelect>
        <Button type="button" variant="outline" disabled={disabled || full} onClick={() => setPicking(true)}>
          <UserRoundPlus aria-hidden /> Thêm người
        </Button>
        {full && <span className="type-meta">Đã đủ {max} người.</span>}
      </div>
      <PageSearchDialog
        open={picking}
        onOpenChange={setPicking}
        label="Người phát sóng"
        kinds={["PERSON", "PLAYER"]}
        actorKey={actorKey}
        canCreate
        createRoles={[role]}
        onSelect={(profile) => {
          if (!profile) return
          // The new line reads the person from the cache instead of asking the server again.
          client.setQueryData(pageKeys.page(actorKey, profile.id), profile)
          onChange(withCrewMember(value, { pageId: profile.id, role }))
        }}
      />
    </div>
  )
}
