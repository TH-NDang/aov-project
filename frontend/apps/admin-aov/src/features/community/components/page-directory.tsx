import { isCoachingRole, type PersonRole, type ProfileKind } from "@aov/community-contracts"
import { AccessGate } from "@/features/esports/pages/esports-shell"
import { CircuitDirectory, OrganizationDirectory } from "../directory/competition-page-directory"
import { directorySections, type PersonnelGroup } from "../directory/directory-shell"
import { BroadcastDirectory, CoachDirectory } from "../directory/personnel-directory"
import { PlayerDirectory } from "../directory/player-directory"
import { TeamDirectory } from "../directory/team-directory"

export const profileDirectoryPath = (kind: ProfileKind, roles: PersonRole[] = []) =>
  kind === "PERSON"
    ? roles.some(isCoachingRole)
      ? "/coaches"
      : "/broadcast"
    : directorySections.find((section) => section.kind === kind)!.path

/** Each kind of record has its own directory, showing what people look that kind up for. */
export function PageDirectory({ kind, group }: { kind: ProfileKind; group?: PersonnelGroup }) {
  return (
    <AccessGate>
      {(access) => {
        if (kind === "TEAM") return <TeamDirectory access={access} />
        if (kind === "PLAYER") return <PlayerDirectory access={access} />
        if (kind === "ORGANIZATION") return <OrganizationDirectory access={access} />
        if (kind === "CIRCUIT") return <CircuitDirectory access={access} />
        return group === "BROADCAST" ? <BroadcastDirectory access={access} /> : <CoachDirectory access={access} />
      }}
    </AccessGate>
  )
}
