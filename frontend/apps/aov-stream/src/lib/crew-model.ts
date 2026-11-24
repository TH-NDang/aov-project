import type {
  BroadcastRole,
  CompetitionPerson,
  CrewMember,
  PlayerContent,
  StaffMember,
  StaffRole,
  TeamContent,
  TournamentAward,
} from "@aov/community-contracts"

/** The people a competition snapshot names, by page id; snapshots taken before ADR-032 have none. */
export type People = Record<string, CompetitionPerson> | null | undefined

/** Someone a competition names, as a reader meets them, and the page their name opens. */
export type PersonEntry = { pageId: string; name: string; href: string }

/**
 * A person of the snapshot's `people`, or null when the snapshot does not name them. Their own page opens once it is
 * published; until then the page drawn from the competitions that name them does.
 */
export function personEntry(pageId: string, people: People): PersonEntry | null {
  const person = people?.[pageId]
  const name = person?.name.trim()
  if (!person || !name) return null
  const linked = person.published && !!person.code
  return {
    pageId,
    name,
    href: linked ? `/pages/${encodeURIComponent(person.code!)}` : `/people/${encodeURIComponent(pageId)}`,
  }
}

export type CrewGroup = { role: BroadcastRole; people: PersonEntry[] }

/**
 * A broadcast crew grouped by role in `order`, each person once per role and in the order the record lists them.
 * People the snapshot does not name are left out, and so is a role left without anyone. A role missing from `order`
 * follows the others, so a role added later is still shown.
 */
export function crewGroups(
  crew: readonly CrewMember[] | null | undefined,
  people: People,
  order: readonly BroadcastRole[],
): CrewGroup[] {
  const groups = new Map<BroadcastRole, PersonEntry[]>()
  for (const member of crew ?? []) {
    const entry = personEntry(member.pageId, people)
    if (!entry) continue
    const list = groups.get(member.role) ?? []
    if (!list.some((known) => known.pageId === entry.pageId)) list.push(entry)
    groups.set(member.role, list)
  }
  const rank = (role: BroadcastRole) => (order.includes(role) ? order.indexOf(role) : order.length)
  return [...groups].sort(([a], [b]) => rank(a) - rank(b)).map(([role, list]) => ({ role, people: list }))
}

export type StaffEntry = PersonEntry & { role: StaffRole; title: string | null }

/**
 * The staff of one team at a competition, by role in `order` and then as the record lists them. `title` is the
 * wording the record gives, such as an assistant coach's title, kept as written; null when it gives none. The same person in
 * the same role shows once, and people the snapshot does not name are left out.
 */
export function teamStaff(
  staff: readonly StaffMember[] | null | undefined,
  teamId: string,
  people: People,
  order: readonly StaffRole[],
): StaffEntry[] {
  const rows: StaffEntry[] = []
  for (const member of staff ?? []) {
    if (member.teamId !== teamId) continue
    if (rows.some((row) => row.pageId === member.pageId && row.role === member.role)) continue
    const entry = personEntry(member.pageId, people)
    if (entry) rows.push({ ...entry, role: member.role, title: member.title?.trim() || null })
  }
  const rank = (role: StaffRole) => (order.includes(role) ? order.indexOf(role) : order.length)
  return rows.sort((a, b) => rank(a.role) - rank(b.role))
}

/** A player a record names, with the nickname of the first snapshot that has them. */
export type NamedPlayer = { id: string; name: string }

/** The MVP a record names, read from the first of `sources` that knows the player; null without one. */
export function mvpOf(
  playerId: string | null | undefined,
  ...sources: (Record<string, PlayerContent> | null | undefined)[]
): NamedPlayer | null {
  if (!playerId) return null
  for (const players of sources) {
    const name = players?.[playerId]?.nickname?.trim()
    if (name) return { id: playerId, name }
  }
  return null
}

/**
 * The team an award names: the linked team's id when the award has one, with the name as the award writes it, or as
 * the competition names the linked team when the award writes none. Null when the award names no team.
 */
export function awardTeam(
  award: Pick<TournamentAward, "teamId" | "teamName">,
  teams: Record<string, TeamContent>,
): { id: string | null; name: string } | null {
  const id = award.teamId || null
  const name = award.teamName?.trim() || (id ? teams[id]?.name : undefined)
  return name ? { id, name } : null
}
