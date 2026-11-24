import type { TournamentAward, TournamentLink, TournamentPlacement } from "@aov/community-contracts"

/**
 * A name in the final table with the record it may link. The name stays readable either way, so a team or a player
 * without a record is still written down (spec 04, links between records).
 */
export type LinkedName = { id: string | null; name: string }

/** A record picked from the list: it is linked, and its own name is written. */
export const pickedName = (id: string, name: string): LinkedName => ({ id, name })

/** The link taken off: the name stays as written. */
export const unlinkedName = (current: LinkedName): LinkedName => ({ id: null, name: current.name })

/**
 * A name typed by hand. It keeps the link only while it still reads as the linked name: a different name is someone
 * the record does not stand for, so the old link goes. Names are no longer linked by matching what was typed.
 */
export const typedName = (current: LinkedName, text: string): LinkedName => ({
  id: current.id && text.trim() === current.name.trim() ? current.id : null,
  name: text,
})

export const placementTeam = (line: TournamentPlacement): LinkedName => ({
  id: line.teamId ?? null,
  name: line.teamName,
})

export const withPlacementTeam = (line: TournamentPlacement, team: LinkedName): TournamentPlacement => ({
  ...line,
  teamId: team.id,
  teamName: team.name,
})

export const awardRecipient = (award: TournamentAward): LinkedName => ({
  id: award.playerId ?? null,
  name: award.recipientName,
})

export const withAwardRecipient = (award: TournamentAward, recipient: LinkedName): TournamentAward => ({
  ...award,
  playerId: recipient.id,
  recipientName: recipient.name,
})

export const awardTeam = (award: TournamentAward): LinkedName => ({
  id: award.teamId ?? null,
  name: award.teamName ?? "",
})

export const withAwardTeam = (award: TournamentAward, team: LinkedName): TournamentAward => ({
  ...award,
  teamId: team.id,
  teamName: team.name || null,
})

/** One more recipient of the same award, right after the line it starts from. */
export const withNextRecipient = (awards: readonly TournamentAward[], index: number): TournamentAward[] => [
  ...awards.slice(0, index + 1),
  { title: awards[index]!.title, recipientName: "" },
  ...awards.slice(index + 1),
]

/**
 * The final table as it is saved: lines without their required text are left out and names are trimmed. A link
 * stays only beside the name it was made with, so an award whose team name was cleared loses its team too.
 */
export function finalTableToSave(
  placements: TournamentPlacement[],
  awards: TournamentAward[],
  links: TournamentLink[],
) {
  return {
    placements: placements
      .filter((line) => line.place.trim() && line.teamName.trim())
      .map((line) => ({
        ...line,
        place: line.place.trim(),
        teamName: line.teamName.trim(),
        teamId: line.teamId || null,
      })),
    awards: awards
      .filter((award) => award.title.trim() && award.recipientName.trim())
      .map((award) => {
        const teamName = award.teamName?.trim() || null
        return {
          ...award,
          title: award.title.trim(),
          recipientName: award.recipientName.trim(),
          playerId: award.playerId || null,
          teamName,
          teamId: teamName ? award.teamId || null : null,
        }
      }),
    links: links.filter((link) => link.label.trim() && link.url.trim()),
  }
}
