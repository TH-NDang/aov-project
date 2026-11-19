import type { ProfileMember, RosterStanding } from "@aov/community-contracts"
import { LANE_NAMES } from "../../../lib/tournament-model.ts"

/** The order a team's groups are shown in; members without a standing come last. */
const STANDING_ORDER: (RosterStanding | null)[] = ["ACTIVE", "SUBSTITUTE", "STAFF", "LEFT", null]

/** Each standing in Vietnamese and in English, as the heading of its group. */
export const STANDING_NAMES: Record<RosterStanding, readonly [vi: string, en: string]> = {
  ACTIVE: ["Đội hình chính", "Starting lineup"],
  SUBSTITUTE: ["Dự bị", "Substitutes"],
  STAFF: ["Ban huấn luyện", "Staff"],
  LEFT: ["Đã rời đội", "Former members"],
}

/** Each standing in Vietnamese and in English, said of one member. */
export const STANDING_WORDS: Record<RosterStanding, readonly [vi: string, en: string]> = {
  ACTIVE: ["Chính thức", "Starter"],
  SUBSTITUTE: ["Dự bị", "Substitute"],
  STAFF: ["Ban huấn luyện", "Staff"],
  LEFT: ["Đã rời đội", "Left the team"],
}

/** One member as a group lists it: `note` is the status without its standing and the shared season. */
export type RosterRow = { member: ProfileMember; note: string; bench: boolean }
export type RosterGroup = { standing: RosterStanding | null; rows: RosterRow[] }

/**
 * A team's members grouped by their standing code. A status reads "standing · note · season" and a role "lane · note":
 * for a member with a code, the first part is that code's wording, which the reader's language replaces; a season every
 * member shares is returned once instead of on each row.
 */
export function rosterGroups(roster: ProfileMember[]): { season: string | null; groups: RosterGroup[] } {
  const parts = roster.map((member) => (member.status || "").split(" · ").filter(Boolean))
  const last = parts[0]?.at(-1)
  const season = last && parts.every((entry) => entry.length > 1 && entry.at(-1) === last) ? last : null
  const rows = roster.map((member, index): RosterRow => {
    const own = season ? parts[index]!.slice(0, -1) : parts[index]!
    const note = (member.standing ? own.slice(1) : own).join(" · ")
    return { member, note, bench: member.standing === "SUBSTITUTE" || member.standing === "LEFT" }
  })
  const groups = STANDING_ORDER.map((standing) => ({
    standing,
    rows: rows.filter((row) => (row.member.standing ?? null) === standing),
  })).filter((group) => group.rows.length)
  return { season, groups }
}

/** The captain's mark in Vietnamese and in English. */
export const CAPTAIN_WORDS = ["Đội trưởng", "Captain"] as const

/**
 * A member's role, standing and captaincy in the reader's words. A coded lane is the role, worded by its code; the
 * standing's code words the first part of the status and the notes after it stay as written; `captain` is empty for a
 * member who is not one.
 */
export function memberWords(member: ProfileMember, text: (vi: string, en: string) => string) {
  const role = member.lane ? text(LANE_NAMES[member.lane][0], LANE_NAMES[member.lane][1]) : member.role
  const notes = (member.status || "").split(" · ").filter(Boolean)
  const standing = member.standing
    ? [text(...STANDING_WORDS[member.standing]), ...notes.slice(1)].join(" · ")
    : notes.join(" · ")
  return { role, standing, captain: member.captain ? text(...CAPTAIN_WORDS) : "" }
}
