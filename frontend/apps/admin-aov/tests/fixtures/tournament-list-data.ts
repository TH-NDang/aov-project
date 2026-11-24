import type { DocumentView, TournamentContent } from "@aov/community-contracts"

/** A tournament as a list answers it. */
export const tournamentRow = (
  id: string,
  name: string,
  content: Partial<TournamentContent> = {},
): DocumentView<TournamentContent> => ({
  id,
  version: 3,
  createdAt: "",
  updatedAt: "",
  missingFields: [],
  content: { code: id, name, region: "VN", status: "FINISHED", ...content },
})

/** The only page of a list endpoint. */
export const onePage = <T>(items: T[]) => ({ items, page: 0, size: 30, totalElements: items.length })
