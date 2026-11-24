import type { CommunityProfile, DocumentView, PageSlice, TournamentContent } from "@aov/community-contracts"
import type { EntityKind, EntityReference } from "@aov/ui/lib/entity-rich-text"
import { directoryApi } from "@/features/community/directory/directory-api"
import { gameModeApi, type AdminSummary } from "@/features/game-modes/game-mode-api"
import { tournamentApi } from "@/features/tournaments/api/tournament-api"
import { ApiError } from "@/lib/api/errors"
import { normalize } from "@/lib/text"
import { communityReferenceApi } from "./community-reference-api"

/** The kinds of the reference catalog that other screens keep, in the order the catalog lists them. */
export const recordKinds = ["mode", "circuit", "organization", "competition", "team", "player", "person"] as const
export type RecordKind = (typeof recordKinds)[number]

export const isRecordKind = (kind: string): kind is RecordKind => (recordKinds as readonly string[]).includes(kind)

/** A line of the catalog: how the record is named, the Admin page that keeps it and its logo, if it has one. */
export type CatalogRecord = {
  entity: EntityReference
  path: string
  logoUrl?: string | null
  logoDarkUrl?: string | null
}

export const recordCatalogKeys = {
  rows: (kind: RecordKind, search: string) => ["record-catalog", "rows", kind, search] as const,
  count: (kind: RecordKind, search: string) => ["record-catalog", "count", kind, search] as const,
}

function record(
  kind: EntityKind,
  id: string,
  path: string,
  { name, aliases }: { name: string; aliases: (string | null | undefined)[] },
): CatalogRecord {
  const own = [...new Set(aliases.filter((alias): alias is string => !!alias && alias !== name))]
  return {
    path,
    entity: { id, kind, translations: [{ locale: "vi-VN", name, aliases: own, description: "" }] },
  }
}

const tournamentRecord = ({ id, content }: DocumentView<TournamentContent>): CatalogRecord => ({
  ...record("competition", id, `/tournaments/${id}`, { name: content.name, aliases: [] }),
  logoUrl: content.logoUrl,
  logoDarkUrl: content.logoDarkUrl,
})

/** A person has no picture; the mark of their kind stands for them. */
const profileRecord = (kind: "circuit" | "organization" | "person", { id, code, content }: CommunityProfile) => ({
  ...record(kind, id, `/pages/${id}`, { name: content?.name ?? code, aliases: [content?.shortName] }),
  logoUrl: kind === "person" ? null : content?.avatarUrl,
})

const modeRecord = ({ id, code, name }: AdminSummary) =>
  record("mode", id, `/game-modes/${id}`, { name, aliases: [code] })

const profileKinds = { circuit: "CIRCUIT", organization: "ORGANIZATION", person: "PERSON" } as const

function mapped<T>(slice: PageSlice<T>, toRecord: (item: T) => CatalogRecord): PageSlice<CatalogRecord> {
  return { ...slice, items: slice.items.map(toRecord) }
}

async function read(
  kind: RecordKind,
  { q, page, size }: { q: string; page: number; size?: number },
  signal: AbortSignal,
): Promise<PageSlice<CatalogRecord>> {
  switch (kind) {
    case "mode": {
      const wanted = normalize(q)
      const modes = (await gameModeApi.list(signal)).filter(({ name, code }) =>
        normalize(`${name} ${code}`).includes(wanted),
      )
      return { items: modes.map(modeRecord), totalElements: modes.length, page: 0, size: modes.length }
    }
    case "competition":
      return mapped(
        await tournamentApi.searchTournaments({ q, page, ...(size ? { size } : {}) }, signal),
        tournamentRecord,
      )
    case "team":
    case "player":
      return mapped(await communityReferenceApi.search(q, kind, page, signal), (entity) => ({
        entity,
        path: entity.destinations?.admin ?? "/tournaments",
        logoUrl: kind === "team" ? entity.icon : null,
      }))
    default:
      return mapped(
        await directoryApi.profiles({ kind: profileKinds[kind], q, sort: "ACTIVE", page, size }, signal),
        (profile) => profileRecord(kind, profile),
      )
  }
}

/** An editor who may not read a kind finds none of it, instead of a catalog that fails. */
async function list(kind: RecordKind, request: Parameters<typeof read>[1], signal: AbortSignal) {
  try {
    return await read(kind, request, signal)
  } catch (error) {
    if (error instanceof ApiError && error.status === 403)
      return { items: [], totalElements: 0, page: request.page, size: 0 }
    throw error
  }
}

export const recordCatalogApi = {
  list: (kind: RecordKind, q: string, page: number, signal: AbortSignal) => list(kind, { q, page }, signal),
  count: async (kind: RecordKind, q: string, signal: AbortSignal) =>
    (await list(kind, { q, page: 0, size: 1 }, signal)).totalElements,
}
