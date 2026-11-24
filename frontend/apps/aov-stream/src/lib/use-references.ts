import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ReferenceName } from "@aov/community-contracts"
import { createEntityIndex, parseRichText, type EntityIndex, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { useStreamLocale } from "../components/stream-locale"
import { referenceNamesQuery, referencePeopleQuery, wikiCatalogQuery, wikiModesQuery } from "./reference-api"
import {
  addressResolver,
  communityReferences,
  DATA_LOCALE,
  mayNamePeople,
  wikiReferences,
  type WikiMode,
} from "./reference-model"

/** Everything texts can name now, ready to be found in one. */
export type References = {
  entities: EntityReference[]
  index: EntityIndex
  resolveAddress: (address: string) => string | undefined
}

type Source = {
  names: ReferenceName[]
  people?: ReferenceName[]
  catalog: EntityReference[]
  modes: WikiMode[]
  locale: string
}

const none: never[] = []

function build({ names, people = none, catalog, modes, locale }: Source): References {
  const wikiUrl = publicSiteUrl(import.meta.env.VITE_WIKI_URL, 5173, window.location.origin)
  const entities = [
    ...communityReferences(people.length ? [...names, ...people] : names),
    ...wikiReferences(catalog, modes, { wikiUrl, locale }),
  ]
  return {
    entities,
    index: createEntityIndex(entities, locale, DATA_LOCALE, { scope: "all" }),
    resolveAddress: addressResolver(entities, new URL(import.meta.env.BASE_URL, window.location.origin).href),
  }
}

// Every text of a page reads the same answers, so the index is built once for all of them: with and without people.
const built: { source: Source; references: References }[] = []

function references(source: Source) {
  const known = built.find((entry) =>
    (Object.keys(source) as (keyof Source)[]).every((key) => entry.source[key] === source[key]),
  )
  if (known) return known.references
  const made = { source, references: build(source) }
  built.unshift(made)
  built.length = Math.min(built.length, 3)
  return made.references
}

/**
 * What a text can name, once it is known; until then the text reads as plain words. Names of people are three quarters
 * of all names, so they are only read for a text that may hold one.
 */
export function useReferences(text: string, about: readonly string[] = none): References | undefined {
  const { languageTag } = useStreamLocale()
  const enabled = !!text.trim()
  const names = useQuery({ ...referenceNamesQuery, enabled })
  const catalog = useQuery({ ...wikiCatalogQuery(languageTag), enabled })
  const modes = useQuery({ ...wikiModesQuery, enabled })
  const source = useMemo<Source | undefined>(() => {
    // The text waits for its own site's names; the Wiki's join them when they come.
    if (!names.data) return undefined
    return {
      names: names.data.items,
      people: undefined,
      catalog: catalog.data ?? none,
      modes: modes.data ?? none,
      locale: languageTag,
    }
  }, [names.data, catalog.data, modes.data, languageTag])
  const core = useMemo(() => source && references(source), [source])
  const wantsPeople = useMemo(() => {
    if (!core) return false
    const nodes = parseRichText(text, core.index, { markup: "references" })
    const rest = nodes.map((node) => (node.type === "text" ? node.text : " ")).join("")
    const namesTeam = nodes.some((node) => node.type === "reference" && node.entity.kind === "team")
    return mayNamePeople(text, rest, namesTeam, about)
  }, [core, text, about])
  const people = useQuery({ ...referencePeopleQuery, enabled: wantsPeople })

  return useMemo(
    () => (source && wantsPeople && people.data ? references({ ...source, people: people.data.items }) : core),
    [source, core, wantsPeople, people.data],
  )
}
