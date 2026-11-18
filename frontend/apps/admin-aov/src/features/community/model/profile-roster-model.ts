import type { CommunityProfile, Lane, ProfileMember, RosterStanding } from "@aov/community-contracts"
import { LANE_LABELS, LANE_ORDER } from "@/features/esports/model/labels"
import { normalize } from "@/lib/text"

export const rosterLaneLabels: Record<Lane, string> = Object.fromEntries(
  LANE_ORDER.map((lane) => [lane, LANE_LABELS[lane].name]),
) as Record<Lane, string>
/** Admin's words for each standing, written as the first part of a member's status. */
export const rosterStandingLabels: Record<RosterStanding, string> = {
  ACTIVE: "Chính thức",
  SUBSTITUTE: "Dự bị",
  STAFF: "Ban huấn luyện",
  LEFT: "Đã rời đội",
}
/** The staff roles a roster offers, with the words written as the member's role. */
export const rosterStaffLabels = { COACH: "Huấn luyện viên", ANALYST: "Phân tích đội tuyển" } as const
export type RosterStaff = keyof typeof rosterStaffLabels

export type RosterGroup = "starting" | "substitute" | "staff" | "other" | "former"
export type RosterEntry = { member: ProfileMember; index: number }
type Codes = Pick<ProfileMember, "role" | "status" | "lane" | "standing">

const parts = (value?: string | null) => (value || "").split(" · ").filter(Boolean)

/**
 * A member's lane and staff kind from its codes; a staff member counts as an analyst only when its linked profile is
 * one and no coach. The captain's mark is still read from the role's words: no code holds it yet.
 */
export function rosterPosition(member: Codes, profile?: CommunityProfile) {
  const roles = profile?.content?.personRoles ?? []
  const staff =
    member.standing === "STAFF"
      ? roles.includes("TEAM_ANALYST") && !roles.includes("COACH")
        ? "analyst"
        : "coach"
      : null
  return {
    lane: member.lane ?? undefined,
    staff,
    captain: /(?:^|[\s·|])(?:doi truong|captain)(?:$|[\s·|])/.test(normalize(member.role)),
  } as const
}

const GROUPS: Record<RosterStanding, RosterGroup> = {
  ACTIVE: "starting",
  SUBSTITUTE: "substitute",
  STAFF: "staff",
  LEFT: "former",
}

export const rosterGroup = (member: Codes): RosterGroup => (member.standing ? GROUPS[member.standing] : "other")

/** Sorting retains source indexes so edit/remove still target the original roster row. */
export function groupRoster(members: ProfileMember[]) {
  const groups: Record<RosterGroup, RosterEntry[]> = { starting: [], substitute: [], staff: [], other: [], former: [] }
  members.forEach((member, index) => groups[rosterGroup(member)].push({ member, index }))
  const rank = (entry: RosterEntry) => (entry.member.lane ? LANE_ORDER.indexOf(entry.member.lane) : LANE_ORDER.length)
  for (const key of ["starting", "substitute", "other"] as const)
    groups[key].sort((a, b) => rank(a) - rank(b) || a.index - b.index)
  return groups
}

/** What the position picker shows: a lane, a staff role, nothing yet, or wording of the editor's own. */
export type PositionChoice = Lane | RosterStaff | "" | "CUSTOM"

export function positionChoice(member: Codes): PositionChoice {
  const first = parts(member.role)[0] ?? ""
  if (!member.role.trim()) return ""
  if (member.lane && first === rosterLaneLabels[member.lane]) return member.lane
  if (member.standing === "STAFF" && !member.lane) {
    const staff = (Object.keys(rosterStaffLabels) as RosterStaff[]).find(
      (key) => rosterStaffLabels[key] === member.role,
    )
    if (staff) return staff
  }
  return "CUSTOM"
}

/**
 * The codes and wording a pick writes. A lane keeps the notes after the role's first part (a captain's mark) and
 * moves a staff member back to the lineup; a staff role clears the lane and makes the member staff.
 */
export function choosePosition<T extends Codes>(member: T, choice: Exclude<PositionChoice, "" | "CUSTOM">): T {
  if (choice in rosterStaffLabels)
    return { ...member, lane: null, role: rosterStaffLabels[choice as RosterStaff], standing: "STAFF" }
  const lane = choice as Lane
  const notes = positionChoice(member) === "CUSTOM" ? [] : parts(member.role).slice(1)
  return {
    ...member,
    lane,
    role: [rosterLaneLabels[lane], ...notes].join(" · "),
    standing: member.standing === "STAFF" ? "ACTIVE" : member.standing,
  }
}

/** The status's own words: everything after the standing's wording, or all of it for a member without a standing. */
export const statusNote = (member: Codes) =>
  (member.standing ? parts(member.status).slice(1) : parts(member.status)).join(" · ")

const statusOf = (standing: RosterStanding | null | undefined, note: string) =>
  [standing ? rosterStandingLabels[standing] : "", note].filter((part) => part.trim()).join(" · ") || null

/** A standing picked for a member: its wording leads the status, the notes stay; a staff member plays no lane. */
export function chooseStanding<T extends Codes>(member: T, standing: RosterStanding | null): T {
  return {
    ...member,
    standing,
    status: statusOf(standing, statusNote(member)),
    lane: standing === "STAFF" ? null : member.lane,
  }
}

/** New notes after the standing's wording. */
export const writeStatusNote = <T extends Codes>(member: T, note: string): T => ({
  ...member,
  status: statusOf(member.standing, note),
})
