/** A finished competition as community-service publishes it, shared by the competition page tests. */
import type {
  CompetitionStage,
  CompetitionView,
  PlannedMatch,
  RosterMembershipContent,
  TournamentAward,
} from "@aov/community-contracts"

const stage = (
  code: string,
  name: string,
  format: string,
  change: Partial<CompetitionStage> = {},
): CompetitionStage => ({
  code,
  name,
  format,
  bestOf: 3,
  legs: 1,
  winPoints: 1,
  lossPoints: 0,
  advance: 0,
  tieBreakers: [],
  sourceUrl: "",
  patchNote: "",
  ...change,
})

const match = (key: string, stageCode: string, round: number, a: string, b: string, scheduledAt: string) =>
  ({
    key,
    stageCode,
    round,
    bestOf: 3,
    scheduledAt,
    a: { type: "TEAM", teamId: a },
    b: { type: "TEAM", teamId: b },
  }) satisfies PlannedMatch

const roster = (teamId: string, playerId: string, lane: RosterMembershipContent["lane"], status = "ACTIVE") =>
  ({ tournamentId: "aog", teamId, playerId, lane, status }) as RosterMembershipContent

const award = (title: string, recipientName: string): TournamentAward => ({ title, recipientName })

/** AOG Winter: three teams, a round robin of three matches and a final, won by Saigon Phantom 4–2. */
export function finishedCompetition(): CompetitionView {
  return {
    id: "aog",
    version: 2,
    publishedAt: "2026-11-12T08:00:00Z",
    content: {
      circuit: null,
      organizer: null,
      tournament: {
        code: "aog-winter",
        name: "AOG Winter 2026",
        region: "VN",
        tier: "S",
        competitionType: "LEAGUE",
        venueMode: "OFFLINE",
        startsOn: "2026-10-01",
        endsOn: "2026-11-10",
        status: "FINISHED",
        result: {
          winnerName: "Saigon Phantom",
          runnerUpName: "Hanoi Kings",
          winnerScore: 4,
          runnerUpScore: 2,
          sourceUrl: "",
          verification: "PRIMARY",
        },
        awards: [
          award("Final MVP", "Lai"),
          award("Best laner", "Mot"),
          award("Rookie", "Hai"),
          award("Week 1 MVP", "Ba"),
          award("Week 1 MVP", "Bon"),
          award("Week 2 MVP", "Nam"),
          award("Fair play", "Sau"),
        ],
        links: [{ label: "Official site", url: "https://aog.example.test" }],
      },
      plan: {
        circuit: "AOG",
        organizer: "Garena",
        timezone: "Asia/Ho_Chi_Minh",
        prizePool: "",
        currency: "VND",
        sourceUrl: "https://source.example.test",
        notes: "",
        venues: [{ name: "Studio One", city: "Ho Chi Minh City", stageCode: "GROUP" }],
        entrants: [
          { teamId: "team-sgp", status: "ACTIVE", note: "" },
          { teamId: "team-hnk", status: "ACTIVE", note: "" },
          { teamId: "team-dnk", status: "WITHDRAWN", note: "" },
        ],
        stages: [
          stage("GROUP", "Group stage", "ROUND_ROBIN", {
            legs: 2,
            advance: 2,
            tieBreakers: ["GAME_DIFF", "HEAD_TO_HEAD"],
          }),
          stage("FINAL", "Grand final", "SINGLE_ELIMINATION", { bestOf: 7 }),
        ],
        playoffSeeds: {},
        matches: [
          match("G1", "GROUP", 1, "team-sgp", "team-hnk", "2026-10-02T11:00:00Z"),
          match("G2", "GROUP", 2, "team-hnk", "team-dnk", "2026-10-09T11:00:00Z"),
          match("G3", "GROUP", 3, "team-dnk", "team-sgp", "2026-10-16T11:00:00Z"),
          { ...match("F1", "FINAL", 1, "team-sgp", "team-hnk", "2026-11-10T11:00:00Z"), bestOf: 7 },
        ],
      },
      teams: {
        "team-sgp": { code: "sgp", name: "Saigon Phantom", shortName: "SGP" },
        "team-hnk": { code: "hnk", name: "Hanoi Kings", shortName: "HNK" },
        "team-dnk": { code: "dnk", name: "Da Nang Knights", shortName: "DNK" },
      },
      players: {
        "p-top": { code: "top", nickname: "Lai" },
        "p-mid": { code: "mid", nickname: "Mot" },
        "p-sub": { code: "sub", nickname: "Hai" },
        "p-hnk": { code: "hnk-mid", nickname: "Ba" },
      },
      series: {},
      rosters: [
        roster("team-sgp", "p-sub", "MID", "SUBSTITUTE"),
        roster("team-sgp", "p-mid", "MID"),
        roster("team-sgp", "p-top", "TOP"),
        roster("team-hnk", "p-hnk", "MID"),
      ],
      resolved: [
        { key: "G1", teamAId: "team-sgp", teamBId: "team-hnk", scoreA: 2, scoreB: 1, consistent: true },
        { key: "G2", teamAId: "team-hnk", teamBId: "team-dnk", scoreA: 2, scoreB: 0, consistent: true },
        { key: "G3", teamAId: "team-dnk", teamBId: "team-sgp", scoreA: 0, scoreB: 2, consistent: true },
        { key: "F1", teamAId: "team-sgp", teamBId: "team-hnk", scoreA: 4, scoreB: 2, consistent: true },
      ],
      standings: [
        {
          stageCode: "GROUP",
          complete: true,
          rows: [
            standing(1, "team-sgp", 2, 0, 4, 1, true),
            standing(2, "team-hnk", 1, 1, 3, 2, true),
            standing(3, "team-dnk", 0, 2, 0, 4, false),
          ],
        },
      ],
    },
  }
}

function standing(
  rank: number,
  teamId: string,
  won: number,
  lost: number,
  wins: number,
  losses: number,
  qualified: boolean,
) {
  return {
    rank,
    teamId,
    played: won + lost,
    won,
    lost,
    gameWins: wins,
    gameLosses: losses,
    points: won,
    tied: false,
    qualified,
  }
}

/** The same competition before its organizer published any match or table. */
export function announcedCompetition(): CompetitionView {
  const view = finishedCompetition()
  return {
    ...view,
    content: {
      ...view.content,
      tournament: { ...view.content.tournament, status: "ANNOUNCED", result: null, awards: [] },
      plan: { ...view.content.plan, matches: [], stages: [] },
      resolved: [],
      standings: [],
    },
  }
}
