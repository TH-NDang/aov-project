import { personnelGroupOf, type PersonRole, type ProfileKind } from "@aov/community-contracts"
import { AccessGate } from "@/features/esports/pages/esports-shell"
import { CircuitDirectory, OrganizationDirectory } from "../directory/competition-page-directory"
import { directorySections, type PersonnelGroup } from "../directory/directory-shell"
import { BroadcastDirectory, CoachDirectory, CreatorDirectory } from "../directory/personnel-directory"
import { PlayerDirectory } from "../directory/player-directory"
import { TeamDirectory } from "../directory/team-directory"

const PERSONNEL_PATHS = { COACHING: "/coaches", BROADCAST: "/broadcast", CREATOR: "/creators" } as const

/** A person with several roles opens in the first of coaching, broadcast and creators that holds one of them. */
export const profileDirectoryPath = (kind: ProfileKind, roles: PersonRole[] = []) => {
  if (kind !== "PERSON") return directorySections.find((section) => section.kind === kind)!.path
  const groups = new Set(roles.map(personnelGroupOf))
  const group = (["COACHING", "BROADCAST", "CREATOR"] as const).find((name) => groups.has(name)) ?? "BROADCAST"
  return PERSONNEL_PATHS[group]
}

/** Each kind of record has its own directory, showing what people look that kind up for. */
export function PageDirectory({ kind, group }: { kind: ProfileKind; group?: PersonnelGroup }) {
  return (
    <AccessGate>
      {(access) => {
        if (kind === "TEAM") return <TeamDirectory access={access} />
        if (kind === "PLAYER") return <PlayerDirectory access={access} />
        if (kind === "ORGANIZATION") return <OrganizationDirectory access={access} />
        if (kind === "CIRCUIT") return <CircuitDirectory access={access} />
        if (group === "CREATOR") return <CreatorDirectory access={access} />
        return group === "BROADCAST" ? <BroadcastDirectory access={access} /> : <CoachDirectory access={access} />
      }}
    </AccessGate>
  )
}
