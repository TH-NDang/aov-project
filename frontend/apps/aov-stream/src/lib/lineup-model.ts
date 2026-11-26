import type { CompetitionView, Lane, ProfileMember } from "@aov/community-contracts"
import { LANES } from "./tournament-model.ts"

/** One player of a starting lineup, with the page or the player record the name opens. */
export type LineupSeat = { key: string; name: string; lane: Lane; captain: boolean; to: string | null }

const inLaneOrder = (seats: LineupSeat[]) => seats.sort((a, b) => LANES.indexOf(a.lane) - LANES.indexOf(b.lane))

/** A lineup is worth drawing from this many players on; fewer read better as rows. */
const DRAWN = 3

/** The starters of a team's own roster, lane by lane; null when too few of them have a lane. */
export function rosterLineup(roster: ProfileMember[]): LineupSeat[] | null {
  const seats = roster.flatMap((member, at): LineupSeat[] =>
    member.standing === "ACTIVE" && member.lane
      ? [
          {
            key: `${member.pageId ?? member.name}:${at}`,
            name: member.name,
            lane: member.lane,
            captain: !!member.captain,
            to: member.pageId ? `/pages/${member.pageId}` : null,
          },
        ]
      : [],
  )
  return seats.length >= DRAWN ? inLaneOrder(seats) : null
}

export type CompetitionLineup = { view: CompetitionView; seats: LineupSeat[] }

/** The starters a team registered in the newest of its competitions that lists them, lane by lane. */
export function competitionLineup(views: CompetitionView[], teamId: string): CompetitionLineup | null {
  for (const view of views) {
    const { rosters, players } = view.content
    const seats = rosters.flatMap((row): LineupSeat[] =>
      row.teamId === teamId && row.status === "ACTIVE" && row.lane
        ? [
            {
              key: row.playerId,
              name: players[row.playerId]?.nickname ?? "",
              lane: row.lane,
              captain: row.captain === true,
              to: `/players/${row.playerId}`,
            },
          ]
        : [],
    )
    if (seats.filter((seat) => seat.name).length >= DRAWN)
      return { view, seats: inLaneOrder(seats.filter((seat) => seat.name)) }
  }
  return null
}
