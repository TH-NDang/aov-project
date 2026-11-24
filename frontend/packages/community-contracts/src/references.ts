import type { PersonRole } from "./pages"

/** What a text can name: see spec 04, references in texts. */
export type ReferenceKind = "CIRCUIT" | "ORGANIZATION" | "COMPETITION" | "TEAM" | "PLAYER" | "PERSON"

/**
 * The names of one record and the address that opens it in Stream. The service leaves empty fields out. A player or
 * person carries the teams they were with, the latest first; nothing here is a picture or a real name.
 */
export type ReferenceName = {
  id: string
  kind: ReferenceKind
  name: string
  path: string
  shortName?: string
  aliases?: string[]
  /** The circuit a competition is a season of. */
  circuitId?: string
  teamIds?: string[]
}

/** Every name at once: a browser keeps the whole list and finds the names of a text in it. */
export type ReferenceNames = { items: ReferenceName[] }

/** What a reader sees of a record before opening it. */
export type ReferencePreview = {
  id: string
  kind: ReferenceKind
  name: string
  path: string
  shortName?: string
  /** The region of a competition, the country of anyone else. */
  country?: string
  logoUrl?: string
  logoDarkUrl?: string
  /** The first paragraph of the page's introduction. */
  summary?: string
  /** How many published competitions there are of a circuit, or with someone. */
  competitions: number
  event?: { tier?: string; startsOn?: string; endsOn?: string; circuit?: string }
  /** The newest published competition with someone: their team there, and what they did when they did not play. */
  latest?: {
    competitionId: string
    competition: string
    team?: { id: string; name: string; shortName?: string; logoUrl?: string; logoDarkUrl?: string }
    roles: PersonRole[]
  }
}
