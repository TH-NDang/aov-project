import { createContext, useContext, useMemo, useSyncExternalStore, type ReactElement, type ReactNode } from "react"
import { QueryClientContext, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { EntityReferencePopover, EntityRichText } from "@aov/ui/components/entity-rich-text"
import { createEntityIndex, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { backendRequest, getSession, subscribeSession } from "@/app/auth/session"
import { createPublishingApi } from "../publishing/api/publishing-api"
import { defaultSettings, referenceSettingsQuery } from "./settings-api"
import { createMediaIconResolver } from "../media/api/media-cache"
import { referenceCatalogApi, referenceCatalogKeys } from "./reference-api"
import { useSkillReferences } from "./use-skill-references"
import { countryReferences } from "@aov/ui/lib/country-references"
import { communityReferenceApi, communityReferenceKeys } from "./community-reference-api"
import { useCommunityReferences } from "./use-community-references"
import { mergeReferenceCatalog } from "./hero-aliases"

const publishing = createPublishingApi(backendRequest)
const ReferenceRulesetContext = createContext<string | undefined>(undefined)
const noEntities: EntityReference[] = []
const RevisionSkillsContext = createContext<EntityReference[]>(noEntities)

export function ReferenceRulesetProvider({
  rulesetId,
  skills = noEntities,
  children,
}: {
  rulesetId?: string
  skills?: EntityReference[]
  children: ReactNode
}) {
  return (
    <ReferenceRulesetContext.Provider value={rulesetId}>
      <RevisionSkillsContext.Provider value={skills}>{children}</RevisionSkillsContext.Provider>
    </ReferenceRulesetContext.Provider>
  )
}

export function useReferenceCatalog() {
  const client = useQueryClient()
  const [params] = useSearchParams()
  const inheritedRulesetId = useContext(ReferenceRulesetContext)
  const skills = useContext(RevisionSkillsContext)
  const requestedRulesetId = inheritedRulesetId ?? params.get("ruleset") ?? ""
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const settings = useQuery(referenceSettingsQuery)
  const catalog = useQuery({
    queryKey: referenceCatalogKeys.catalog(session.actor?.issuer, session.actor?.subject, requestedRulesetId),
    queryFn: ({ signal }) => referenceCatalogApi.list(requestedRulesetId, signal),
    enabled: !!session.actor,
    staleTime: 300000,
    retry: false,
  })
  const communityCatalog = useQuery({
    queryKey: communityReferenceKeys.catalog(session.actor?.issuer, session.actor?.subject),
    queryFn: ({ signal }) => communityReferenceApi.catalog(signal),
    enabled: !!session.actor,
    staleTime: 60000,
    retry: false,
  })
  const config = settings.data?.settings ?? defaultSettings
  const entities = useMemo(() => {
    const entries = [...countryReferences, ...(communityCatalog.data?.items ?? []), ...(catalog.data ?? [])]
    return [...mergeReferenceCatalog(entries, config.entities), ...skills]
  }, [catalog.data, communityCatalog.data, config.entities, skills])
  const resolveIcon = useMemo(() => createMediaIconResolver(client, publishing.asset), [client])
  return {
    settings,
    catalog,
    communityCatalog,
    config,
    entities,
    resolveIcon,
    rulesetId: requestedRulesetId,
    canEdit: session.actor?.capabilities.includes("hero:write") ?? false,
  }
}
type ReferenceContextValue = {
  index: ReturnType<typeof createEntityIndex>
  locale: string
  fallbackLocale: string
  rulesetId: string
  autoRecognize: boolean
  resolveIcon: ReturnType<typeof useReferenceCatalog>["resolveIcon"]
}
const ReferenceContext = createContext<ReferenceContextValue | null>(null)
export function AdminReferenceProvider({
  locale,
  entities: local = noEntities,
  children,
}: {
  locale: string
  entities?: EntityReference[]
  children: ReactNode
}) {
  const { entities, config, catalog, settings, resolveIcon, rulesetId } = useReferenceCatalog()
  const value = useMemo(() => {
    const merged = new Map(entities.map((entity) => [`${entity.kind}:${entity.id}`, entity]))
    for (const entity of local) merged.set(`${entity.kind}:${entity.id}`, entity)
    return {
      index: createEntityIndex([...merged.values()], locale, config.fallbackLocale),
      locale,
      fallbackLocale: config.fallbackLocale,
      rulesetId,
      autoRecognize: config.autoRecognize,
      resolveIcon,
    }
  }, [entities, local, locale, config.fallbackLocale, config.autoRecognize, resolveIcon, rulesetId])
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
  if (!value)
    return <EntityRichText text={text} locale="vi-VN" autoRecognize={false} context="admin" firstOccurrenceOnly />
  return <ResolvedAdminEntityText text={text} value={value} />
}

type TermHintProps = { termId: string; locale?: string; children: ReactElement }

export function AdminTermHint({ termId, locale, children }: TermHintProps) {
  const references = useContext(ReferenceContext)
  const client = useContext(QueryClientContext)
  if (!references)
    return client ? (
      <CatalogTermHint termId={termId} locale={locale}>
        {children}
      </CatalogTermHint>
    ) : null
  const match = references.index.byId.get(`term:${termId}`)
  if (!match) return null
  return (
    <EntityReferencePopover
      entity={match.entity}
      locale={references.locale}
      fallbackLocale={references.fallbackLocale}
      index={references.index}
      resolveIcon={references.resolveIcon}
      context="admin"
    >
      {children}
    </EntityReferencePopover>
  )
}

function CatalogTermHint({ termId, locale = "vi-VN", children }: TermHintProps) {
  const { data } = useQuery(referenceSettingsQuery)
  const settings = data?.settings
  const entity = settings?.entities.find((entry) => entry.kind === "term" && entry.id === termId)
  if (!entity) return null
  return (
    <EntityReferencePopover entity={entity} locale={locale} fallbackLocale={settings?.fallbackLocale} context="admin">
      {children}
    </EntityReferencePopover>
  )
}

function ResolvedAdminEntityText({ text, value }: { text: string; value: ReferenceContextValue }) {
  const skills = useSkillReferences(text, value.locale, value.rulesetId)
  const community = useCommunityReferences(text, value.locale)
  const index = useMemo(() => {
    if (!skills.length && !community.length) return value.index
    const extra = createEntityIndex([...skills, ...community], value.locale, value.fallbackLocale)
    // Explicit skill references do not participate in automatic text recognition.
    return { ...value.index, byId: new Map([...value.index.byId, ...extra.byId]) }
  }, [value, skills, community])
  return (
    <EntityRichText
      text={text}
      locale={value.locale}
      index={index}
      autoRecognize={value.autoRecognize}
      context="admin"
      firstOccurrenceOnly
      resolveIcon={value.resolveIcon}
    />
  )
}
