import { useState, type ReactNode } from "react"
import { Link } from "react-router"
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  Crown,
  ExternalLink,
  History,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react"
import type { CommunityProfile, ProfileMember } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { cn } from "@aov/ui/lib/utils"
import { LaneIcon } from "@/features/esports/components/primitives"
import { ProfileIconButton } from "./profile-form-primitives"
import { groupRoster, rosterLaneLabels, rosterPosition, type RosterEntry } from "./profile-roster-model"

export function RosterRoleIcon({ role, size = 20 }: { role: string; size?: number }) {
  const { lane, staff } = rosterPosition(role)
  if (lane) return <LaneIcon lane={lane} size={size} />
  const Icon = staff === "analyst" ? ChartNoAxesCombined : staff === "coach" ? ClipboardList : UserRound
  return <Icon aria-hidden="true" size={size} className="shrink-0" />
}

export function RosterAvatar({
  profile,
  name = "",
  featured,
}: {
  profile?: CommunityProfile
  name?: string
  featured?: boolean
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const url = profile?.content?.avatarUrl
  const displayName = profile?.content?.name || name
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground",
        featured ? "size-12" : "size-9",
      )}
    >
      {url && url !== failed ? (
        <img src={url} alt="" className="size-full object-cover" onError={() => setFailed(url)} />
      ) : (
        <span aria-hidden="true" className="type-section-title">
          {displayName.slice(0, 2).toUpperCase() || <UserRound className="size-5" />}
        </span>
      )}
    </span>
  )
}

type LineupProps = {
  members: ProfileMember[]
  profiles: Map<string, CommunityProfile | undefined>
  disabled?: boolean
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}

function GroupTitle({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h3 className="type-label flex items-center gap-2 text-muted-foreground">
      {children}
      <span className="rounded-md bg-muted px-1.5 py-0.5 tabular-nums">{count}</span>
    </h3>
  )
}

