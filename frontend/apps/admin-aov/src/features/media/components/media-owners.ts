import { useQuery, type QueryClient } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import type { PageSlice } from "../../publishing/api/types"
import { invalidateAllMediaAssets } from "../api/media-cache"

/** An entry of the image owner catalog (ADR-017). */
export interface MediaOwner {
  id: string
  name: string
  contactUrl: string | null
  assetCount: number
  version: number
}

export const mediaOwnerKeys = { all: ["media-owners"] as const }

/** The catalog is small, so one page of the most used owners serves suggestions and the management sheet. */
export function useMediaOwners(enabled = true) {
  return useQuery({
    queryKey: mediaOwnerKeys.all,
    queryFn: async ({ signal }) =>
      (await backendRequest<PageSlice<MediaOwner>>("/admin/media/owners?size=100", { signal })).items,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export async function updateMediaOwner(owner: MediaOwner, name: string, contactUrl: string | null) {
  return backendRequest<MediaOwner>(`/admin/media/owners/${owner.id}`, {
    method: "PUT",
    body: JSON.stringify({ name, contactUrl, expectedVersion: owner.version }),
  })
}

export async function mergeMediaOwner(owner: MediaOwner, target: MediaOwner) {
  return backendRequest<MediaOwner>(`/admin/media/owners/${owner.id}/merge`, {
    method: "POST",
    body: JSON.stringify({ targetId: target.id, expectedVersion: owner.version }),
  })
}

/** Renames and merges rewrite the owner on every source, so every cached image view is refreshed. */
export async function refreshAfterOwnerChange(client: QueryClient) {
  await client.invalidateQueries({ queryKey: mediaOwnerKeys.all })
  await invalidateAllMediaAssets(client)
}
