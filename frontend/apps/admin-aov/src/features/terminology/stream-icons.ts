import { QueryObserver, type QueryClient } from "@tanstack/react-query"
import type { ReferencePreview } from "@aov/community-contracts"
import type { EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { previewKind } from "@aov/ui/lib/running-text-names"
import { chooseLogo } from "@/lib/logo-choice"
import { streamPreviewQuery } from "./stream-reference-api"

/** The logos of the records Stream names, read one by one where they are shown: the public lists carry none. */
export function createStreamIconResolver(client: QueryClient, darkTheme: boolean): EntityIconResolver {
  const preview = ({ kind, id }: EntityReference) => {
    const recordKind = previewKind(kind)
    return recordKind && streamPreviewQuery(recordKind, id)
  }
  const logo = (record: ReferencePreview | undefined) => {
    const { url, plate } = chooseLogo(record?.logoUrl, record?.logoDarkUrl, darkTheme)
    return url ? { url, plate } : undefined
  }
  const resolve: EntityIconResolver = async (entity) => {
    const query = preview(entity)
    return query && logo(await client.fetchQuery(query))
  }
  resolve.subscribe = (entity, update) => {
    const query = preview(entity)
    if (!query) return () => {}
    const observer = new QueryObserver(client, query)
    const unsubscribe = observer.subscribe((result) => update(logo(result.data)))
    update(logo(observer.getCurrentResult().data))
    return unsubscribe
  }
  return resolve
}
