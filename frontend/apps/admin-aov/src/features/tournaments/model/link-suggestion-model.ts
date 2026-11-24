import {
  profileKindLabels,
  type CommunityProfile,
  type LinkMention,
  type LinkMentionKind,
} from "@aov/community-contracts"
import { normalize } from "@/lib/text"

/** A name as the text writes it, with every key a record may match it by. */
export type WrittenName = { name: string; keys: string[] }

/**
 * A record a name may stand for. `exact`: one of its names is the written one, whatever the accents, case and
 * spacing; `inside`: it belongs to the match or tournament the text is about.
 */
export type LinkCandidate = {
  id: string
  name: string
  imageUrl?: string | null
  imageDarkUrl?: string | null
  /** What tells it from a namesake: its team, or that it is from elsewhere. */
  detail: string
  exact: boolean
  inside: boolean
}

/** One written name of a row with the records it may stand for, best first. */
export type NameSuggestion = WrittenName & { candidates: LinkCandidate[] }
export type RowSuggestion = {
  names: NameSuggestion[]
  /** The records to link without another look: exactly one exact match from inside for every name. */
  certain: LinkCandidate[] | null
}

/** How many records are offered for one name; the picker reaches the rest. */
const SHOWN = 3
/** Shorter names match parts of too many others to be worth offering. */
const MIN_PARTIAL = 3

/** A name reduced to its letters and digits without accents, the way the server compares player names. */
export const linkKey = (value: string | null | undefined) => normalize(value).replace(/[^\p{L}\p{M}\p{N}]/gu, "")

const unique = (values: string[]) => [...new Set(values.filter(Boolean))]

/** Sentences importers put after the name on the same line: where the line-up comes from, or who credited the MVP. */
const SOURCE_SENTENCE = /\s+Tuyển thủ theo vị trí được suy ra.*$/u
const CREDIT_SENTENCE = /^(\S+)\s+\1\s+was\b.*$/u

/** The text up to where the source is explained. */
export const mentionText = (text: string) =>
  text.split("\n")[0]!.replace(SOURCE_SENTENCE, "").replace(CREDIT_SENTENCE, "$1").trim()

/** `Penguin (Vietnamese player)` and `Sun_(Vietnamese_Player)Sun` name a page; the brackets tell it from a namesake. */
function withoutBrackets(value: string) {
  const text = value.replaceAll("_", " ").trim()
  const match = /^(.*?)\s*\(([^)]*)\)\s*(.*)$/.exec(text)
  return (match ? match[3] || match[1]! : text).trim()
}

/** One name, which imported text may write as `page|label`: the label is what readers saw. */
export function writtenName(raw: string): WrittenName {
  const [page = "", label = ""] = raw.split("|").map((part) => part.trim())
  return {
    name: withoutBrackets(label || page) || raw.trim(),
    keys: unique([label && withoutBrackets(label), withoutBrackets(page), label, page].map(linkKey)),
  }
}

/** Rows that may list several people; each is a name of its own, once however often it is written. */
const LISTS: ReadonlySet<LinkMentionKind> = new Set(["SERIES_MVP", "SERIES_BROADCAST"])

export function mentionNames(mention: Pick<LinkMention, "kind" | "text">): WrittenName[] {
  const text = mentionText(mention.text)
  const parts = LISTS.has(mention.kind) ? text.split(",") : [text]
  const names = parts.map((part) => writtenName(part)).filter((name) => name.keys.length > 0)
  return names.filter((name, index) => names.findIndex((other) => other.keys[0] === name.keys[0]) === index)
}

/** A record as it is matched: every name it goes by. */
export type Named = {
  id: string
  names: (string | null | undefined)[]
  name: string
  imageUrl?: string | null
  imageDarkUrl?: string | null
  detail: string
}

const candidate = ({ id, name, imageUrl, imageDarkUrl, detail }: Named, exact: boolean, inside: boolean) => ({
  id,
  name,
  imageUrl,
  imageDarkUrl,
  detail,
  exact,
  inside,
})

