import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { createEntityIndex, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { backendRequest, getSession, subscribeSession } from "@/app/auth/session"
import type { HeroRow } from "../publishing/types"
import { createPublishingApi } from "../publishing/publishing-api"
import { warehouseApi, warehouseKeys } from "../warehouse/warehouse-api"
import { defaultSettings, loadSettings } from "./settings-api"

const publishing = createPublishingApi(backendRequest)
export async function loadHeroReferences(client?: QueryClient): Promise<EntityReference[]> {
  const heroes: HeroRow[] = []
  for (let page = 0; page < 100; page++) {
    const result = await publishing.heroes(page)
    heroes.push(...result.items)
    if (heroes.length >= result.totalElements || !result.items.length) break
    if (page === 99) throw new Error("Hero catalog exceeds the supported limit")
  }
  const output: EntityReference[] = []
  let cursor = 0
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < heroes.length) {
        const hero = heroes[cursor++]!
        const revision = hero.revisions
          .filter((r) => r.state !== "DISCARDED")
          .sort(
            (a, b) => b.revisionNo - a.revisionNo || Number(b.state === "PUBLISHED") - Number(a.state === "PUBLISHED"),
          )[0]
        if (!revision) continue
        const preview = client
          ? await client.fetchQuery({
              queryKey: ["publishing-preview", hero.id, revision.id],
              queryFn: () => publishing.read(hero.id, revision.id),
              staleTime: 300000,
            })
          : await publishing.read(hero.id, revision.id)
        const translations =
          preview.content.PROFILE?.translations
            .filter((t) => t.name.trim())
            .map((t) => ({
              locale: t.locale,
              name: t.name,
              aliases: [],
              description: (t.summary ?? "").slice(0, 4000),
            })) ?? []
        if (translations.length)
          output.push({
            id: hero.id,
            kind: "hero",
            translations,
            iconAssetId: preview.content.MEDIA_BINDINGS?.bindings.HEAD,
            destinations: { admin: `/hero/${hero.id}?revision=${revision.id}` },
          })
      }
    }),
  )
  return output
}
export async function loadWarehouseReferences(
  client?: QueryClient,
  requestedRulesetId = "",
): Promise<EntityReference[]> {
  const rulesets = client
    ? await client.fetchQuery({ queryKey: ["publishing-rulesets"], queryFn: publishing.rulesets, staleTime: 60000 })
    : await publishing.rulesets()
  const rulesetId = rulesets.some((ruleset) => ruleset.id === requestedRulesetId)
    ? requestedRulesetId
    : (rulesets.find((ruleset) => ruleset.code === "aov-standard")?.id ?? rulesets[0]?.id)
  if (!rulesetId) return []
  const domains = { items: "item", enchantments: "enchantment", arcana: "arcana", spells: "spell" } as const
  const groups = await Promise.all(
    (Object.keys(domains) as (keyof typeof domains)[]).map(async (domain) => {
      const records = client
        ? await client.fetchQuery({
            queryKey: warehouseKeys.catalog(domain, rulesetId, "vi-VN"),
            queryFn: () => warehouseApi.list(domain, rulesetId, "vi-VN"),
            staleTime: 60000,
          })
        : await warehouseApi.list(domain, rulesetId, "vi-VN")
      return records.flatMap((entry): EntityReference[] => {
        const translations = entry.content.translations
          .filter((text) => text.name.trim())
          .map((text) => ({
            locale: text.locale,
            name: text.name,
            aliases: [],
            description: (text.description || text.summary || "").slice(0, 4000),
          }))
        return translations.length
          ? [
              {
                id: entry.id,
                kind: domains[domain],
                autoMatch: false,
                iconAssetId: entry.content.iconAssetId || undefined,
                translations,
                destinations: { admin: `/${domain}?${new URLSearchParams({ item: entry.id, ruleset: rulesetId })}` },
              },
            ]
          : []
      })
    }),
  )
  return groups.flat()
}
export function useReferenceCatalog() {
  const client = useQueryClient()
  const [params] = useSearchParams()
  const requestedRulesetId = params.get("ruleset") ?? ""
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const settings = useQuery({ queryKey: ["rich-text-settings"], queryFn: loadSettings, retry: false, staleTime: 60000 })
  const heroes = useQuery({
    queryKey: ["rich-text-heroes", session.actor?.issuer, session.actor?.subject],
    queryFn: () => loadHeroReferences(client),
    staleTime: 300000,
    retry: false,
  })
  const items = useQuery({
    queryKey: [
      ...warehouseKeys.all,
      "references",
      "warehouse",
      session.actor?.issuer,
      session.actor?.subject,
      requestedRulesetId,
    ],
    queryFn: () => loadWarehouseReferences(client, requestedRulesetId),
    staleTime: 300000,
    retry: false,
  })
  const config = settings.data?.settings ?? defaultSettings
  const entities = useMemo(() => {
    const entries: EntityReference[] = [...(heroes.data ?? []), ...(items.data ?? [])]
    const merged = new Map(entries.map((entity) => [`${entity.kind}:${entity.id}`, entity]))
    for (const entity of config.entities) {
      const key = `${entity.kind}:${entity.id}`
      if (entity.kind === "term" || merged.has(key)) {
        const original = merged.get(key)
        merged.set(key, { ...original, ...entity, iconAssetId: original?.iconAssetId })
      }
    }
    return [...merged.values()]
  }, [heroes.data, items.data, config.entities])
  const resolveIcon = useCallback(
    async (entity: EntityReference) => {
      if (!entity.iconAssetId) return entity.icon
      const asset = await client.fetchQuery({
        queryKey: ["publishing-asset", entity.iconAssetId],
        queryFn: () => publishing.asset(entity.iconAssetId!),
        staleTime: 300000,
      })
      return asset.currentUrl
    },
    [client],
  )
  return {
    settings,
    heroes,
    items,
    config,
    entities,
    resolveIcon,
    canEdit: session.actor?.capabilities.includes("hero:write") ?? false,
  }
}
type ReferenceContextValue = {
  index: ReturnType<typeof createEntityIndex>
  locale: string
  autoRecognize: boolean
  resolveIcon: ReturnType<typeof useReferenceCatalog>["resolveIcon"]
}
const ReferenceContext = createContext<ReferenceContextValue | null>(null)
const noEntities: EntityReference[] = []
export function AdminReferenceProvider({
  locale,
  entities: local = noEntities,
  children,
}: {
  locale: string
  entities?: EntityReference[]
  children: ReactNode
}) {
  const { entities, config, heroes, items, settings, resolveIcon } = useReferenceCatalog()
  const value = useMemo(() => {
    const merged = new Map(entities.map((entity) => [`${entity.kind}:${entity.id}`, entity]))
    for (const entity of local) merged.set(`${entity.kind}:${entity.id}`, entity)
    return {
      index: createEntityIndex([...merged.values()], locale, config.fallbackLocale),
      locale,
      autoRecognize: config.autoRecognize,
      resolveIcon,
    }
  }, [entities, local, locale, config.fallbackLocale, config.autoRecognize, resolveIcon])
  return (
    <ReferenceContext.Provider value={value}>
      {(heroes.isError || items.isError) && (
        <p className="mb-2 text-xs text-muted-foreground">Danh mục tham chiếu chưa tải đầy đủ.</p>
      )}
      {settings.isError && (
        <p className="mb-2 text-xs text-muted-foreground">
          Chưa tải được thiết lập tham chiếu; đang dùng cấu hình mặc định.
        </p>
      )}
      {children}
    </ReferenceContext.Provider>
  )
}
export function AdminEntityText({ text }: { text: string }) {
  const value = useContext(ReferenceContext)
  return (
    <EntityRichText
      text={text}
      locale={value?.locale ?? "vi-VN"}
      index={value?.index}
      autoRecognize={value?.autoRecognize ?? false}
      context="admin"
      firstOccurrenceOnly
      resolveIcon={value?.resolveIcon}
    />
  )
}
