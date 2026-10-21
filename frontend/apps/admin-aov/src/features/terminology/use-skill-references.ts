import { useId, useMemo, useSyncExternalStore } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import { extractSkillReferenceIds, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { EntityReferenceSearch } from "@aov/ui/lib/entity-rich-text-editor"
import { getSession, subscribeSession } from "@/app/auth/session"
import { createSkillReferenceSearch, skillReferenceEntryOptions } from "./skill-reference-api"

function collectSkillReferences(entries: readonly { data?: EntityReference | null }[]): EntityReference[] {
  return entries.flatMap((entry) => (entry.data ? [entry.data] : []))
}

/** Resolve only explicit tokens present in this text, with shared per-identity queries. */
export function useSkillReferences(text: string, locale: string, rulesetId = ""): EntityReference[] {
  const client = useQueryClient()
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const ids = useMemo(() => [...new Set(extractSkillReferenceIds(text))].slice(0, 500), [text])
  const scope = {
    issuer: session.actor?.issuer ?? "",
    subject: session.actor?.subject ?? "",
    rulesetId,
    locale,
  }
  return useQueries({
    queries: ids.map((id) => ({ ...skillReferenceEntryOptions(client, scope, id), enabled: !!session.actor })),
    combine: collectSkillReferences,
  })
}

/** Each mounted editor owns its abortable searches while sharing resolved entity data. */
export function useSkillReferenceSearch(rulesetId = ""): EntityReferenceSearch {
  const client = useQueryClient()
  const owner = useId()
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  return useMemo(() => {
    if (!session.actor) return async ({ page }) => ({ items: [], page, size: 20, totalElements: 0 })
    return createSkillReferenceSearch(
      client,
      {
        issuer: session.actor.issuer,
        subject: session.actor.subject,
        rulesetId,
      },
      owner,
    )
  }, [client, owner, rulesetId, session.actor?.issuer, session.actor?.subject])
}
