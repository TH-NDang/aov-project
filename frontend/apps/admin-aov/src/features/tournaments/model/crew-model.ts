import {
  broadcastRoles,
  staffRoles,
  type BroadcastRole,
  type CrewMember,
  type StaffMember,
} from "@aov/community-contracts"

/** The limits the backend checks (spec 04, links between records). */
export const MAX_TOURNAMENT_CREW = 64
export const MAX_SERIES_CREW = 16
export const MAX_STAFF = 256
export const MAX_STAFF_TITLE = 100

/** One person in one role: the same person may hold two roles, but never the same one twice. */
const sameCrew = (a: CrewMember, b: CrewMember) => a.pageId === b.pageId && a.role === b.role
const sameStaff = (a: StaffMember, b: StaffMember) =>
  a.teamId === b.teamId && a.pageId === b.pageId && a.role === b.role

/** The crew as readers meet it: by role, in the order of the roles, each role in the order people were added. */
export function crewByRole(crew: readonly CrewMember[] = []): { role: BroadcastRole; members: CrewMember[] }[] {
  return broadcastRoles
    .map((role) => ({ role, members: crew.filter((member) => member.role === role) }))
    .filter((group) => group.members.length > 0)
}

/** The crew with a person added in a role; someone already listed in that role is not listed twice. */
export const withCrewMember = (crew: readonly CrewMember[], member: CrewMember): CrewMember[] =>
  crew.some((row) => sameCrew(row, member)) ? [...crew] : [...crew, member]

export const withoutCrewMember = (crew: readonly CrewMember[], member: CrewMember): CrewMember[] =>
  crew.filter((row) => !sameCrew(row, member))

/** One team's staff at a tournament, coaches first, each role in the order people were added. */
export function staffOfTeam(staff: readonly StaffMember[] = [], teamId: string): StaffMember[] {
  return staff
    .filter((line) => line.teamId === teamId)
    .sort((a, b) => staffRoles.indexOf(a.role) - staffRoles.indexOf(b.role))
}

export const withStaffMember = (lines: readonly StaffMember[], member: StaffMember): StaffMember[] =>
  lines.some((row) => sameStaff(row, member)) ? [...lines] : [...lines, member]

export const withoutStaffMember = (lines: readonly StaffMember[], member: StaffMember): StaffMember[] =>
  lines.filter((row) => !sameStaff(row, member))

/**
 * The tournament's staff after one team's lines were edited: that team's lines are replaced, with their titles
 * trimmed and an empty title left out, and every other team's lines stay as they were.
 */
export function withTeamStaff(
  staff: readonly StaffMember[] = [],
  teamId: string,
  lines: readonly StaffMember[],
): StaffMember[] {
  return [
    ...staff.filter((line) => line.teamId !== teamId),
    ...lines.map((line) => ({ teamId, pageId: line.pageId, role: line.role, title: line.title?.trim() || null })),
  ]
}
