import type { DocumentView, GameContent } from "@aov/community-contracts"
import { tournamentError, tournamentIssueFields, type tournamentApi } from "@/features/tournaments/api/tournament-api"

export type PublishResult =
  | { number: number; ok: true; entry: DocumentView<GameContent> }
  | { number: number; ok: false; message: string; fields: string[] }

/**
 * Publishes games one after another at the version the editor saw. A game the service refuses, for instance because
 * somebody changed it meanwhile, is reported and does not stop the others.
 */
export async function publishGames(
  api: Pick<typeof tournamentApi, "publish">,
  games: readonly DocumentView<GameContent>[],
  onResult: (result: PublishResult) => void = () => {},
): Promise<PublishResult[]> {
  const results: PublishResult[] = []
  for (const game of games) {
    const { number } = game.content
    let result: PublishResult
    try {
      result = { number, ok: true, entry: await api.publish(game) }
    } catch (error) {
      result = { number, ok: false, message: tournamentError(error), fields: tournamentIssueFields(error) }
    }
    results.push(result)
    onResult(result)
  }
  return results
}
