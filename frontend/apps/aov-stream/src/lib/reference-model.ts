import type { CommunityProfile } from "@aov/community-contracts"
import { introductions } from "@aov/ui/lib/reference-words"
import { namedRecordKinds, referenceKey } from "@aov/ui/lib/running-text-names"

/** The record a page shows: the page itself, or the team or player it stands for. */
export function pageReferenceKey({ kind, id, entityId }: Pick<CommunityProfile, "kind" | "id" | "entityId">) {
  return referenceKey(namedRecordKinds[kind], (kind === "TEAM" || kind === "PLAYER") && entityId ? entityId : id)
}

/** One line about a game entry: the start of its description, without markup. */
export function firstLine(description: string) {
  return description
    .replace(/<[^<>]*>/g, "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "")
}

const PERSON_WORDS = new RegExp(`<ref=(?:player|person):|(?:${introductions.player})\\s`, "iu")

/**
 * Whether a text may name a person, so the long list of players is read only for it: it calls someone one, it links
 * one, or it speaks of a team and says something more that could be a name. `rest` are its words outside the names
 * found so far.
 */
export function mayNamePeople(text: string, rest: string, namesTeam: boolean, about: Iterable<string> = []) {
  if (PERSON_WORDS.test(text.normalize("NFC"))) return true
  const team = namesTeam || [...about].some((key) => key.startsWith("team:"))
  return team && /[\p{Lu}\p{Lo}\p{N}]/u.test(rest)
}

/** The words of a text while its references are not known yet. */
export const plainReferences = (text: string) => text.replace(/<ref=[a-z]+:[\w.-]+>([^<>]*)<\/ref>/gi, "$1")
