import type { ComponentType } from "react"
import type { ProfileKind } from "@aov/community-contracts"
import { NAV_ICONS } from "@/app/aov-nav-icon"

export const profileKindIcons: Record<ProfileKind, ComponentType<{ className?: string }>> = {
  CIRCUIT: NAV_ICONS.circuits,
  ORGANIZATION: NAV_ICONS.organizations,
  TEAM: NAV_ICONS.teams,
  PLAYER: NAV_ICONS.players,
  PERSON: NAV_ICONS.profile,
}

export function ProfileTypeIcon({ kind, className }: { kind: ProfileKind; className?: string }) {
  const Icon = profileKindIcons[kind]
  return <Icon aria-hidden="true" className={className} />
}
