import { useMemo, type ReactNode } from "react"
import { ReferenceRulesetProvider, useReferenceCatalog } from "@/features/terminology/catalog"
import { ReferenceSourceProvider, type ReferenceSource } from "../components/game/entity-ref"

/** Feeds the admin wiki reference catalogue of the game's ruleset to the viewer's hero/item cards. */
export function WikiReferences({ rulesetId, children }: { rulesetId: string; children: ReactNode }) {
  return (
    <ReferenceRulesetProvider rulesetId={rulesetId}>
      <AdminReferenceSource>{children}</AdminReferenceSource>
    </ReferenceRulesetProvider>
  )
}

function AdminReferenceSource({ children }: { children: ReactNode }) {
  const { entities, config, resolveIcon } = useReferenceCatalog()
  const source = useMemo<ReferenceSource>(
    () => ({ entities, context: "admin", locale: "vi-VN", fallbackLocale: config.fallbackLocale, resolveIcon }),
    [entities, config.fallbackLocale, resolveIcon],
  )
  return <ReferenceSourceProvider source={source}>{children}</ReferenceSourceProvider>
}