export function ProfileRosterLineup(props: LineupProps) {
  const groups = groupRoster(props.members)
  return (
    <div className="space-y-5">
      {!!groups.starting.length && (
        <section aria-label="Đội hình chính" className="space-y-3">
          <GroupTitle count={groups.starting.length}>Đội hình chính</GroupTitle>
          <ul className="grid grid-cols-2 gap-2 @md/profile-fields:grid-cols-3 @xl/profile-fields:grid-cols-5">
            {groups.starting.map((entry) => (
              <Member key={entry.index} {...props} entry={entry} featured />
            ))}
          </ul>
        </section>
      )}
      {!!groups.substitute.length && (
        <section aria-label="Dự bị" className="space-y-3">
          <GroupTitle count={groups.substitute.length}>Dự bị</GroupTitle>
          <ul className="grid gap-2 @lg/profile-fields:grid-cols-2">
            {groups.substitute.map((entry) => (
              <Member key={entry.index} {...props} entry={entry} />
            ))}
          </ul>
        </section>
      )}
      {!!groups.staff.length && (
        <section aria-label="Ban huấn luyện" className="space-y-3">
          <GroupTitle count={groups.staff.length}>
            <ClipboardList className="size-4" />
            Ban huấn luyện
          </GroupTitle>
          <ul className="grid gap-2 @lg/profile-fields:grid-cols-2">
            {groups.staff.map((entry) => (
              <Member key={entry.index} {...props} entry={entry} />
            ))}
          </ul>
        </section>
      )}
      {!!groups.other.length && (
        <section aria-label="Thành viên khác" className="space-y-3">
          <GroupTitle count={groups.other.length}>
            <UsersRound className="size-4" />
            Thành viên khác
          </GroupTitle>
          <ul className="grid gap-2 @lg/profile-fields:grid-cols-2">
            {groups.other.map((entry) => (
              <Member key={entry.index} {...props} entry={entry} showStatus />
            ))}
          </ul>
        </section>
      )}
      {!!groups.former.length && (
        <details className="group/former border-t pt-4">
          <summary className="type-label flex cursor-pointer list-none items-center gap-2 text-muted-foreground [&::-webkit-details-marker]:hidden">
            <History className="size-4" />
            Đã rời đội<span className="rounded-md bg-muted px-1.5 py-0.5 tabular-nums">{groups.former.length}</span>
            <ChevronDown className="ml-auto size-4 transition-transform group-open/former:rotate-180" />
          </summary>
          <ul className="mt-3 grid gap-2 @lg/profile-fields:grid-cols-2">
            {groups.former.map((entry) => (
              <Member key={entry.index} {...props} entry={entry} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Member({
  entry: { member, index },
  profiles,
  disabled,
  onEdit,
  onRemove,
  featured,
  showStatus,
}: LineupProps & { entry: RosterEntry; featured?: boolean; showStatus?: boolean }) {
  const profile = profiles.get(member.pageId || "")
  const name = profile?.content?.name || member.name
  const position = rosterPosition(member.role)
  const roleLabel = position.lane ? rosterLaneLabels[position.lane] : member.role
  const nameLabel = (
    <span className="inline-flex min-w-0 items-center justify-center gap-1">
      {member.pageId ? (
        <Link
          to={`/pages/${member.pageId}`}
          aria-label={`Mở hồ sơ ${name}`}
          className="type-body break-words hover:underline"
        >
          {name}
        </Link>
      ) : (
        <span className="type-body break-words">{name}</span>
      )}
      {position.captain && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} aria-label="Đội trưởng" className="shrink-0 text-amber-600 dark:text-amber-400">
              <Crown className="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Đội trưởng</TooltipContent>
        </Tooltip>
      )}
    </span>
  )
  const actions = (
    <div className="flex shrink-0 items-center">
      <ProfileIconButton
        label={`Chỉnh sửa thành viên ${name}`}
        icon={Pencil}
        disabled={disabled}
        onClick={() => onEdit(index)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Thông tin và thao tác với ${name}`}
            title="Thông tin và thao tác"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="space-y-1 px-2 py-2">
            <p className="type-label">{name}</p>
            <p className="type-meta break-words">{member.role}</p>
            <p className="type-meta break-words">{member.status || "Chưa rõ trạng thái"}</p>
            {(member.startsOn || member.endsOn) && (
              <p className="type-meta">
                {member.startsOn || "Chưa rõ ngày"} → {member.endsOn || "Chưa ghi nhận kết thúc"}
              </p>
            )}
          </div>
          <DropdownMenuSeparator />
          {member.pageId && (
            <DropdownMenuItem asChild>
              <Link to={`/pages/${member.pageId}`}>
                <ArrowUpRight />
                Mở hồ sơ
              </Link>
            </DropdownMenuItem>
          )}
          {member.sourceUrl && (
            <DropdownMenuItem asChild>
              <a href={member.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                Nguồn đối chiếu
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => onRemove(index)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 />
            Gỡ khỏi đội hình
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
  return (
    <li
      className={cn(
        "min-w-0 rounded-xl border bg-background/50",
        featured ? "flex flex-col overflow-hidden" : "flex items-center gap-2.5 p-3",
      )}
    >
      {featured ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                tabIndex={0}
                className="flex items-center justify-center gap-2 border-b bg-muted/40 px-2 py-2 text-muted-foreground"
              >
                <RosterRoleIcon role={member.role} />
                <span className="type-meta truncate">
                  {position.lane === "MID" ? "Giữa" : position.lane === "DRAGON" ? "Rồng" : roleLabel}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{member.role}</TooltipContent>
          </Tooltip>
          <div className="flex flex-1 flex-col items-center gap-2 px-2 pb-1 pt-3">
            <RosterAvatar profile={profile} name={name} featured />
            {nameLabel}
            {!member.pageId && <span className="type-meta">Chưa liên kết</span>}
          </div>
          <div className="flex justify-center py-1">{actions}</div>
        </>
      ) : (
        <>
          <RosterAvatar profile={profile} name={name} />
          <div className="min-w-0 flex-1">
            {nameLabel}
            <p className="type-meta mt-0.5 flex items-center gap-1.5">
              <RosterRoleIcon role={member.role} size={16} />
              <span className="break-words">{roleLabel}</span>
            </p>
            {showStatus && <p className="type-meta mt-1 break-words">{member.status || "Chưa rõ trạng thái"}</p>}
          </div>
          {actions}
        </>
      )}
    </li>
  )
}
