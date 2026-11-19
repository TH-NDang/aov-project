import type { LinkMention, LinkMentionKind } from "@aov/community-contracts"

/** The tabs of the links to review, in the order of the spec (spec 04, links to review). */
export const LINK_MENTION_KINDS: LinkMentionKind[] = [
  "GAME_MVP",
  "SERIES_MVP",
  "SERIES_BROADCAST",
  "AWARD_PLAYER",
  "AWARD_TEAM",
]

export const LINK_MENTION_LABELS: Record<LinkMentionKind, string> = {
  GAME_MVP: "MVP ván",
  SERIES_MVP: "MVP trận",
  SERIES_BROADCAST: "Bình luận viên",
  AWARD_PLAYER: "Người nhận giải",
  AWARD_TEAM: "Đội nhận giải",
}

export const LINK_MENTION_ACTIONS: Record<LinkMentionKind, string> = {
  GAME_MVP: "Mở ván",
  SERIES_MVP: "Mở trận",
  SERIES_BROADCAST: "Mở trận",
  AWARD_PLAYER: "Mở chung cuộc",
  AWARD_TEAM: "Mở chung cuộc",
}

/**
 * The screen where a row is fixed. A game's MVP is set in the game's info panel on its match screen; a match's MVP and
 * casters in that match of the schedule step; an award in the final step of the tournament.
 */
export type MentionTarget =
  | { screen: "match"; tournamentId: string; seriesId: string; search: string }
  | { screen: "workspace"; tournamentId: string; search: string }

export function mentionTarget(mention: LinkMention): MentionTarget {
  const { tournamentId } = mention
  if (mention.kind === "GAME_MVP" && mention.seriesId)
    return {
      screen: "match",
      tournamentId,
      seriesId: mention.seriesId,
      search: new URLSearchParams({ edit: "1", game: mention.recordId, view: "data" }).toString(),
    }
  if (mention.kind === "SERIES_MVP" || mention.kind === "SERIES_BROADCAST")
    return {
      screen: "workspace",
      tournamentId,
      search: new URLSearchParams({ step: "schedule", match: mention.recordId }).toString(),
    }
  if (mention.kind === "GAME_MVP") return { screen: "workspace", tournamentId, search: "step=schedule" }
  return { screen: "workspace", tournamentId, search: "step=final" }
}

/** Rows under their tournament. The server sorts by tournament, so rows of one tournament come together. */
export function mentionsByTournament(mentions: readonly LinkMention[]) {
  const groups: { tournamentId: string; tournamentName: string; mentions: LinkMention[] }[] = []
  for (const mention of mentions) {
    const last = groups.at(-1)
    if (last?.tournamentId === mention.tournamentId) last.mentions.push(mention)
    else
      groups.push({ tournamentId: mention.tournamentId, tournamentName: mention.tournamentName, mentions: [mention] })
  }
  return groups
}

/** What the row is about: the match and game number, the match, or the award. */
export function mentionPlace(mention: LinkMention) {
  const label = mention.label?.trim() || (mention.kind.startsWith("AWARD") ? "Giải thưởng" : "Trận")
  return mention.kind === "GAME_MVP" && mention.gameNumber != null ? `${label} · Ván ${mention.gameNumber}` : label
}
