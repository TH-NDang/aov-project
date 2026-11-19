/** A player an MVP picker offers before the search: someone who played, or a member of one of the two rosters. */
export type MvpCandidate = { id: string; name: string; photoUrl?: string | null }
export type MvpGroup = { key: string; title: string; players: MvpCandidate[] }

/**
 * The groups an MVP picker lists first, in the order given: each player appears once, in the first group that names
 * them (those who played the game come before the rosters), and a group left with nobody is dropped.
 */
export function mvpGroups(groups: readonly MvpGroup[]): MvpGroup[] {
  const listed = new Set<string>()
  return groups
    .map((group) => ({
      ...group,
      players: group.players.filter((player) => {
        if (!player.id || listed.has(player.id)) return false
        listed.add(player.id)
        return true
      }),
    }))
    .filter((group) => group.players.length > 0)
}

/** The name of a player the picker lists, for the question asked before an MVP is replaced. */
export const candidateName = (groups: readonly MvpGroup[], id: string | null | undefined) =>
  id ? groups.flatMap((group) => group.players).find((player) => player.id === id)?.name : undefined
