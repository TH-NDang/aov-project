import { queryOptions } from "@tanstack/react-query"
import type { CompetitionParticipant, ProfileKind } from "@aov/community-contracts"
import { communityApi } from "./community-api"
import { communityKeys } from "./community-keys"
import { participantsQuery } from "./tournament-api"

/**
 * Pages a search reads per kind, the same for the suggestions under the field and the page of results, so the results
 * open on answers the suggestions already read.
 */
export const SEARCH_GROUP_SIZE = 8

/** Pages of one kind (organizations, circuits) whose name holds the search. */
export const pageSearchQuery = (kind: ProfileKind, query: string) =>
  queryOptions({
    queryKey: communityKeys.pageSearch(kind, query),
    queryFn: () => communityApi.pages({ kind, q: query, size: String(SEARCH_GROUP_SIZE) }),
    staleTime: 60_000,
  })

/** Teams, players or staff of published competitions whose name holds the search. */
export const participantSearchQuery = (kind: CompetitionParticipant["kind"], query: string) =>
  participantsQuery(kind, query, SEARCH_GROUP_SIZE)
