import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { useLocalDraft } from "@/app/drafts/use-local-draft"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import type { Preview } from "@/lib/hero-types"
import { heroLocationId } from "../../model/hero-location"
import {
  dirtyHeroSections,
  emptyHeroContent,
  heroWorkingConflict,
  heroWorkingSchema,
  mergeHeroWorkingCopy,
  type HeroWorkingCopy,
} from "../../model/hero-working-copy"
import { savedHeroSections } from "../patch-changes/hero-draft-changes"

const api = createPublishingApi(backendRequest)

/**
 * The version of the hero on screen and the working copy of it kept on this device. The address chooses the version;
 * a choice made on the page is held in `selectedId` until the address follows it.
 */
export function useHeroRevision({
  heroId,
  revisionId,
  canWrite,
  urlParams,
}: {
  heroId: string
  revisionId?: string
  canWrite: boolean
  urlParams: URLSearchParams
}) {
  const requestedRevision = revisionId ?? heroLocationId(urlParams.get("revision"))
  const [selectedId, setSelectedId] = useState(requestedRevision)
  const [openedWithoutRevision] = useState(!requestedRevision)
  const rulesets = useQuery({ queryKey: publishingKeys.rulesets, queryFn: api.rulesets })
  const regions = useQuery({ queryKey: publishingKeys.regions, queryFn: api.regions })
  const revisions = useQuery({
    queryKey: publishingKeys.revisions(heroId),
    queryFn: () => api.revisions(heroId),
    enabled: !!heroId,
  })
  const read = useQuery({
    queryKey: publishingKeys.preview(heroId, selectedId),
    queryFn: () => api.read(heroId, selectedId),
    enabled: !!heroId && !!selectedId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })

  const initialCopy: HeroWorkingCopy = { content: read.data?.content ?? emptyHeroContent, notes: {} }
  const localDraft = useLocalDraft({
    form: `hero:${heroId}:${selectedId}`,
    initialValue: initialCopy,
    baseVersion: read.data?.revision.version ?? null,
    schema: heroWorkingSchema,
    enabled: !!heroId && !!selectedId && !!read.data && canWrite && read.data.revision.state === "DRAFT",
    hasConflict: heroWorkingConflict,
    merge: mergeHeroWorkingCopy,
  })
  const preview: Preview | null = read.data ? { ...read.data, content: localDraft.value.content } : null
  const dirty = new Set(dirtyHeroSections(localDraft.value, initialCopy))
  const revision = preview?.revision
  const writable = canWrite && revision?.state === "DRAFT"

  const savedChanges = useQuery({
    queryKey: publishingKeys.draftChange(heroId, revision?.id, revision?.version),
    queryFn: () => api.draftChanges(heroId, revision!.id),
    enabled: !!writable,
    retry: false,
  })
  const savedSections = savedChanges.data ? savedHeroSections(savedChanges.data) : []

  return {
    requestedRevision,
    selectedId,
    setSelectedId,
    openedWithoutRevision,
    rulesets,
    regions,
    revisions,
    read,
    initialCopy,
    localDraft,
    preview,
    dirty,
    revision,
    writable,
    savedChanges,
    savedSections,
  }
}

export type HeroRevision = ReturnType<typeof useHeroRevision>
