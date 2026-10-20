import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { createEntityIndex, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { backendRequest, getSession, subscribeSession } from "@/app/auth/session"
import { createPublishingApi } from "../publishing/publishing-api"
import { defaultSettings, loadSettings } from "./settings-api"
import { createMediaIconResolver } from "../media/media-cache"
import { referenceCatalogApi, referenceCatalogKeys } from "./reference-api"

const publishing = createPublishingApi(backendRequest)
export function useReferenceCatalog() {
  const client = useQueryClient()
  const [params] = useSearchParams()
  const requestedRulesetId = params.get("ruleset") ?? ""
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const settings = useQuery({ queryKey: ["rich-text-settings"], queryFn: loadSettings, retry: false, staleTime: 60000 })
  const catalog = useQuery({
    queryKey: referenceCatalogKeys.catalog(session.actor?.issuer, session.actor?.subject, requestedRulesetId),
    queryFn: ({ signal }) => referenceCatalogApi.list(requestedRulesetId, signal),
    enabled: !!session.actor,
    staleTime: 300000,
    retry: false,
  })
  const config = settings.data?.settings ?? defaultSettings
  const entities = useMemo(() => {
    const entries = catalog.data ?? []
    const merged = new Map(entries.map((entity) => [`${entity.kind}:${entity.id}`, entity]))
    for (const entity of config.entities) {
      const key = `${entity.kind}:${entity.id}`
      if (entity.kind === "term" || merged.has(key)) {
        const original = merged.get(key)
        merged.set(key, { ...original, ...entity, iconAssetId: original?.iconAssetId })
      }
    }
    return [...merged.values()]
  }, [catalog.data, config.entities])
  const resolveIcon = useMemo(() => createMediaIconResolver(client, publishing.asset), [client])
  return {
    settings,
    catalog,
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
  const { entities, config, catalog, settings, resolveIcon } = useReferenceCatalog()
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
      {catalog.isError && <p className="mb-2 text-xs text-muted-foreground">Danh mục tham chiếu chưa tải đầy đủ.</p>}
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
