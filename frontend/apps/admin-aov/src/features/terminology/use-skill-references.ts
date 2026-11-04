import { useId, useMemo, useSyncExternalStore } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import {
  extractSkillReferenceIds,
  parseRichText,
  type EntityIndex,
  type EntityReference,
  type RichTextNode,
} from "@aov/ui/lib/entity-rich-text"
import type { EntityReferenceSearch } from "@aov/ui/lib/entity-rich-text-editor"
import { getSession, subscribeSession } from "@/app/auth/session"
import {
  createSkillReferenceSearch,
  skillReferenceEntryOptions,
  skillReferenceSlotOptions,
} from "./skill-reference-api"

type SkillMention = { heroId: string; slot: number; aliases: string[] }

function namedSkillMentions(text: string, owners?: EntityIndex): SkillMention[] {
  if (!owners || !/(?:chiêu|nội)\s/iu.test(text.normalize("NFC"))) return []
  const mentions = new Map<string, SkillMention>()
  function add(heroId: string, slot: number, alias?: string) {
    const key = `${heroId}:${slot}`
    const mention = mentions.get(key) ?? { heroId, slot, aliases: [] }
    if (alias && !mention.aliases.includes(alias)) mention.aliases.push(alias)
    mentions.set(key, mention)
  }
  function visit(nodes: RichTextNode[]) {
    nodes.forEach((node, index) => {
      if ("children" in node) return visit(node.children)
      const previous = nodes[index - 1]
      if (node.type !== "reference" || node.manual || node.entity.kind !== "hero" || previous?.type !== "text") return
      const prefix = previous.text
        .normalize("NFC")
        .match(/(?:^|[^\p{L}\p{M}\p{N}_])((?:chiêu\s+(cuối|[1-9]\d?)|nội\s+tại)(?:\s+của)?\s+)$/iu)
      if (!prefix) return
      const alias = prefix[1]! + node.label
      if (alias.length > 200) return
      const number = prefix[2]?.toLowerCase()
      const slot = number === "cuối" ? 3 : Number(number ?? 0)
      add(node.entity.id, slot, alias)
    })
  }
  visit(parseRichText(text, owners, { onOwnerFirstSkill: add }))
  return [...mentions.values()]
}

export function useSkillReferences(
  text: string,
  locale: string,
  rulesetId = "",
  owners?: EntityIndex,
): EntityReference[] {
  const client = useQueryClient()
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const ids = useMemo(() => [...new Set(extractSkillReferenceIds(text))].slice(0, 500), [text])
  const mentions = useMemo(() => namedSkillMentions(text, owners), [text, owners])
  const scope = {
    issuer: session.actor?.issuer ?? "",
    subject: session.actor?.subject ?? "",
    rulesetId,
    locale,
  }
  return useQueries({
    queries: [
      ...ids.map((id) => skillReferenceEntryOptions(client, scope, id)),
      ...mentions.map(({ heroId, slot }) => skillReferenceSlotOptions(client, scope, heroId, slot)),
    ].map((options) => ({
      ...options,
      enabled: !!session.actor,
    })),
    combine: (results) =>
      results.flatMap(({ data }, index) => {
        if (!data) return []
        const mention = mentions[index - ids.length]
        return [mention ? { ...data, autoMatch: true, qualifiedSkillAliases: mention.aliases } : data]
      }),
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
