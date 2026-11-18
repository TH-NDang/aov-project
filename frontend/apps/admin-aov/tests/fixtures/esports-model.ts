/** Shared records of the esports model tests: matches of one tournament and games with a ban/pick line-up. */
import type { SeriesContent } from "@aov/community-contracts"
import type { SeriesRecord } from "../../src/features/esports/model/competition"

/** A match of tournament "t" between two teams, scheduled on a September day taken from its id, with an optional score. */
export const series = (
  id: string,
  stage: string,
  teamAId: string,
  teamBId: string,
  score?: [number, number],
  bestOf = 5,
): SeriesRecord => ({
  id,
  content: {
    code: id,
    tournamentId: "t",
    stage,
    teamAId,
    teamBId,
    bestOf,
    scheduledAt: `2026-09-${String(10 + Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T10:00:00Z`,
    result: score ? { scoreA: score[0], scoreB: score[1], sourceUrl: "https://x", verification: "PRIMARY" } : null,
  } satisfies SeriesContent,
})

type DraftSide = { teamId: string; picks: (string | null)[]; bans?: string[] }

/** One game of series "s": each side's picks fill its lanes from the top, its bans the four ban slots. */
export const draftGame = (number: number, blue: DraftSide, red: DraftSide) => {
  const side = (code: "BLUE" | "RED", entry: DraftSide) => ({
    side: code,
    teamId: entry.teamId,
    bans: [0, 1, 2, 3].map((index) => ({ id: null, name: entry.bans?.[index] ?? null })),
    participants: (["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const).map((lane, index) => ({
      lane,
      hero: { id: null, name: entry.picks[index] ?? null },
      spell: { id: null, name: null },
      arcana: { status: "UNKNOWN" as const, entries: [] },
      enchantments: { status: "UNKNOWN" as const, entries: [] },
      equipmentSnapshots: [],
      equipmentEvents: [],
    })),
  })
  return {
    content: {
      seriesId: "s",
      number,
      region: "VN",
      locale: "vi-VN",
      sides: [side("BLUE", blue), side("RED", red)],
    },
  }
}
