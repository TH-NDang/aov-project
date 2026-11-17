import type { Lane, ProfileMember } from "@aov/community-contracts"
import { LANE_LABELS, LANE_ORDER } from "@/features/esports/model/labels"

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()

const laneAliases: Record<string, Lane> = {
  "duong ta than": "TOP",
  "duong caesar": "TOP",
  "ta than": "TOP",
  caesar: "TOP",
  "top lane": "TOP",
  top: "TOP",
  slayer: "TOP",
  "di rung": "JUNGLE",
  rung: "JUNGLE",
  jungle: "JUNGLE",
  jungler: "JUNGLE",
  "duong giua": "MID",
  giua: "MID",
  mid: "MID",
  middle: "MID",
  "mid lane": "MID",
  "duong rong": "DRAGON",
  rong: "DRAGON",
  dragon: "DRAGON",
  "bottom lane": "DRAGON",
  adc: "DRAGON",
  "tro thu": "SUPPORT",
  support: "SUPPORT",
  roamer: "SUPPORT",
  roam: "SUPPORT",
}

export const rosterLaneLabels: Record<Lane, string> = Object.fromEntries(
  LANE_ORDER.map((lane) => [lane, LANE_LABELS[lane].name]),
) as Record<Lane, string>
const laneOrder: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
export type RosterGroup = "starting" | "substitute" | "staff" | "other" | "former"
export type RosterEntry = { member: ProfileMember; index: number }

export function rosterPosition(role: string) {
  const normalized = normalize(role)
  const primary = normalized.split(/\s*[·|]\s*/)[0]
  const lane = Object.hasOwn(laneAliases, primary) ? laneAliases[primary] : undefined
  const staff = /^(?:chuyen vien )?phan tich doi tuyen$|^(?:team )?analyst$/.test(primary)
    ? "analyst"
    : /^(?:huan luyen vien|hlv|coach|head coach|assistant coach)(?:\s|$)/.test(primary)
      ? "coach"
      : null
  return { lane, staff, captain: /(?:^|[\s·|])(?:doi truong|captain)(?:$|[\s·|])/.test(normalized) }
}

export function rosterGroup(member: ProfileMember): RosterGroup {
  const status = normalize(member.status || "")
  if (/^(?:da roi doi|da roi|cuu thanh vien|inactive|former)(?:\s|·|$)/.test(status)) return "former"
  if (rosterPosition(member.role).staff || /^ban huan luyen(?:\s|·|$)/.test(status)) return "staff"
  if (/^(?:du bi|substitute|sub)(?:\s|·|$)/.test(status)) return "substitute"
  if (/^(?:doi hinh chinh|chinh thuc|active|starter)(?:\s|·|$)/.test(status)) return "starting"
  return "other"
}

/** Sorting retains source indexes so edit/remove still target the original roster row. */
export function groupRoster(members: ProfileMember[]) {
  const groups: Record<RosterGroup, RosterEntry[]> = { starting: [], substitute: [], staff: [], other: [], former: [] }
  members.forEach((member, index) => groups[rosterGroup(member)].push({ member, index }))
  const rank = (entry: RosterEntry) => {
    const lane = rosterPosition(entry.member.role).lane
    return lane ? laneOrder.indexOf(lane) : laneOrder.length
  }
  for (const key of ["starting", "substitute", "other"] as const)
    groups[key].sort((a, b) => rank(a) - rank(b) || a.index - b.index)
  return groups
}
