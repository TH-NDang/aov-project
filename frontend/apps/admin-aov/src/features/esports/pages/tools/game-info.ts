import type { Catalog, GameContent } from "@aov/community-contracts"
import type { GamePatchScope } from "@/features/tournaments/api/tournament-api"
import { mvpGroups, type MvpGroup } from "@/features/tournaments/model/mvp-model"
import type { GameView } from "../../model/game-view"
import type { RosterOption } from "../../model/line-up"

/** What the folded form of a game edits: how its catalog is read, where it sits in the match, and a note. */
export type GameInfo = Pick<
  GameContent,
  "region" | "seasonId" | "patchVariantId" | "includeUnscoped" | "number" | "note"
>

export const gameInfoOf = (content: GameContent): GameInfo => ({
  region: content.region,
  seasonId: content.seasonId ?? null,
  patchVariantId: content.patchVariantId ?? null,
  includeUnscoped: content.includeUnscoped ?? false,
  number: content.number,
  note: content.note ?? "",
})

/** Only the fields that differ, so a save never writes back a value somebody else changed meanwhile. */
export function changedGameInfo(before: GameInfo, after: GameInfo): Partial<GameInfo> {
  const keys = Object.keys(after) as (keyof GameInfo)[]
  return Object.fromEntries(keys.filter((key) => after[key] !== before[key]).map((key) => [key, after[key]]))
}

/** Who the MVP list offers first: the players seated in the game, then the rest of both rosters. */
export function gameMvpGroups(view: GameView | undefined, roster?: (teamId: string) => RosterOption[]): MvpGroup[] {
  if (!view) return []
  const sides = [view.sides.BLUE, view.sides.RED]
  return mvpGroups([
    {
      key: "seated",
      title: "Ra sân ván này",
      players: sides.flatMap((side) =>
        side.seats.flatMap((seat) =>
          seat.playerId ? [{ id: seat.playerId, name: seat.playerName, photoUrl: seat.photoUrl }] : [],
        ),
      ),
    },
    ...sides.map((side) => ({ key: side.team.id, title: side.team.name, players: roster?.(side.team.id) ?? [] })),
  ])
}

/** The season a game is read in, in one line, and whether the schedule or the game itself says so. */
export function gameInfoSummary(content: GameContent, scope?: GamePatchScope, catalog?: Catalog): string {
  const resolved = catalog?.resolvedContext
  const own = !!content.seasonId || !!content.patchVariantId
  const name = resolved?.seasonName ?? resolved?.patchTitle ?? scope?.lineName
  if (own) return name ? `${name}, riêng ván này` : "Mùa và patch riêng của ván"
  if (scope?.source === "STAGE") return name ? `${name}, theo lịch giải` : "Theo lịch giải"
  return name || "Chưa rõ mùa và patch"
}
