import { ChartNoAxesCombined, ClipboardList, Headset, MessagesSquare, Mic, Presentation } from "lucide-react"
import type { ComponentType } from "react"
import { NAV_ICONS } from "@/app/aov-nav-icon"
import { isCoachingRole, type PersonRole, type PersonRoleFilter, type ProfileKind } from "@aov/community-contracts"

type ProfileIcon = ComponentType<{ className?: string }>

export const profileKindIcons: Record<ProfileKind, ProfileIcon> = {
  CIRCUIT: NAV_ICONS.circuits,
  ORGANIZATION: NAV_ICONS.organizations,
  TEAM: NAV_ICONS.teams,
  PLAYER: NAV_ICONS.players,
  PERSON: NAV_ICONS.profile,
}

export const profileRoleIcons: Record<PersonRoleFilter, ProfileIcon> = {
  COACHING: NAV_ICONS.coaches,
  BROADCAST: NAV_ICONS.broadcast,
  COACH: ClipboardList,
  TEAM_ANALYST: ChartNoAxesCombined,
  HOST: Mic,
  INTERVIEWER: MessagesSquare,
  CASTER: Headset,
  GUEST_ANALYST: Presentation,
}

export function ProfileRoleIcon({ role, className }: { role: PersonRoleFilter; className?: string }) {
  const Icon = profileRoleIcons[role]
  return <Icon aria-hidden="true" className={className} />
}

/** A multi-role profile uses the role matching the current directory filter. */
export function ProfileTypeIcon({
  kind,
  roles = [],
  filter,
  className,
}: {
  kind: ProfileKind
  roles?: PersonRole[]
  filter?: PersonRoleFilter
  className?: string
}) {
  const matchingRole = roles.find((role) =>
    filter === "COACHING" ? isCoachingRole(role) : filter === "BROADCAST" ? !isCoachingRole(role) : role === filter,
  )
  const role = matchingRole || (kind === "PERSON" ? roles[0] : undefined)
  const Icon = role ? profileRoleIcons[role] : profileKindIcons[kind]
  return <Icon aria-hidden="true" className={className} />
}
