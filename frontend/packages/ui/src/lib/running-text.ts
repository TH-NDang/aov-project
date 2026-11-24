import {
  createEntityIndex,
  parseRichText,
  type EntityIndex,
  type EntityReference,
  type RichTextNode,
} from "./entity-rich-text"
import {
  addressResolver,
  communityReferences,
  DATA_LOCALE,
  wikiReferences,
  type NamedRecord,
  type WikiMode,
} from "./running-text-names"

/** Everything a text people write can name, ready to be found in one. */
export type RunningTextReferences = {
  entities: EntityReference[]
  index: EntityIndex
  resolveAddress: (address: string) => string | undefined
}

/** `streamUrl` and `wikiUrl` are where the pages of the names are, so a pasted address reads as the page it opens. */
export function runningTextReferences({
  names,
  catalog,
  modes,
  locale,
  streamUrl,
  wikiUrl,
}: {
  names: NamedRecord[]
  catalog: EntityReference[]
  modes: WikiMode[]
  locale: string
  streamUrl: string
  wikiUrl: string
}): RunningTextReferences {
  const entities = [...communityReferences(names), ...wikiReferences(catalog, modes, { wikiUrl, locale })]
  return {
    entities,
    index: createEntityIndex(entities, locale, DATA_LOCALE, { scope: "all" }),
    resolveAddress: addressResolver(entities, streamUrl),
  }
}

/**
 * A text as Stream shows it: its words and the names that become links, each once a paragraph. `about` holds the
 * records the text is about, as `referenceKey` writes them; it never links those.
 */
export function readRunningText(
  text: string,
  references: RunningTextReferences,
  about: readonly string[] = [],
): RichTextNode[] {
  return parseRichText(text, references.index, {
    markup: "references",
    firstOccurrenceOnly: true,
    exclude: new Set(about),
    resolveAddress: references.resolveAddress,
  })
}