/** Records by each of their names, to find namesakes without reading the whole list for every row. */
export function nameIndex(records: readonly Named[]): Map<string, Named[]> {
  const index = new Map<string, Named[]>()
  for (const record of records)
    for (const key of unique(record.names.map(linkKey))) {
      const rows = index.get(key)
      if (rows) rows.push(record)
      else index.set(key, [record])
    }
  return index
}

/**
 * Records a name may stand for, best first: exact names from inside, exact names `near` it (such as players of the two
 * teams in other tournaments), exact names from anywhere, then names from inside that only hold the written one. With
 * `resemblingFirst` those come before strangers: a women's event writes the plain name of the club.
 */
export function nameCandidates(
  written: WrittenName,
  inside: readonly Named[],
  everyone: ReadonlyMap<string, Named[]>,
  { near = [], resemblingFirst = false }: { near?: readonly Named[]; resemblingFirst?: boolean } = {},
): LinkCandidate[] {
  const rows: LinkCandidate[] = []
  const add = (record: Named, exact: boolean, within: boolean) => {
    if (!rows.some((row) => row.id === record.id)) rows.push(candidate(record, exact, within))
  }
  const keysOf = (record: Named) => unique(record.names.map(linkKey))
  const matches = (record: Named) => keysOf(record).some((key) => written.keys.includes(key))
  const partial = (a: string, b: string) =>
    a.length >= MIN_PARTIAL && b.length >= MIN_PARTIAL && (a.includes(b) || b.includes(a))
  const addStrangers = () => {
    for (const key of written.keys) for (const record of everyone.get(key) ?? []) add(record, true, false)
  }
  const addResembling = () => {
    for (const record of inside)
      if (keysOf(record).some((key) => written.keys.some((own) => partial(key, own)))) add(record, false, true)
  }

  for (const record of inside) if (matches(record)) add(record, true, true)
  for (const record of near) if (matches(record)) add(record, true, false)
  if (resemblingFirst) addResembling()
  addStrangers()
  addResembling()
  return rows.slice(0, SHOWN)
}

/**
 * What a row offers. A list of several people is only certain for casters, where all of them are linked; a match has
 * one MVP, so several names leave the choice to the editor.
 */
export function rowSuggestion(
  mention: Pick<LinkMention, "kind" | "text">,
  candidatesOf: (name: WrittenName) => LinkCandidate[],
): RowSuggestion {
  const names = mentionNames(mention).map((name) => ({ ...name, candidates: candidatesOf(name) }))
  const sure = names.map((name) => {
    const exact = name.candidates.filter((row) => row.exact && row.inside)
    return exact.length === 1 ? exact[0]! : null
  })
  const single = mention.kind === "SERIES_BROADCAST" || names.length === 1
  const certain = single && sure.length > 0 ? sure.filter((row) => row !== null) : []
  return { names, certain: certain.length === names.length && names.length > 0 ? certain : null }
}

/**
 * People whose page carries exactly the written name. A search answers with namesakes first, then looser matches. A
 * player's page is offered too, but a player who shares a caster's name is not beyond doubt.
 */
export function pageCandidates(written: WrittenName, pages: readonly CommunityProfile[]): LinkCandidate[] {
  const people = pages
    .filter((page) => page.kind === "PERSON" || page.kind === "PLAYER")
    .filter((page) => written.keys.includes(linkKey(page.content?.name)))
  return people.slice(0, SHOWN).map((page) => ({
    id: page.id,
    name: page.content?.name ?? page.code,
    imageUrl: page.content?.avatarUrl,
    // Namesakes are told apart by the code in their address.
    detail: people.length > 1 ? `${profileKindLabels[page.kind]} · ${page.code}` : profileKindLabels[page.kind],
    exact: true,
    inside: page.kind === "PERSON",
  }))
}
