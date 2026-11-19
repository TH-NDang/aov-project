import { useQueryClient } from "@tanstack/react-query"
import { communityKeys } from "../../../lib/community-keys"

/** Reads again what a change on the page manager may have changed: the role, the public page and the managers. */

export function useManagerRefresh() {
  const client = useQueryClient()
  return async () => {
    await client.invalidateQueries({ queryKey: communityKeys.viewerAll })
    await client.invalidateQueries({ queryKey: communityKeys.publicPageAll })
    await client.invalidateQueries({ queryKey: communityKeys.managedPageAll })
    await client.invalidateQueries({ queryKey: communityKeys.memberAll })
  }
}
